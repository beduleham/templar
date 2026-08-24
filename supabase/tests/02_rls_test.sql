-- ============================================================================
-- RLS 검증.
-- 클라이언트가 anon 키로 직접 붙는 구조라, 실제 접근 통제는 전적으로 RLS다.
-- 각 블록은 authenticated 역할 + JWT sub 를 바꿔가며 실제 권한을 확인한다.
-- 01_rules_test.sql 이 만든 데이터 위에서 이어서 실행한다.
-- ============================================================================

-- 픽스처 요약
--   client  11111111…  펫케어 프로젝트 의뢰자
--   lumen   22222222…  NDA 서명 + 입찰 선정 + 계약 수행사
--   rocket  33333333…  NDA 서명 + 입찰 탈락
--   admin   44444444…  운영 관리자
--   other   55555555…  무관한 제3자 (NDA 미서명)

-- ── ① NDA 미서명자는 상세 스펙을 볼 수 없다 ────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
begin
  perform t_assert(
    (select count(*) from spec_tasks
      where project_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
    'RLS① NDA 미서명자에게 상세 태스크가 0건으로 차단된다');
  perform t_assert(
    (select count(*) from spec_epics
      where project_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
    'RLS② NDA 미서명자에게 에픽도 노출되지 않는다');
  -- 입찰 중인 프로젝트의 존재 자체(제목·요약)는 열려 있어야 입찰 참여가 가능하다
  perform t_assert(
    (select count(*) from projects
      where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
    'RLS③ 입찰이 끝난(completed) 프로젝트는 제3자에게 목록에서도 감춰진다');
end;
$$;
rollback;

-- ── ② NDA 서명자는 상세 스펙을 볼 수 있다 ──────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform t_assert(
    (select count(*) from spec_tasks
      where project_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 2,
    'RLS④ NDA 서명 파트너는 상세 태스크를 조회할 수 있다');
end;
$$;
rollback;

-- ── ③ 경쟁 입찰가는 서로에게 보이지 않는다 ─────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform t_assert(
    (select count(*) from bids
      where project_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1,
    'RLS⑤ 파트너에게는 자기 입찰 1건만 보인다 (경쟁사 견적 차단)');
  perform t_assert(
    (select count(*) from bid_items) = 2,
    'RLS⑥ 경쟁사의 항목별 견적도 조회되지 않는다');
end;
$$;
rollback;

-- ── ④ 의뢰자는 자기 프로젝트의 모든 입찰을 비교할 수 있다 ──────────────────
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  perform t_assert(
    (select count(*) from bids
      where project_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 2,
    'RLS⑦ 의뢰자는 자기 프로젝트의 입찰 2건을 모두 본다');
  perform t_assert(
    (select count(*) from bid_items) = 4,
    'RLS⑧ 의뢰자는 항목별 견적을 전부 비교할 수 있다');
end;
$$;
rollback;

-- ── ⑤ 남의 프로젝트는 손댈 수 없다 ─────────────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
declare affected int;
begin
  update projects set title = '탈취된 제목'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  perform t_assert(affected = 0, 'RLS⑨ 제3자의 프로젝트 수정이 0건으로 무력화된다');
end;
$$;
rollback;

-- ── ⑥ NDA는 본인 명의로만 서명할 수 있다 ───────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
declare blocked boolean := false;
begin
  begin
    insert into project_ndas (project_id, user_id, signer_name, signer_company)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333', '로켓개발단', '로켓개발단');
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, 'RLS⑩ 타인 명의의 NDA 서명이 차단된다');
end;
$$;
rollback;

-- ── ⑦ 칸반 이동은 계약 수행사만 ────────────────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare affected int;
begin
  update spec_tasks set status = 'done'
  where project_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  perform t_assert(affected = 0,
    'RLS⑪ 계약하지 않은 파트너의 태스크 상태 변경이 무력화된다');
end;
$$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare affected int;
begin
  update spec_tasks set status = 'done'
  where project_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  perform t_assert(affected = 2, 'RLS⑫ 계약 수행사는 칸반 상태를 변경할 수 있다');
end;
$$;
rollback;

-- ── ⑧ 감사 로그: 참여자만 조회, 아무도 변경 불가 ───────────────────────────
begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
begin
  perform t_assert(
    (select count(*) from system_audit_logs) = 0,
    'RLS⑬ 제3자에게 감사 로그가 노출되지 않는다');
end;
$$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare blocked boolean := false;
begin
  perform t_assert(
    (select count(*) from system_audit_logs) = 1,
    'RLS⑭ 프로젝트 참여자는 감사 로그를 조회할 수 있다');
  begin
    update system_audit_logs set actor_name = '조작';
  exception when others then blocked := true;
  end;
  perform t_assert(blocked,
    'RLS⑮ 참여자에게도 감사 로그 UPDATE 권한이 없다 (권한 회수 + 트리거)');
end;
$$;
rollback;

-- ── ⑨ 운영 관리자는 전부 볼 수 있다 ────────────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$
begin
  perform t_assert(
    (select count(*) from spec_tasks
      where project_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 2,
    'RLS⑯ 운영 관리자는 NDA 없이도 상세 스펙을 조회한다');
  perform t_assert(
    (select count(*) from bids) = 2,
    'RLS⑰ 운영 관리자는 모든 입찰을 조회한다');
  perform t_assert(
    (select count(*) from system_audit_logs) = 1,
    'RLS⑱ 운영 관리자는 감사 로그 전체를 조회한다');
end;
$$;
rollback;

-- ── ⑩ 익명(anon) 사용자는 아무것도 볼 수 없다 ──────────────────────────────
begin;
set local role anon;
do $$
declare blocked boolean := false;
begin
  begin
    perform count(*) from projects;
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, 'RLS⑲ 비로그인 사용자는 테이블 접근 자체가 막힌다');
end;
$$;
rollback;

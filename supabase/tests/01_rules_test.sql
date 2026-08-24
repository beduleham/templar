-- ============================================================================
-- 비즈니스 규칙 + RLS 검증.
--   psql -f supabase/tests/00_local_shim.sql
--   psql -f supabase/migrations/*.sql
--   psql -f supabase/tests/01_rules_test.sql
-- 실패한 단언이 하나라도 있으면 스크립트가 에러로 종료된다.
-- ============================================================================

create or replace function t_assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then
    raise notice 'PASS  %', label;
  else
    raise exception 'FAIL  %', label;
  end if;
end;
$$;

-- ── 픽스처 ──────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'client@archon.test'),
  ('22222222-2222-2222-2222-222222222222', 'lumen@archon.test'),
  ('33333333-3333-3333-3333-333333333333', 'rocket@archon.test'),
  ('44444444-4444-4444-4444-444444444444', 'admin@archon.test'),
  ('55555555-5555-5555-5555-555555555555', 'other@archon.test');

insert into profiles (id, name, company, role, tech_tags) values
  ('11111111-1111-1111-1111-111111111111', '김의뢰', '펫케어랩', 'client', '{}'),
  ('22222222-2222-2222-2222-222222222222', '루멘소프트', '루멘소프트', 'partner', '{Next.js,Supabase}'),
  ('33333333-3333-3333-3333-333333333333', '로켓개발단', '로켓개발단', 'partner', '{React,Node}'),
  ('44444444-4444-4444-4444-444444444444', '운영관리자', '템플러아카이브', 'admin', '{}'),
  ('55555555-5555-5555-5555-555555555555', '박타인', '무관회사', 'client', '{}');

insert into projects (id, title, summary, client_id, status, tech_tags)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '펫케어 예약 플랫폼', '반려동물 돌봄 예약',
  '11111111-1111-1111-1111-111111111111', 'bidding', '{Next.js}'
);

insert into spec_epics (id, project_id, title, sort_order) values
  ('bbbbbbbb-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001', '기반 구축', 1);

insert into spec_features (id, epic_id, title, sort_order) values
  ('cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', '인증', 1);

insert into spec_tasks (id, feature_id, project_id, title, milestone_phase, node_id, estimated_md, sort_order)
values
  ('dddddddd-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   -- 일부러 틀린 project_id 를 넣는다. 트리거가 상위 계층 값으로 교정해야 한다.
   '00000000-0000-0000-0000-000000000000',
   '이메일 가입', 1, 'auth', 3, 1),
  ('dddddddd-0000-0000-0000-000000000002',
   'cccccccc-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000',
   '소셜 로그인', 1, 'social', 2, 2);

do $$
begin
  perform t_assert(
    (select count(*) from spec_tasks
      where project_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 2,
    '① spec_tasks.project_id 가 상위 계층 값으로 자동 교정된다');
end;
$$;

-- ── ② NDA 없이는 입찰 불가 ─────────────────────────────────────────────────
do $$
declare blocked boolean := false;
begin
  begin
    insert into bids (project_id, partner_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '22222222-2222-2222-2222-222222222222');
  exception when others then
    blocked := true;
  end;
  perform t_assert(blocked, '② NDA 미서명 파트너의 입찰이 차단된다');
end;
$$;

insert into project_ndas (project_id, user_id, signer_name, signer_company) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', '루멘소프트', '루멘소프트'),
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333', '로켓개발단', '로켓개발단');

-- ── ③ 모든 태스크를 견적해야 제출 가능 ─────────────────────────────────────
do $$
declare blocked boolean := false;
begin
  begin
    insert into bids (id, project_id, partner_id)
    values ('eeeeeeee-0000-0000-0000-00000000000f',
            'aaaaaaaa-0000-0000-0000-000000000001',
            '22222222-2222-2222-2222-222222222222');
    -- 태스크는 2건인데 1건만 견적하고 제출한다
    insert into bid_items (bid_id, task_id, man_day, unit_price)
    values ('eeeeeeee-0000-0000-0000-00000000000f',
            'dddddddd-0000-0000-0000-000000000001', 3, 500000);
    update bids set status = 'submitted'
    where id = 'eeeeeeee-0000-0000-0000-00000000000f';
  exception when others then
    blocked := true;
  end;
  perform t_assert(blocked, '③ 태스크 견적이 빠진 입찰은 커밋되지 않는다');
end;
$$;

-- 정상 입찰 2건
insert into bids (id, project_id, partner_id, tech_score, comm_score, portfolio_score) values
  ('eeeeeeee-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 88, 76, 82),
  ('eeeeeeee-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333', 71, 90, 64);

-- draft 로 만든 뒤 항목을 채우고 제출한다 (REST 클라이언트의 실제 순서)
insert into bid_items (bid_id, task_id, man_day, unit_price, estimation_basis) values
  ('eeeeeeee-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000001', 3.00, 500000, '자체 인증 모듈 재사용'),
  ('eeeeeeee-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000002', 2.00, 500000, 'OAuth 3종 연동'),
  ('eeeeeeee-0000-0000-0000-000000000002',
   'dddddddd-0000-0000-0000-000000000001', 4.00, 450000, '신규 구현'),
  ('eeeeeeee-0000-0000-0000-000000000002',
   'dddddddd-0000-0000-0000-000000000002', 3.00, 450000, '신규 구현');

update bids set status = 'submitted'
where id in ('eeeeeeee-0000-0000-0000-000000000001',
             'eeeeeeee-0000-0000-0000-000000000002');

do $$
begin
  perform t_assert(
    (select total_amount from bids where id = 'eeeeeeee-0000-0000-0000-000000000001') = 2500000
    and (select total_man_days from bids where id = 'eeeeeeee-0000-0000-0000-000000000001') = 5.00,
    '④ 입찰 총액·총공수가 항목에서 자동 재계산된다');
end;
$$;

-- ── ⑤ 다른 프로젝트 태스크 견적 차단 ───────────────────────────────────────
insert into projects (id, title, client_id, status)
values ('aaaaaaaa-0000-0000-0000-000000000002', '무관 프로젝트',
        '55555555-5555-5555-5555-555555555555', 'bidding');
insert into spec_epics (id, project_id, title, sort_order)
values ('bbbbbbbb-0000-0000-0000-000000000002',
        'aaaaaaaa-0000-0000-0000-000000000002', '무관', 1);
insert into spec_features (id, epic_id, title, sort_order)
values ('cccccccc-0000-0000-0000-000000000002',
        'bbbbbbbb-0000-0000-0000-000000000002', '무관', 1);
insert into spec_tasks (id, feature_id, project_id, title, milestone_phase, sort_order)
values ('dddddddd-0000-0000-0000-000000000009',
        'cccccccc-0000-0000-0000-000000000002',
        'aaaaaaaa-0000-0000-0000-000000000002', '무관 태스크', 1, 1);

do $$
declare blocked boolean := false;
begin
  begin
    insert into bid_items (bid_id, task_id, man_day, unit_price)
    values ('eeeeeeee-0000-0000-0000-000000000001',
            'dddddddd-0000-0000-0000-000000000009', 1, 100000);
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, '⑤ 다른 프로젝트 태스크에는 견적을 넣을 수 없다');
end;
$$;

-- ── ⑥ 입찰 선정 → 나머지 자동 탈락 ─────────────────────────────────────────
update bids set status = 'accepted'
where id = 'eeeeeeee-0000-0000-0000-000000000001';

do $$
begin
  perform t_assert(
    (select status from bids where id = 'eeeeeeee-0000-0000-0000-000000000002') = 'rejected',
    '⑥ 입찰 선정 시 나머지 입찰이 자동 탈락 처리된다');
end;
$$;

do $$
declare blocked boolean := false;
begin
  begin
    update bids set status = 'accepted'
    where id = 'eeeeeeee-0000-0000-0000-000000000002';
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, '⑦ 프로젝트당 선정 입찰은 1건을 넘을 수 없다');
end;
$$;

-- ── ⑧ 계약 → 50/30/20 자동 생성, 합계 일치 ─────────────────────────────────
-- 나누어떨어지지 않는 금액으로 잔액 보정을 확인한다
insert into contracts (id, project_id, bid_id, partner_id, total_amount)
values ('ffffffff-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'eeeeeeee-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', 10000001);

do $$
declare m1 bigint; m2 bigint; m3 bigint;
begin
  select amount into m1 from milestones
    where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 1;
  select amount into m2 from milestones
    where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 2;
  select amount into m3 from milestones
    where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 3;

  perform t_assert(m1 = 5000000 and m2 = 3000000 and m3 = 2000001,
    '⑧ 계약 체결 시 50/30/20 마일스톤이 자동 생성된다 (잔액 보정 포함)');
  perform t_assert(m1 + m2 + m3 = 10000001,
    '⑨ 마일스톤 합계가 계약 총액과 정확히 일치한다');
end;
$$;

do $$
declare blocked boolean := false;
begin
  begin
    update milestones set amount = amount + 1
    where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 1;
    set constraints milestones_assert_sum immediate;
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, '⑩ 마일스톤 금액을 임의로 바꾸면 합계 검사에서 막힌다');
end;
$$;

do $$
declare blocked boolean := false;
begin
  begin
    update milestones set ratio = 0.40
    where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 1;
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, '⑪ 50/30/20 이외의 비율은 CHECK로 차단된다');
end;
$$;

-- ── ⑫ 마일스톤 상태 전이 ───────────────────────────────────────────────────
do $$
declare blocked boolean := false;
begin
  begin
    update milestones set status = 'inspection_requested'
    where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 1;
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, '⑫ 예치 전에는 검수 요청으로 건너뛸 수 없다');
end;
$$;

update milestones set status = 'escrow_deposited'
  where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 1;
update milestones set status = 'inspection_requested'
  where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 1;

do $$
declare blocked boolean := false;
begin
  begin
    update milestones set status = 'escrow_deposited', reject_reason = '짧음'
    where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 1;
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, '⑬ 검수 반려 사유가 10자 미만이면 막힌다');
end;
$$;

update milestones
  set status = 'released', inspection_notes = '산출물 확인 완료'
  where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 1;

do $$
declare blocked boolean := false;
begin
  begin
    update milestones set status = 'escrow_deposited'
    where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 1;
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, '⑭ 정산이 끝난 마일스톤은 되돌릴 수 없다');
end;
$$;

-- 운영사 강제 조정은 종료 전 상태에서 가능
update milestones set status = 'escrow_deposited'
  where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 2;
update milestones set status = 'override_refunded'
  where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 2;

do $$
begin
  perform t_assert(
    (select status from milestones
      where contract_id = 'ffffffff-0000-0000-0000-000000000001' and phase = 2)
      = 'override_refunded',
    '⑮ 운영사 강제 환불은 종료 전 어느 상태에서든 가능하다');
end;
$$;

-- ── ⑯ 감사 로그 불변성 ─────────────────────────────────────────────────────
insert into system_audit_logs (project_id, actor_id, actor_name, action_type, after_state)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', '김의뢰',
        'CONTRACT_CREATED', '{"totalAmount": 10000001}'::jsonb);

do $$
declare upd_blocked boolean := false; del_blocked boolean := false;
begin
  begin
    update system_audit_logs set actor_name = '조작된이름';
  exception when others then upd_blocked := true;
  end;
  begin
    delete from system_audit_logs;
  exception when others then del_blocked := true;
  end;
  perform t_assert(upd_blocked, '⑯ 감사 로그는 UPDATE 할 수 없다');
  perform t_assert(del_blocked, '⑰ 감사 로그는 DELETE 할 수 없다');
end;
$$;

-- ── ⑱ 카드 원본 정보 저장 차단 ─────────────────────────────────────────────
update projects set status = 'completed'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare blocked boolean := false;
begin
  begin
    insert into as_subscriptions
      (project_id, tier, billing_key, card_label, price_monthly, next_billing_date)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'standard',
            '4111111111111111', '신한 ****1234', 300000, current_date + 30);
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, '⑱ 카드번호로 보이는 값은 빌링키로 저장할 수 없다');
end;
$$;

insert into as_subscriptions
  (id, project_id, tier, billing_key, card_label, price_monthly, next_billing_date)
values ('99999999-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001', 'standard',
        'bkey_a1b2c3d4', '신한 ****1234', 300000, current_date + 30);

-- ── ⑲ 분쟁 사유 강제 ───────────────────────────────────────────────────────
do $$
declare blocked boolean := false;
begin
  begin
    update projects set status = 'disputed', dispute_reason = '싫음'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, '⑲ 분쟁 전환에는 10자 이상의 사유가 필요하다');
end;
$$;

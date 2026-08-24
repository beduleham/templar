-- ============================================================================
-- 데모 시드 데이터.
-- 앱의 클라이언트 스토어(src/lib/domain/store.ts) 시드와 같은 상황을 재현한다.
--   prj-pet   진행 중 — 계약 체결, 1단계 정산 완료, 2단계 개발 중
--   prj-care  입찰 중 — 성향이 다른 두 개발사의 견적 비교
--
-- 호스팅 Supabase에서는 auth.users 를 직접 INSERT 하지 않고 Admin API 또는
-- `supabase auth` 로 계정을 만든 뒤 아래 UUID를 맞춰 넣는다. 로컬(supabase start)
-- 에서는 이 파일 그대로 실행된다.
-- ============================================================================

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'client@archon.demo'),
  ('22222222-2222-2222-2222-222222222222', 'archon@archon.demo'),
  ('33333333-3333-3333-3333-333333333333', 'rocket@archon.demo'),
  ('44444444-4444-4444-4444-444444444444', 'lumen@archon.demo'),
  ('55555555-5555-5555-5555-555555555555', 'admin@archon.demo')
on conflict (id) do nothing;

insert into profiles (id, name, company, role, tech_tags) values
  ('11111111-1111-1111-1111-111111111111', '김의뢰', '펫케어랩', 'client', '{}'),
  ('22222222-2222-2222-2222-222222222222', '김아칸', '스튜디오 아칸', 'partner',
   '{Next.js,Supabase,TypeScript}'),
  ('33333333-3333-3333-3333-333333333333', '스튜디오 로켓', '스튜디오 로켓', 'partner',
   '{React,Node.js,결제연동}'),
  ('44444444-4444-4444-4444-444444444444', '루멘랩스', '루멘랩스', 'partner',
   '{Next.js,PostgreSQL}'),
  ('55555555-5555-5555-5555-555555555555', '운영관리자', '템플러아카이브', 'admin', '{}')
on conflict (id) do nothing;

-- ── 공통: 에픽/피처/태스크를 만들어 주는 헬퍼 ──────────────────────────────
create or replace function seed_spec(
  p_project uuid,
  p_epic_title text,
  p_epic_order smallint,
  p_feature_title text,
  p_tasks jsonb   -- [{"title":…, "phase":1, "node":"auth", "md":3}, …]
)
returns void
language plpgsql
as $$
declare
  epic_id     uuid;
  feature_id  uuid;
  item        jsonb;
  idx         smallint := 0;
begin
  insert into spec_epics (project_id, title, sort_order)
  values (p_project, p_epic_title, p_epic_order)
  returning id into epic_id;

  insert into spec_features (epic_id, title, sort_order)
  values (epic_id, p_feature_title, 1)
  returning id into feature_id;

  for item in select * from jsonb_array_elements(p_tasks) loop
    idx := idx + 1;
    insert into spec_tasks
      (feature_id, project_id, title, description, milestone_phase,
       node_id, estimated_md, sort_order)
    values (
      feature_id, p_project,
      item ->> 'title',
      coalesce(item ->> 'desc', ''),
      (item ->> 'phase')::smallint,
      item ->> 'node',
      (item ->> 'md')::numeric,
      idx
    );
  end loop;
end;
$$;

-- ── prj-pet — 진행 중인 프로젝트 ───────────────────────────────────────────
insert into projects (id, title, summary, client_id, status, tech_tags,
                      spec_markdown, mermaid_code)
values (
  'a0000000-0000-0000-0000-000000000001',
  '펫케어 예약 플랫폼',
  '반려동물 돌봄 예약과 결제를 한 번에 처리하는 서비스',
  '11111111-1111-1111-1111-111111111111',
  'active',
  '{Next.js,Supabase,결제}',
  E'# 펫케어 예약 플랫폼\n\n반려동물 돌봄 예약·결제·알림을 제공한다.',
  E'graph TD\n  auth[인증] --> booking[예약]\n  booking --> payment[결제]\n  payment --> db[(데이터베이스)]'
);

select seed_spec(
  'a0000000-0000-0000-0000-000000000001',
  '기반 구축', 1::smallint, '계정과 예약',
  '[{"title":"이메일 회원가입","phase":1,"node":"auth","md":3,"desc":"이메일·비밀번호 가입과 인증 메일"},
    {"title":"예약 신청 화면","phase":1,"node":"booking","md":5,"desc":"돌봄사 선택과 일정 지정"},
    {"title":"결제 연동","phase":2,"node":"payment","md":6,"desc":"카드 결제와 부분 취소"},
    {"title":"예약 알림","phase":2,"node":"notify","md":3,"desc":"예약 확정·리마인드 알림"},
    {"title":"관리자 대시보드","phase":3,"node":"admin","md":4,"desc":"예약 현황 집계"}]'::jsonb
);

-- 1단계 완료, 2단계 진행 중
update spec_tasks set status = 'done'
  where project_id = 'a0000000-0000-0000-0000-000000000001' and milestone_phase = 1;
update spec_tasks set status = 'in_progress'
  where project_id = 'a0000000-0000-0000-0000-000000000001' and node_id = 'payment';

insert into project_ndas (project_id, user_id, signer_name, signer_company)
values ('a0000000-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', '김아칸', '스튜디오 아칸');

insert into bids (id, project_id, partner_id, tech_score, comm_score, portfolio_score)
values ('b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', 88, 84, 80);

insert into bid_items (bid_id, task_id, man_day, unit_price, estimation_basis)
select 'b0000000-0000-0000-0000-000000000001', t.id, t.estimated_md, 700000, null
from spec_tasks t
where t.project_id = 'a0000000-0000-0000-0000-000000000001';

update bids set status = 'submitted' where id = 'b0000000-0000-0000-0000-000000000001';
update bids set status = 'accepted'  where id = 'b0000000-0000-0000-0000-000000000001';

-- 계약을 만들면 50/30/20 마일스톤이 트리거로 자동 생성된다
insert into contracts (id, project_id, bid_id, partner_id, total_amount)
select 'c0000000-0000-0000-0000-000000000001',
       'a0000000-0000-0000-0000-000000000001',
       'b0000000-0000-0000-0000-000000000001',
       '22222222-2222-2222-2222-222222222222',
       total_amount
from bids where id = 'b0000000-0000-0000-0000-000000000001';

-- 1단계: 예치 → 검수 요청 → 정산 완료
update milestones set status = 'escrow_deposited'
  where contract_id = 'c0000000-0000-0000-0000-000000000001' and phase = 1;
update milestones set status = 'inspection_requested'
  where contract_id = 'c0000000-0000-0000-0000-000000000001' and phase = 1;
update milestones set status = 'released', inspection_notes = '가입·예약 흐름 확인 완료'
  where contract_id = 'c0000000-0000-0000-0000-000000000001' and phase = 1;
-- 2단계: 예치까지 진행
update milestones set status = 'escrow_deposited'
  where contract_id = 'c0000000-0000-0000-0000-000000000001' and phase = 2;

-- ── prj-care — 입찰 중인 프로젝트 ──────────────────────────────────────────
insert into projects (id, title, summary, client_id, status, tech_tags,
                      spec_markdown, mermaid_code)
values (
  'a0000000-0000-0000-0000-000000000002',
  '시니어 돌봄 매칭 서비스',
  '보호자와 요양보호사를 연결하고 정산까지 처리하는 플랫폼',
  '11111111-1111-1111-1111-111111111111',
  'bidding',
  '{Next.js,PostgreSQL,결제}',
  E'# 시니어 돌봄 매칭 서비스\n\n보호자와 요양보호사를 매칭한다.',
  E'graph TD\n  auth[인증] --> match[매칭]\n  match --> settle[정산]\n  settle --> db[(데이터베이스)]'
);

select seed_spec(
  'a0000000-0000-0000-0000-000000000002',
  '핵심 기능', 1::smallint, '매칭과 정산',
  '[{"title":"보호자 회원가입","phase":1,"node":"auth","md":3},
    {"title":"요양보호사 프로필","phase":1,"node":"profile","md":4},
    {"title":"매칭 알고리즘","phase":2,"node":"match","md":8},
    {"title":"정산 처리","phase":2,"node":"settle","md":6},
    {"title":"운영 리포트","phase":3,"node":"report","md":4}]'::jsonb
);

insert into project_ndas (project_id, user_id, signer_name, signer_company) values
  ('a0000000-0000-0000-0000-000000000002',
   '33333333-3333-3333-3333-333333333333', '스튜디오 로켓', '스튜디오 로켓'),
  ('a0000000-0000-0000-0000-000000000002',
   '44444444-4444-4444-4444-444444444444', '루멘랩스', '루멘랩스');

insert into bids (id, project_id, partner_id, tech_score, comm_score, portfolio_score) values
  ('b0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000002',
   '33333333-3333-3333-3333-333333333333', 92, 74, 88),
  ('b0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000002',
   '44444444-4444-4444-4444-444444444444', 78, 91, 70);

-- 로켓: 결제·정산 쪽 공수를 크게 잡는 성향
insert into bid_items (bid_id, task_id, man_day, unit_price, estimation_basis)
select 'b0000000-0000-0000-0000-000000000002', t.id,
       t.estimated_md + 1,
       case when t.node_id in ('match', 'settle') then 820000 else 650000 end,
       case when t.node_id in ('match', 'settle')
            then '외부 결제사 연동과 예외 처리(환불·부분취소) 검증에 추가 공수가 필요합니다.'
       end
from spec_tasks t
where t.project_id = 'a0000000-0000-0000-0000-000000000002';

-- 루멘: 사내 모듈 재사용으로 일부 항목을 낮게 책정
insert into bid_items (bid_id, task_id, man_day, unit_price, estimation_basis)
select 'b0000000-0000-0000-0000-000000000003', t.id,
       t.estimated_md,
       case when t.node_id = 'profile' then 430000 else 600000 end,
       case when t.node_id = 'profile'
            then '사내에 유사 모듈이 있어 재사용이 가능해 공수를 낮게 책정했습니다.'
       end
from spec_tasks t
where t.project_id = 'a0000000-0000-0000-0000-000000000002';

update bids set status = 'submitted'
where id in ('b0000000-0000-0000-0000-000000000002',
             'b0000000-0000-0000-0000-000000000003');

-- ── 감사 로그 ───────────────────────────────────────────────────────────────
insert into system_audit_logs
  (project_id, actor_id, actor_name, action_type, after_state)
values
  ('a0000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', '김의뢰', 'PROJECT_CREATED',
   '{"title": "펫케어 예약 플랫폼"}'::jsonb),
  ('a0000000-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', '김아칸', 'NDA_SIGNED', null),
  ('a0000000-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', '김아칸', 'BID_SUBMITTED', null),
  ('a0000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', '김의뢰', 'BID_ACCEPTED', null),
  ('a0000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', '김의뢰', 'CONTRACT_CREATED', null),
  ('a0000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', '김의뢰', 'ESCROW_DEPOSITED', null),
  ('a0000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', '김의뢰', 'MILESTONE_RELEASED', null),
  ('a0000000-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', '김의뢰', 'PROJECT_CREATED',
   '{"title": "시니어 돌봄 매칭 서비스"}'::jsonb);

drop function seed_spec(uuid, text, smallint, text, jsonb);

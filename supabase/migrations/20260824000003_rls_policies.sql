-- ============================================================================
-- Row Level Security.
-- 클라이언트가 anon 키로 DB에 직접 붙는 구조이므로, 접근 통제의 실체는
-- 전적으로 아래 정책이다. 애플리케이션의 canViewSpecDetail() 게이트는
-- 화면 편의일 뿐이고 실제 차단은 여기서 이뤄진다.
-- ============================================================================

-- ── 보조 함수 ───────────────────────────────────────────────────────────────
-- 정책 안에서 다른 테이블을 읽으므로 RLS 재귀를 피하려 security definer로 둔다.
create or replace function archon_uid()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function archon_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function archon_is_project_client(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from projects
    where id = target and client_id = auth.uid()
  );
$$;

create or replace function archon_has_signed_nda(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from project_ndas
    where project_id = target and user_id = auth.uid()
  );
$$;

-- 계약이 체결된 프로젝트의 수행사인지
create or replace function archon_is_contract_partner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from contracts
    where project_id = target and partner_id = auth.uid()
  );
$$;

-- 해당 프로젝트에 입찰했거나 계약한 파트너인지
create or replace function archon_is_project_partner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from bids
    where project_id = target and partner_id = auth.uid()
  ) or archon_is_contract_partner(target);
$$;

-- 스펙 상세를 볼 수 있는가 — NDA 게이트의 실제 구현
create or replace function archon_can_view_spec(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select archon_is_admin()
      or archon_is_project_client(target)
      or archon_has_signed_nda(target);
$$;

-- ── RLS 활성화 ──────────────────────────────────────────────────────────────
alter table profiles           enable row level security;
alter table projects           enable row level security;
alter table spec_epics         enable row level security;
alter table spec_features      enable row level security;
alter table spec_tasks         enable row level security;
alter table project_ndas       enable row level security;
alter table bids               enable row level security;
alter table bid_items          enable row level security;
alter table contracts          enable row level security;
alter table milestones         enable row level security;
alter table as_subscriptions   enable row level security;
alter table as_payment_logs    enable row level security;
alter table system_audit_logs  enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
-- 이름·회사·역할은 상대방 식별에 필요하므로 로그인 사용자에게 공개한다.
create policy profiles_select on profiles
  for select to authenticated
  using (true);

create policy profiles_insert_self on profiles
  for insert to authenticated
  with check (id = archon_uid());

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = archon_uid() or archon_is_admin())
  with check (id = archon_uid() or archon_is_admin());

-- ── projects ────────────────────────────────────────────────────────────────
-- 입찰 중인 프로젝트는 목록 수준(제목·요약·태그)까지만 모두에게 열린다.
-- 상세 스펙은 spec_* 테이블 정책에서 NDA로 막힌다.
create policy projects_select on projects
  for select to authenticated
  using (
    client_id = archon_uid()
    or archon_is_admin()
    or status = 'bidding'
    or archon_is_project_partner(id)
  );

create policy projects_insert on projects
  for insert to authenticated
  with check (client_id = archon_uid());

create policy projects_update on projects
  for update to authenticated
  using (client_id = archon_uid() or archon_is_admin())
  with check (client_id = archon_uid() or archon_is_admin());

create policy projects_delete_draft on projects
  for delete to authenticated
  using (client_id = archon_uid() and status = 'draft');

-- ── 스펙 계층 (NDA 게이트) ──────────────────────────────────────────────────
create policy spec_epics_select on spec_epics
  for select to authenticated
  using (archon_can_view_spec(project_id));

create policy spec_epics_write on spec_epics
  for all to authenticated
  using (archon_is_project_client(project_id) or archon_is_admin())
  with check (archon_is_project_client(project_id) or archon_is_admin());

create policy spec_features_select on spec_features
  for select to authenticated
  using (
    exists (
      select 1 from spec_epics e
      where e.id = epic_id and archon_can_view_spec(e.project_id)
    )
  );

create policy spec_features_write on spec_features
  for all to authenticated
  using (
    exists (
      select 1 from spec_epics e
      where e.id = epic_id
        and (archon_is_project_client(e.project_id) or archon_is_admin())
    )
  )
  with check (
    exists (
      select 1 from spec_epics e
      where e.id = epic_id
        and (archon_is_project_client(e.project_id) or archon_is_admin())
    )
  );

create policy spec_tasks_select on spec_tasks
  for select to authenticated
  using (archon_can_view_spec(project_id));

-- 칸반 이동(상태 변경)은 계약을 맺은 수행사와 운영사만 할 수 있다.
create policy spec_tasks_update_status on spec_tasks
  for update to authenticated
  using (archon_is_contract_partner(project_id) or archon_is_admin())
  with check (archon_is_contract_partner(project_id) or archon_is_admin());

create policy spec_tasks_insert on spec_tasks
  for insert to authenticated
  with check (archon_is_project_client(project_id) or archon_is_admin());

create policy spec_tasks_delete on spec_tasks
  for delete to authenticated
  using (archon_is_project_client(project_id) or archon_is_admin());

-- ── project_ndas ────────────────────────────────────────────────────────────
create policy project_ndas_select on project_ndas
  for select to authenticated
  using (
    user_id = archon_uid()
    or archon_is_project_client(project_id)
    or archon_is_admin()
  );

-- 서명은 본인 명의로만 가능하다
create policy project_ndas_insert_self on project_ndas
  for insert to authenticated
  with check (user_id = archon_uid());

-- ── bids ────────────────────────────────────────────────────────────────────
-- 작성 중(draft)인 입찰은 본인과 운영사에게만 보인다
create policy bids_select on bids
  for select to authenticated
  using (
    partner_id = archon_uid()
    or archon_is_admin()
    or (archon_is_project_client(project_id) and status <> 'draft')
  );

create policy bids_insert_self on bids
  for insert to authenticated
  with check (
    partner_id = archon_uid()
    and exists (
      select 1 from projects p
      where p.id = project_id and p.status = 'bidding'
    )
  );

-- 파트너는 자기 입찰을, 의뢰자는 선정 처리를 위해 수정할 수 있다
-- 파트너는 선정 전까지 자기 입찰을, 의뢰자는 선정 처리를 위해 수정할 수 있다
create policy bids_update on bids
  for update to authenticated
  using (
    (partner_id = archon_uid() and status in ('draft', 'submitted'))
    or archon_is_project_client(project_id)
    or archon_is_admin()
  )
  with check (
    (partner_id = archon_uid() and status in ('draft', 'submitted'))
    or archon_is_project_client(project_id)
    or archon_is_admin()
  );

create policy bids_delete_own on bids
  for delete to authenticated
  using (partner_id = archon_uid() and status in ('draft', 'submitted'));

-- ── bid_items ───────────────────────────────────────────────────────────────
create policy bid_items_select on bid_items
  for select to authenticated
  using (
    exists (
      select 1 from bids b
      where b.id = bid_id
        and (
          b.partner_id = archon_uid()
          or archon_is_project_client(b.project_id)
          or archon_is_admin()
        )
    )
  );

create policy bid_items_write_own on bid_items
  for all to authenticated
  using (
    exists (
      select 1 from bids b
      where b.id = bid_id and b.partner_id = archon_uid()
        and b.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from bids b
      where b.id = bid_id and b.partner_id = archon_uid()
        and b.status = 'draft'
    )
  );

-- ── contracts ───────────────────────────────────────────────────────────────
create policy contracts_select on contracts
  for select to authenticated
  using (
    partner_id = archon_uid()
    or archon_is_project_client(project_id)
    or archon_is_admin()
  );

-- 계약은 의뢰자가 입찰을 선정하는 순간 생성된다
create policy contracts_insert on contracts
  for insert to authenticated
  with check (archon_is_project_client(project_id) or archon_is_admin());

-- ── milestones ──────────────────────────────────────────────────────────────
create policy milestones_select on milestones
  for select to authenticated
  using (
    archon_is_project_client(project_id)
    or archon_is_contract_partner(project_id)
    or archon_is_admin()
  );

-- 예치·검수 승인/반려는 의뢰자, 검수 요청은 수행사, 강제 조정은 운영사가 한다.
-- 어떤 전이가 가능한지는 archon_check_milestone_transition 트리거가 판정한다.
create policy milestones_update on milestones
  for update to authenticated
  using (
    archon_is_project_client(project_id)
    or archon_is_contract_partner(project_id)
    or archon_is_admin()
  )
  with check (
    archon_is_project_client(project_id)
    or archon_is_contract_partner(project_id)
    or archon_is_admin()
  );

-- ── AS 구독 ─────────────────────────────────────────────────────────────────
create policy as_subscriptions_select on as_subscriptions
  for select to authenticated
  using (
    archon_is_project_client(project_id)
    or archon_is_contract_partner(project_id)
    or archon_is_admin()
  );

create policy as_subscriptions_write on as_subscriptions
  for all to authenticated
  using (archon_is_project_client(project_id) or archon_is_admin())
  with check (archon_is_project_client(project_id) or archon_is_admin());

create policy as_payment_logs_select on as_payment_logs
  for select to authenticated
  using (
    exists (
      select 1 from as_subscriptions s
      where s.id = subscription_id
        and (
          archon_is_project_client(s.project_id)
          or archon_is_admin()
        )
    )
  );

-- 결제 기록은 PG 웹훅(service_role)이 남긴다. 클라이언트에는 쓰기 정책이 없다.

-- ── system_audit_logs ───────────────────────────────────────────────────────
-- UPDATE·DELETE 정책을 아예 만들지 않는다. RLS 기본 거부 + 트리거로 이중 방어.
create policy system_audit_logs_select on system_audit_logs
  for select to authenticated
  using (
    archon_is_project_client(project_id)
    or archon_is_project_partner(project_id)
    or archon_is_admin()
  );

create policy system_audit_logs_insert on system_audit_logs
  for insert to authenticated
  with check (
    actor_id = archon_uid()
    and (
      archon_is_project_client(project_id)
      or archon_is_project_partner(project_id)
      or archon_is_admin()
    )
  );

-- 권한 자체도 회수해 service_role 이외에는 변경 경로를 남기지 않는다
revoke update, delete, truncate on system_audit_logs from authenticated, anon;

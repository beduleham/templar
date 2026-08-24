-- ============================================================================
-- 아칸 (Archon) — 전체 스키마 (Supabase SQL Editor 붙여넣기용)
--
-- supabase/migrations/ 의 3개 마이그레이션을 순서대로 합친 파일이다.
-- Supabase 대시보드 → SQL Editor → New query 에 통째로 붙여넣고 Run 하면 된다.
-- (supabase CLI를 쓴다면 이 파일 대신 `supabase db push` 를 사용한다)
--
-- 실행 후 확인:
--   select count(*) from pg_tables where schemaname = 'public';        -- 13
--   select count(*) from pg_policies where schemaname = 'public';      -- 32
--
-- 데모 데이터가 필요하면 이어서 supabase/seed.sql 을 실행한다.
-- ============================================================================


-- ▼▼▼ 20260824000001_init_schema.sql ▼▼▼

-- ============================================================================
-- 아칸(Archon) 초기 스키마
-- src/lib/domain/types.ts 의 도메인 모델과 1:1로 대응한다.
-- 금액은 원(KRW) 단위 정수이므로 bigint, 공수(M/D)는 numeric(6,2)를 쓴다.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── 열거형 ──────────────────────────────────────────────────────────────────
create type user_role as enum ('client', 'partner', 'admin');

create type project_status as enum (
  'draft', 'bidding', 'active', 'completed', 'disputed'
);

create type spec_task_status as enum ('todo', 'in_progress', 'done');

-- 입찰은 draft 로 만들어 항목을 채운 뒤 submitted 로 제출한다.
-- (클라이언트가 REST로 붙는 구조라 입찰 행과 견적 항목이 다른 트랜잭션으로 들어온다)
create type bid_status as enum ('draft', 'submitted', 'accepted', 'rejected');

create type milestone_status as enum (
  'pending',
  'escrow_deposited',
  'inspection_requested',
  'released',
  'override_settled',   -- 운영사 강제 정산
  'override_refunded'   -- 운영사 강제 환불
);

create type audit_action_type as enum (
  'PROJECT_CREATED',
  'NDA_SIGNED',
  'BID_SUBMITTED',
  'BID_ACCEPTED',
  'CONTRACT_CREATED',
  'ESCROW_DEPOSITED',
  'TASK_STATUS_UPDATE',
  'MILESTONE_INSPECTION_REQUESTED',
  'MILESTONE_INSPECTION_REJECTED',
  'MILESTONE_RELEASED',
  'DISPUTE_RAISED',
  'ADMIN_OVERRIDE_SETTLE',
  'ADMIN_OVERRIDE_REFUND',
  'SUBSCRIPTION_STARTED',
  'SUBSCRIPTION_PAYMENT',
  'SUBSCRIPTION_CANCEL_SCHEDULED'
);

create type as_tier as enum ('light', 'standard', 'premium');

create type as_subscription_status as enum (
  'active', 'active_scheduled_cancel', 'paused', 'terminated'
);

create type as_payment_status as enum ('success', 'failed');

-- ── 공용 트리거 함수 ────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── profiles ────────────────────────────────────────────────────────────────
-- Supabase auth.users 를 1:1로 확장한다. 앱은 auth.users 를 직접 읽지 않는다.
create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 60),
  company       text,
  role          user_role not null default 'client',
  -- 파트너 매칭 적합도 계산에 쓰는 기술 태그
  tech_tags     text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_role_idx on profiles (role);
create index profiles_tech_tags_idx on profiles using gin (tech_tags);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ── projects ────────────────────────────────────────────────────────────────
create table projects (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(btrim(title)) between 1 and 120),
  summary         text not null default '',
  client_id       uuid not null references profiles (id) on delete restrict,
  tech_tags       text[] not null default '{}',
  spec_markdown   text not null default '',
  mermaid_code    text not null default '',
  status          project_status not null default 'draft',
  -- status = 'disputed' 일 때만 채워진다 (아래 CHECK로 강제)
  dispute_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint projects_dispute_reason_required check (
    (status = 'disputed' and dispute_reason is not null
      and length(btrim(dispute_reason)) >= 10)
    or (status <> 'disputed')
  )
);

create index projects_client_id_idx on projects (client_id);
create index projects_status_idx on projects (status);
create index projects_tech_tags_idx on projects using gin (tech_tags);

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ── 스펙 계층: epic → feature → task ────────────────────────────────────────
create table spec_epics (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  title       text not null,
  sort_order  smallint not null default 0,
  unique (project_id, sort_order)
);

create index spec_epics_project_id_idx on spec_epics (project_id);

create table spec_features (
  id          uuid primary key default gen_random_uuid(),
  epic_id     uuid not null references spec_epics (id) on delete cascade,
  title       text not null,
  sort_order  smallint not null default 0,
  unique (epic_id, sort_order)
);

create index spec_features_epic_id_idx on spec_features (epic_id);

create table spec_tasks (
  id              uuid primary key default gen_random_uuid(),
  feature_id      uuid not null references spec_features (id) on delete cascade,
  -- RLS 판정과 조회 성능을 위해 비정규화한다. 트리거로 일관성을 보장한다.
  project_id      uuid not null references projects (id) on delete cascade,
  title           text not null,
  description     text not null default '',
  milestone_phase smallint not null check (milestone_phase in (1, 2, 3)),
  -- Mermaid 노드 ID. null이면 아키텍처 맵과 매핑되지 않는다.
  node_id         text,
  status          spec_task_status not null default 'todo',
  estimated_md    numeric(6, 2) not null default 0 check (estimated_md >= 0),
  sort_order      smallint not null default 0,
  updated_at      timestamptz not null default now()
);

create index spec_tasks_feature_id_idx on spec_tasks (feature_id);
create index spec_tasks_project_id_idx on spec_tasks (project_id);
create index spec_tasks_project_phase_idx on spec_tasks (project_id, milestone_phase);
-- 한 프로젝트 안에서 노드 ID는 중복되지 않는다 (칸반 ↔ 설계도 1:1 동기화)
create unique index spec_tasks_project_node_idx
  on spec_tasks (project_id, node_id)
  where node_id is not null;

create trigger spec_tasks_set_updated_at
  before update on spec_tasks
  for each row execute function set_updated_at();

-- ── project_ndas ────────────────────────────────────────────────────────────
create table project_ndas (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  signer_name     text not null check (length(btrim(signer_name)) > 0),
  signer_company  text not null check (length(btrim(signer_company)) > 0),
  signed_at       timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_ndas_user_id_idx on project_ndas (user_id);

-- ── bids / bid_items ────────────────────────────────────────────────────────
create table bids (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects (id) on delete cascade,
  partner_id       uuid not null references profiles (id) on delete restrict,
  total_amount     bigint not null default 0 check (total_amount >= 0),
  total_man_days   numeric(8, 2) not null default 0 check (total_man_days >= 0),
  status           bid_status not null default 'draft',
  -- 레이더 차트용 정성 점수 (0~100). 비용·일정 축은 입찰 간 상대 비교로 산출한다.
  tech_score       smallint not null default 0 check (tech_score between 0 and 100),
  comm_score       smallint not null default 0 check (comm_score between 0 and 100),
  portfolio_score  smallint not null default 0 check (portfolio_score between 0 and 100),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- 한 파트너는 한 프로젝트에 한 번만 입찰한다
  unique (project_id, partner_id)
);

create index bids_project_id_idx on bids (project_id);
create index bids_partner_id_idx on bids (partner_id);
-- 프로젝트당 선정된 입찰은 최대 1건
create unique index bids_one_accepted_per_project_idx
  on bids (project_id)
  where status = 'accepted';

create trigger bids_set_updated_at
  before update on bids
  for each row execute function set_updated_at();

create table bid_items (
  id                uuid primary key default gen_random_uuid(),
  bid_id            uuid not null references bids (id) on delete cascade,
  task_id           uuid not null references spec_tasks (id) on delete cascade,
  man_day           numeric(6, 2) not null check (man_day > 0),
  unit_price        bigint not null check (unit_price > 0),
  -- 공수 산정 근거 — 의뢰자 비교 화면 호버 툴팁에 노출된다
  estimation_basis  text,
  -- 항목 금액은 저장하지 않고 계산한다 (단일 진실 공급원)
  amount            bigint generated always as (round(man_day * unit_price)::bigint) stored,
  unique (bid_id, task_id)
);

create index bid_items_bid_id_idx on bid_items (bid_id);
create index bid_items_task_id_idx on bid_items (task_id);

-- ── contracts ───────────────────────────────────────────────────────────────
create table contracts (
  id            uuid primary key default gen_random_uuid(),
  -- 프로젝트당 계약은 1건
  project_id    uuid not null unique references projects (id) on delete cascade,
  bid_id        uuid not null unique references bids (id) on delete restrict,
  partner_id    uuid not null references profiles (id) on delete restrict,
  total_amount  bigint not null check (total_amount > 0),
  signed_at     timestamptz not null default now()
);

create index contracts_partner_id_idx on contracts (partner_id);

-- ── milestones ──────────────────────────────────────────────────────────────
create table milestones (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects (id) on delete cascade,
  contract_id       uuid not null references contracts (id) on delete cascade,
  phase             smallint not null check (phase in (1, 2, 3)),
  ratio             numeric(3, 2) not null,
  amount            bigint not null check (amount > 0),
  status            milestone_status not null default 'pending',
  inspection_notes  text,
  reject_reason     text,
  updated_at        timestamptz not null default now(),
  unique (contract_id, phase),
  -- 50/30/20 분할은 정책상 고정값이다. 단계별 비율을 스키마에서 못 박는다.
  constraint milestones_fixed_ratio check (
    (phase = 1 and ratio = 0.50) or
    (phase = 2 and ratio = 0.30) or
    (phase = 3 and ratio = 0.20)
  )
);

create index milestones_project_id_idx on milestones (project_id);
create index milestones_status_idx on milestones (status);

create trigger milestones_set_updated_at
  before update on milestones
  for each row execute function set_updated_at();

-- ── AS 구독 ─────────────────────────────────────────────────────────────────
create table as_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  -- 프로젝트당 구독은 1건
  project_id         uuid not null unique references projects (id) on delete cascade,
  tier               as_tier not null,
  status             as_subscription_status not null default 'active',
  -- PG사 발급 빌링키. 카드번호·CVC는 저장하지 않는다.
  billing_key        text not null,
  -- PG사가 내려준 마스킹 표기 (예: 신한 ****1234)
  card_label         text not null,
  price_monthly      bigint not null check (price_monthly > 0),
  next_billing_date  date not null,
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint as_subscriptions_no_raw_card check (
    billing_key !~ '[0-9]{13,}' and card_label !~ '[0-9]{9,}'
  )
);

create trigger as_subscriptions_set_updated_at
  before update on as_subscriptions
  for each row execute function set_updated_at();

create table as_payment_logs (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid not null references as_subscriptions (id) on delete cascade,
  amount           bigint not null check (amount >= 0),
  status           as_payment_status not null,
  -- PG사 거래 고유 ID
  transaction_id   text not null unique,
  error_message    text,
  paid_at          timestamptz not null default now()
);

create index as_payment_logs_subscription_id_idx
  on as_payment_logs (subscription_id, paid_at desc);

-- ── system_audit_logs (INSERT 전용) ─────────────────────────────────────────
create table system_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects (id) on delete restrict,
  actor_id      uuid references profiles (id) on delete set null,
  -- 계정이 삭제돼도 기록은 남아야 하므로 이름을 스냅샷으로 보관한다
  actor_name    text not null,
  action_type   audit_action_type not null,
  before_state  jsonb,
  after_state   jsonb,
  created_at    timestamptz not null default now()
);

create index system_audit_logs_project_id_idx
  on system_audit_logs (project_id, created_at desc);
create index system_audit_logs_action_type_idx on system_audit_logs (action_type);

-- ▼▼▼ 20260824000002_business_rules.sql ▼▼▼

-- ============================================================================
-- 비즈니스 규칙을 DB 계층에서 강제한다.
-- 애플리케이션 코드가 바뀌어도 아래 불변식은 깨지지 않아야 한다.
--   1) 감사 로그는 INSERT 전용 (수정·삭제 불가)
--   2) 마일스톤은 계약 체결 시 50/30/20으로 자동 생성되고 합계가 총액과 일치
--   3) 마일스톤 상태는 정해진 순서로만 전이
--   4) 입찰은 모든 최하위 태스크를 빠짐없이 견적해야 제출 가능
--   5) NDA에 서명하지 않은 파트너는 입찰 불가
--   6) spec_tasks.project_id 는 상위 계층과 항상 일치
-- ============================================================================

-- ── 1) 감사 로그 불변성 ─────────────────────────────────────────────────────
create or replace function archon_block_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    '감사 로그는 추가만 가능합니다 (시도한 작업: %)', tg_op
    using errcode = 'restrict_violation';
end;
$$;

create trigger system_audit_logs_immutable
  before update or delete on system_audit_logs
  for each row execute function archon_block_audit_mutation();

-- 테이블 전체 TRUNCATE 도 함께 막는다
create trigger system_audit_logs_no_truncate
  before truncate on system_audit_logs
  for each statement execute function archon_block_audit_mutation();

-- ── 6) spec_tasks.project_id 일관성 ─────────────────────────────────────────
create or replace function archon_sync_task_project()
returns trigger
language plpgsql
as $$
declare
  owner_project uuid;
begin
  select e.project_id into owner_project
  from spec_features f
  join spec_epics e on e.id = f.epic_id
  where f.id = new.feature_id;

  if owner_project is null then
    raise exception '존재하지 않는 feature_id 입니다: %', new.feature_id;
  end if;

  -- 비정규화 컬럼은 항상 상위 계층에서 파생시킨다
  new.project_id := owner_project;
  return new;
end;
$$;

create trigger spec_tasks_sync_project
  before insert or update of feature_id, project_id on spec_tasks
  for each row execute function archon_sync_task_project();

-- ── 2) 계약 체결 → 50/30/20 마일스톤 자동 생성 ──────────────────────────────
-- 1·2단계는 버림, 3단계는 잔액 보정이라 세 금액의 합은 항상 총액과 같다.
create or replace function archon_split_milestones(total bigint)
returns table (phase smallint, ratio numeric, amount bigint)
language sql
immutable
as $$
  with parts as (
    select
      floor(total * 0.5)::bigint as m1,
      floor(total * 0.3)::bigint as m2
  )
  select 1::smallint, 0.50::numeric, m1 from parts
  union all
  select 2::smallint, 0.30::numeric, m2 from parts
  union all
  select 3::smallint, 0.20::numeric, total - m1 - m2 from parts;
$$;

create or replace function archon_create_milestones()
returns trigger
language plpgsql
as $$
begin
  insert into milestones (project_id, contract_id, phase, ratio, amount)
  select new.project_id, new.id, s.phase, s.ratio, s.amount
  from archon_split_milestones(new.total_amount) s;
  return new;
end;
$$;

create trigger contracts_create_milestones
  after insert on contracts
  for each row execute function archon_create_milestones();

-- 마일스톤 합계 = 계약 총액 (수동 편집까지 방어, 커밋 시점에 검사)
create or replace function archon_assert_milestone_sum()
returns trigger
language plpgsql
as $$
declare
  target_contract uuid := coalesce(new.contract_id, old.contract_id);
  contract_total  bigint;
  milestone_total bigint;
  milestone_count int;
begin
  select total_amount into contract_total
  from contracts where id = target_contract;

  -- 계약이 함께 삭제된 경우는 검사할 대상이 없다
  if contract_total is null then
    return null;
  end if;

  select coalesce(sum(amount), 0), count(*)
  into milestone_total, milestone_count
  from milestones where contract_id = target_contract;

  if milestone_count <> 3 then
    raise exception '계약 %의 마일스톤은 정확히 3단계여야 합니다 (현재 %단계)',
      target_contract, milestone_count;
  end if;

  if milestone_total <> contract_total then
    raise exception '마일스톤 합계(%)가 계약 총액(%)과 다릅니다',
      milestone_total, contract_total;
  end if;

  return null;
end;
$$;

create constraint trigger milestones_assert_sum
  after insert or update or delete on milestones
  deferrable initially deferred
  for each row execute function archon_assert_milestone_sum();

-- ── 3) 마일스톤 상태 전이 ───────────────────────────────────────────────────
create or replace function archon_is_milestone_closed(s milestone_status)
returns boolean
language sql
immutable
as $$
  select s in ('released', 'override_settled', 'override_refunded');
$$;

create or replace function archon_check_milestone_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if archon_is_milestone_closed(old.status) then
    raise exception '정산이 끝난 마일스톤은 상태를 바꿀 수 없습니다 (% → %)',
      old.status, new.status;
  end if;

  -- 운영사 강제 조정은 종료 전 어느 상태에서든 가능하다
  if new.status in ('override_settled', 'override_refunded') then
    return new;
  end if;

  if not (
    (old.status = 'pending'               and new.status = 'escrow_deposited') or
    (old.status = 'escrow_deposited'      and new.status = 'inspection_requested') or
    (old.status = 'inspection_requested'  and new.status = 'released') or
    -- 검수 반려 → 다시 개발 단계로
    (old.status = 'inspection_requested'  and new.status = 'escrow_deposited')
  ) then
    raise exception '허용되지 않는 마일스톤 상태 전이입니다 (% → %)',
      old.status, new.status;
  end if;

  -- 반려 시에는 사유가 반드시 남아야 한다
  if old.status = 'inspection_requested' and new.status = 'escrow_deposited'
     and (new.reject_reason is null or length(btrim(new.reject_reason)) < 10) then
    raise exception '검수 반려에는 10자 이상의 사유가 필요합니다';
  end if;

  return new;
end;
$$;

create trigger milestones_check_transition
  before update on milestones
  for each row execute function archon_check_milestone_transition();

-- ── 4) 입찰 총액 재계산 + 전 태스크 견적 강제 ───────────────────────────────
create or replace function archon_recalc_bid_totals()
returns trigger
language plpgsql
as $$
declare
  target_bid uuid := coalesce(new.bid_id, old.bid_id);
begin
  update bids b
  set total_amount = coalesce(agg.sum_amount, 0),
      total_man_days = coalesce(agg.sum_md, 0)
  from (
    select
      sum(amount)  as sum_amount,
      sum(man_day) as sum_md
    from bid_items where bid_id = target_bid
  ) agg
  where b.id = target_bid;

  return null;
end;
$$;

create trigger bid_items_recalc_totals
  after insert or update or delete on bid_items
  for each row execute function archon_recalc_bid_totals();

-- 견적 항목은 해당 입찰이 속한 프로젝트의 태스크만 참조할 수 있다
create or replace function archon_check_bid_item_scope()
returns trigger
language plpgsql
as $$
declare
  bid_project  uuid;
  task_project uuid;
begin
  select project_id into bid_project from bids where id = new.bid_id;
  select project_id into task_project from spec_tasks where id = new.task_id;

  if bid_project is distinct from task_project then
    raise exception '다른 프로젝트의 태스크에는 견적을 넣을 수 없습니다';
  end if;

  return new;
end;
$$;

create trigger bid_items_check_scope
  before insert or update on bid_items
  for each row execute function archon_check_bid_item_scope();

-- 입찰은 draft 로 생성해 항목을 채운 뒤 submitted 로 전이한다.
-- 제출 시점에 모든 최하위 태스크가 견적됐는지 검사한다.
create or replace function archon_assert_bid_complete()
returns trigger
language plpgsql
as $$
declare
  task_count    int;
  quoted_count  int;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception
        '입찰은 draft 로 생성한 뒤 견적 항목을 채우고 제출해야 합니다';
    end if;
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  if new.status = 'accepted' and old.status <> 'submitted' then
    raise exception '제출되지 않은 입찰은 선정할 수 없습니다 (현재: %)', old.status;
  end if;

  if new.status <> 'submitted' then
    return new;
  end if;

  select count(*) into task_count
  from spec_tasks where project_id = new.project_id;

  select count(*) into quoted_count
  from bid_items where bid_id = new.id;

  if task_count = 0 then
    raise exception '태스크가 없는 프로젝트에는 입찰할 수 없습니다';
  end if;

  if quoted_count <> task_count then
    raise exception
      '모든 태스크에 견적이 필요합니다 (견적 %건 / 태스크 %건)',
      quoted_count, task_count;
  end if;

  return new;
end;
$$;

create trigger bids_assert_complete
  before insert or update on bids
  for each row execute function archon_assert_bid_complete();

-- ── 5) NDA 서명 없이는 입찰 불가 ────────────────────────────────────────────
create or replace function archon_check_nda_before_bid()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from project_ndas
    where project_id = new.project_id and user_id = new.partner_id
  ) then
    raise exception 'NDA에 서명해야 입찰할 수 있습니다';
  end if;

  return new;
end;
$$;

create trigger bids_check_nda
  before insert on bids
  for each row execute function archon_check_nda_before_bid();

-- ── 입찰 선정 시 프로젝트·나머지 입찰 정리 ──────────────────────────────────
create or replace function archon_on_bid_accepted()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    -- 같은 프로젝트의 다른 입찰은 자동 탈락 처리
    update bids
    set status = 'rejected'
    where project_id = new.project_id
      and id <> new.id
      and status = 'submitted';
  end if;

  return null;
end;
$$;

create trigger bids_on_accepted
  after update of status on bids
  for each row execute function archon_on_bid_accepted();

-- ▼▼▼ 20260824000003_rls_policies.sql ▼▼▼

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

-- ── 역할별 권한 ─────────────────────────────────────────────────────────────
-- RLS는 "권한이 있는 역할"에 대해서만 의미가 있다. 권한 자체를 명시해
-- 호스팅 환경의 기본값에 의존하지 않는다.
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on projects, spec_epics, spec_features, spec_tasks, project_ndas,
     bids, bid_items, contracts, milestones, as_subscriptions
  to authenticated;

grant select, update on profiles to authenticated;
grant insert on profiles to authenticated;
grant select on as_payment_logs to authenticated;

-- 감사 로그는 조회와 추가만 가능하다
grant select, insert on system_audit_logs to authenticated;
revoke update, delete, truncate on system_audit_logs from authenticated, anon;

-- 비로그인(anon)에는 어떤 테이블 권한도 주지 않는다.
-- 정책 이전에 권한 단계에서 먼저 막힌다.

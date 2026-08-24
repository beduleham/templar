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

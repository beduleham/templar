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

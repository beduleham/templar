/**
 * Supabase 테이블 행 → 도메인 모델 변환.
 *
 * 순수 함수만 두어 네트워크 없이 검증할 수 있게 한다. 조회 로직(어떤 테이블을
 * 어떤 순서로 읽을지)은 레포지토리가 맡고, 여기서는 모양만 바꾼다.
 *
 * PostgREST 는 numeric/bigint 를 JSON 숫자로 내려주지만 드라이버·버전에 따라
 * 문자열로 오는 경우가 있어 숫자 컬럼은 모두 명시적으로 변환한다.
 */

import type {
  AsPaymentLog,
  AsSubscription,
  AuditLog,
  Bid,
  BidItem,
  Contract,
  Milestone,
  MilestonePhase,
  NdaSignature,
  Project,
  SpecEpic,
  SpecFeature,
  SpecTask,
} from "@/lib/domain/types";

import type {
  AsPaymentLogRow,
  AsSubscriptionRow,
  BidItemRow,
  BidRow,
  ContractRow,
  MilestoneRow,
  ProfileRow,
  ProjectNdaRow,
  ProjectRow,
  SpecEpicRow,
  SpecFeatureRow,
  SpecTaskRow,
  SystemAuditLogRow,
} from "./database.types";

function num(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

/** id → 표시 이름. 프로필을 찾지 못하면 식별자를 그대로 노출하지 않는다. */
export type ProfileLookup = ReadonlyMap<string, ProfileRow>;

function displayName(profiles: ProfileLookup, id: string | null): string {
  if (id === null) return "알 수 없음";
  return profiles.get(id)?.name ?? "알 수 없음";
}

export function toSpecTask(row: SpecTaskRow): SpecTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    milestonePhase: row.milestone_phase,
    nodeId: row.node_id,
    status: row.status,
    estimatedMd: num(row.estimated_md),
  };
}

/**
 * 에픽 → 피처 → 태스크 계층을 조립한다.
 * 각 단계는 sort_order 로 정렬해 화면 순서가 저장 순서와 무관하게 안정적이다.
 */
export function toSpecHierarchy(
  epics: readonly SpecEpicRow[],
  features: readonly SpecFeatureRow[],
  tasks: readonly SpecTaskRow[],
): SpecEpic[] {
  const tasksByFeature = new Map<string, SpecTaskRow[]>();
  for (const task of tasks) {
    const bucket = tasksByFeature.get(task.feature_id);
    if (bucket === undefined) {
      tasksByFeature.set(task.feature_id, [task]);
    } else {
      bucket.push(task);
    }
  }

  const featuresByEpic = new Map<string, SpecFeatureRow[]>();
  for (const feature of features) {
    const bucket = featuresByEpic.get(feature.epic_id);
    if (bucket === undefined) {
      featuresByEpic.set(feature.epic_id, [feature]);
    } else {
      bucket.push(feature);
    }
  }

  const byOrder = <T extends { sort_order: number }>(a: T, b: T): number =>
    a.sort_order - b.sort_order;

  return [...epics].sort(byOrder).map((epic): SpecEpic => {
    const epicFeatures = (featuresByEpic.get(epic.id) ?? [])
      .slice()
      .sort(byOrder);

    return {
      id: epic.id,
      title: epic.title,
      features: epicFeatures.map(
        (feature): SpecFeature => ({
          id: feature.id,
          title: feature.title,
          tasks: (tasksByFeature.get(feature.id) ?? [])
            .slice()
            .sort(byOrder)
            .map(toSpecTask),
        }),
      ),
    };
  });
}

export function toNdaSignature(row: ProjectNdaRow): NdaSignature {
  return {
    userId: row.user_id,
    signerName: row.signer_name,
    signerCompany: row.signer_company,
    signedAt: row.signed_at,
  };
}

export function toBidItem(row: BidItemRow): BidItem {
  return {
    manDay: num(row.man_day),
    unitPrice: num(row.unit_price),
    estimationBasis: row.estimation_basis,
  };
}

/**
 * 입찰 행과 견적 항목을 합친다.
 * DB 의 draft 상태는 도메인에 없다 — 제출 전 입찰은 호출부에서 걸러야 한다.
 */
export function toBid(
  row: BidRow,
  items: readonly BidItemRow[],
  profiles: ProfileLookup,
): Bid | null {
  if (row.status === "draft") return null;

  const bidItems: Record<string, BidItem> = {};
  for (const item of items) {
    if (item.bid_id === row.id) {
      bidItems[item.task_id] = toBidItem(item);
    }
  }

  return {
    id: row.id,
    projectId: row.project_id,
    partnerId: row.partner_id,
    partnerName: displayName(profiles, row.partner_id),
    items: bidItems,
    totalAmount: num(row.total_amount),
    totalManDays: num(row.total_man_days),
    status: row.status,
    scores: {
      techScore: row.tech_score,
      commScore: row.comm_score,
      portfolioScore: row.portfolio_score,
    },
    createdAt: row.created_at,
  };
}

export function toContract(row: ContractRow, profiles: ProfileLookup): Contract {
  return {
    id: row.id,
    bidId: row.bid_id,
    partnerId: row.partner_id,
    partnerName: displayName(profiles, row.partner_id),
    totalAmount: num(row.total_amount),
    signedAt: row.signed_at,
  };
}

export function toMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    phase: row.phase,
    ratio: num(row.ratio),
    amount: num(row.amount),
    status: row.status,
    inspectionNotes: row.inspection_notes,
    rejectReason: row.reject_reason,
    updatedAt: row.updated_at,
  };
}

export function toAsPaymentLog(row: AsPaymentLogRow): AsPaymentLog {
  return {
    id: row.id,
    amount: num(row.amount),
    status: row.status,
    transactionId: row.transaction_id,
    errorMessage: row.error_message,
    paidAt: row.paid_at,
  };
}

export function toAsSubscription(
  row: AsSubscriptionRow,
  payments: readonly AsPaymentLogRow[],
): AsSubscription {
  return {
    id: row.id,
    tier: row.tier,
    status: row.status,
    billingKey: row.billing_key,
    cardLabel: row.card_label,
    priceMonthly: num(row.price_monthly),
    nextBillingDate: row.next_billing_date,
    cancelledAt: row.cancelled_at,
    payments: payments
      .filter((payment) => payment.subscription_id === row.id)
      .map(toAsPaymentLog)
      // 최신 결제가 위로 오도록 정렬한다
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    createdAt: row.created_at,
  };
}

export function toAuditLog(row: SystemAuditLogRow): AuditLog {
  return {
    id: row.id,
    projectId: row.project_id,
    actorId: row.actor_id ?? "",
    actorName: row.actor_name,
    actionType: row.action_type,
    beforeState: row.before_state,
    afterState: row.after_state,
    createdAt: row.created_at,
  };
}

/** 프로젝트 하나를 구성하는 모든 행 */
export interface ProjectRowBundle {
  project: ProjectRow;
  epics: readonly SpecEpicRow[];
  features: readonly SpecFeatureRow[];
  tasks: readonly SpecTaskRow[];
  ndas: readonly ProjectNdaRow[];
  bids: readonly BidRow[];
  bidItems: readonly BidItemRow[];
  contract: ContractRow | null;
  milestones: readonly MilestoneRow[];
  subscription: AsSubscriptionRow | null;
  payments: readonly AsPaymentLogRow[];
  profiles: ProfileLookup;
}

export function toProject(bundle: ProjectRowBundle): Project {
  const { project, profiles } = bundle;

  const bids = bundle.bids
    .map((row) => toBid(row, bundle.bidItems, profiles))
    .filter((bid): bid is Bid => bid !== null);

  const milestones = [...bundle.milestones]
    .map(toMilestone)
    .sort((a, b) => a.phase - b.phase);

  return {
    id: project.id,
    title: project.title,
    summary: project.summary,
    clientId: project.client_id,
    clientName: displayName(profiles, project.client_id),
    techTags: project.tech_tags,
    specMarkdown: project.spec_markdown,
    mermaidCode: project.mermaid_code,
    epics: toSpecHierarchy(bundle.epics, bundle.features, bundle.tasks),
    status: project.status,
    ndaSignatures: bundle.ndas.map(toNdaSignature),
    bids,
    contract:
      bundle.contract === null ? null : toContract(bundle.contract, profiles),
    milestones,
    disputeReason: project.dispute_reason,
    subscription:
      bundle.subscription === null
        ? null
        : toAsSubscription(bundle.subscription, bundle.payments),
    createdAt: project.created_at,
  };
}

/** 마일스톤 단계는 DB CHECK 로 1·2·3 만 허용된다 */
export function isMilestonePhase(value: number): value is MilestonePhase {
  return value === 1 || value === 2 || value === 3;
}

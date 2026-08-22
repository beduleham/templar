/**
 * 아칸 도메인 모델.
 * Supabase 스키마(projects / project_specs / tasks / project_ndas / bids /
 * bid_items / contracts / milestones / system_audit_logs)와 동형으로 설계되어,
 * Supabase 연동 시 자동 생성 타입과 1:1로 교체된다.
 */

export type MilestonePhase = 1 | 2 | 3;

export type SpecTaskStatus = "todo" | "in_progress" | "done";

/** 최하위 태스크 — 입찰(M/D 견적)·칸반·아키텍처 노드 매핑의 단위 */
export interface SpecTask {
  id: string;
  title: string;
  description: string;
  milestonePhase: MilestonePhase;
  /** Mermaid 다이어그램 노드 ID (없으면 아키텍처 맵과 매핑되지 않음) */
  nodeId: string | null;
  status: SpecTaskStatus;
  estimatedMd: number;
}

export interface SpecFeature {
  id: string;
  title: string;
  tasks: SpecTask[];
}

export interface SpecEpic {
  id: string;
  title: string;
  features: SpecFeature[];
}

export interface NdaSignature {
  userId: string;
  signerName: string;
  signerCompany: string;
  signedAt: string;
}

export interface BidItem {
  manDay: number;
  unitPrice: number;
  /** 공수 산정 근거 — 의뢰자 비교 화면에서 호버 툴팁으로 노출된다 */
  estimationBasis: string | null;
}

export type BidStatus = "submitted" | "accepted" | "rejected";

/** 레이더 차트용 다차원 역량 점수 (0~100 정규화) */
export interface BidScores {
  techScore: number;
  commScore: number;
  portfolioScore: number;
}

export interface Bid {
  id: string;
  projectId: string;
  partnerId: string;
  partnerName: string;
  /** taskId → 견적. 모든 최하위 태스크에 값이 있어야 제출 가능 */
  items: Record<string, BidItem>;
  totalAmount: number;
  totalManDays: number;
  status: BidStatus;
  /** 프로필 기반 정성 점수 — 비용·일정 점수는 입찰 간 상대 비교로 산출된다 */
  scores: BidScores;
  createdAt: string;
}

export type MilestoneStatus =
  | "pending"
  | "escrow_deposited"
  | "inspection_requested"
  | "released"
  /** 운영사 강제 정산 — 분쟁 조정으로 파트너에게 지급 */
  | "override_settled"
  /** 운영사 강제 환불 — 분쟁 조정으로 의뢰자에게 반환 */
  | "override_refunded";

export interface Milestone {
  id: string;
  phase: MilestonePhase;
  ratio: number; // 0.5 / 0.3 / 0.2 — 엄격 고정
  amount: number;
  status: MilestoneStatus;
  inspectionNotes: string | null;
  rejectReason: string | null;
  updatedAt: string;
}

export interface Contract {
  id: string;
  bidId: string;
  partnerId: string;
  partnerName: string;
  totalAmount: number;
  signedAt: string;
}

export type AuditActionType =
  | "PROJECT_CREATED"
  | "NDA_SIGNED"
  | "BID_SUBMITTED"
  | "BID_ACCEPTED"
  | "CONTRACT_CREATED"
  | "ESCROW_DEPOSITED"
  | "TASK_STATUS_UPDATE"
  | "MILESTONE_INSPECTION_REQUESTED"
  | "MILESTONE_INSPECTION_REJECTED"
  | "MILESTONE_RELEASED"
  | "DISPUTE_RAISED"
  | "ADMIN_OVERRIDE_SETTLE"
  | "ADMIN_OVERRIDE_REFUND"
  | "SUBSCRIPTION_STARTED"
  | "SUBSCRIPTION_PAYMENT"
  | "SUBSCRIPTION_CANCEL_SCHEDULED";

/** INSERT 전용 감사 로그 — 스토어는 append 외의 변경 API를 제공하지 않는다 */
export interface AuditLog {
  id: string;
  projectId: string;
  actorId: string;
  actorName: string;
  actionType: AuditActionType;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdAt: string;
}

export type ProjectStatus =
  | "draft"
  | "bidding"
  | "active"
  | "completed"
  /** 분쟁 중 — 운영사 조정 대상 */
  | "disputed";

/* ------------------------------------------------------------------ */
/* AS 구독 (as_subscriptions / as_payment_logs 동형)                    */
/* ------------------------------------------------------------------ */

export type AsSubscriptionTier = "light" | "standard" | "premium";

export type AsSubscriptionStatus =
  | "active"
  /** 해지 예약 — 다음 결제일까지 이용 후 종료 */
  | "active_scheduled_cancel"
  | "paused"
  | "terminated";

export interface AsPaymentLog {
  id: string;
  amount: number;
  status: "success" | "failed";
  /** PG사 거래 고유 ID — 카드 정보는 저장하지 않는다 */
  transactionId: string;
  errorMessage: string | null;
  paidAt: string;
}

export interface AsSubscription {
  id: string;
  tier: AsSubscriptionTier;
  status: AsSubscriptionStatus;
  /** PG사 발급 빌링키 — 카드번호·CVC는 플랫폼에 저장하지 않는다 */
  billingKey: string;
  /** 마스킹된 카드 표기 (PG사 응답값) */
  cardLabel: string;
  priceMonthly: number;
  nextBillingDate: string;
  cancelledAt: string | null;
  payments: AsPaymentLog[];
  createdAt: string;
}

export interface AsTierPlan {
  tier: AsSubscriptionTier;
  name: string;
  priceMonthly: number;
  summary: string;
  features: string[];
}

export const AS_TIER_PLANS: AsTierPlan[] = [
  {
    tier: "light",
    name: "라이트",
    priceMonthly: 100_000,
    summary: "가벼운 버그 수정과 상시 모니터링",
    features: [
      "장애 모니터링 및 알림",
      "월 3건 이내 버그 수정",
      "영업일 기준 2일 내 응답",
    ],
  },
  {
    tier: "standard",
    name: "스탠다드",
    priceMonthly: 300_000,
    summary: "기능 개선까지 포함한 가장 많이 쓰는 요금제",
    features: [
      "라이트의 모든 혜택",
      "월 10건 이내 버그 수정",
      "마이너 기능 개선 월 2건",
      "영업일 기준 1일 내 응답",
    ],
  },
  {
    tier: "premium",
    name: "프리미엄",
    priceMonthly: 1_000_000,
    summary: "전담 엔지니어가 긴급 장애까지 대응",
    features: [
      "스탠다드의 모든 혜택",
      "전담 엔지니어 배정",
      "긴급 장애 4시간 내 대응",
      "월간 운영 리포트 제공",
    ],
  },
];

export const AS_TIER_LABELS: Record<AsSubscriptionTier, string> = {
  light: "라이트",
  standard: "스탠다드",
  premium: "프리미엄",
};

export const AS_STATUS_LABELS: Record<AsSubscriptionStatus, string> = {
  active: "구독 중",
  active_scheduled_cancel: "해지 예약됨",
  paused: "결제 실패 · 일시 중지",
  terminated: "종료됨",
};

export interface Project {
  id: string;
  title: string;
  summary: string;
  clientId: string;
  clientName: string;
  /** 매칭 적합도 계산에 쓰는 기술 태그 */
  techTags: string[];
  specMarkdown: string;
  mermaidCode: string;
  epics: SpecEpic[];
  status: ProjectStatus;
  ndaSignatures: NdaSignature[];
  bids: Bid[];
  contract: Contract | null;
  milestones: Milestone[];
  /** 분쟁 신고 사유 — status가 disputed일 때만 채워진다 */
  disputeReason: string | null;
  /** 납품 후 AS 구독 — 계약 완료 프로젝트에서만 신청 가능 */
  subscription: AsSubscription | null;
  createdAt: string;
}

export interface DomainState {
  projects: Project[];
  auditLogs: AuditLog[];
}

export const MILESTONE_RATIOS: Record<MilestonePhase, number> = {
  1: 0.5,
  2: 0.3,
  3: 0.2,
};

export const MILESTONE_PHASE_LABELS: Record<MilestonePhase, string> = {
  1: "선금 50%",
  2: "중도금 30%",
  3: "잔금 20%",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "예치 대기",
  escrow_deposited: "에스크로 예치 완료",
  inspection_requested: "검수 대기 중",
  released: "정산 완료",
  override_settled: "운영사 강제 정산",
  override_refunded: "운영사 강제 환불",
};

/** 정산이 끝나 더 이상 진행할 것이 없는 마일스톤 상태 */
export function isMilestoneClosed(status: MilestoneStatus): boolean {
  return (
    status === "released" ||
    status === "override_settled" ||
    status === "override_refunded"
  );
}

export const AUDIT_ACTION_LABELS: Record<AuditActionType, string> = {
  PROJECT_CREATED: "프로젝트 생성",
  NDA_SIGNED: "NDA 서명",
  BID_SUBMITTED: "입찰 제출",
  BID_ACCEPTED: "입찰 선정",
  CONTRACT_CREATED: "계약 체결",
  ESCROW_DEPOSITED: "에스크로 예치",
  TASK_STATUS_UPDATE: "태스크 상태 변경",
  MILESTONE_INSPECTION_REQUESTED: "마일스톤 검수 요청",
  MILESTONE_INSPECTION_REJECTED: "마일스톤 검수 반려",
  MILESTONE_RELEASED: "마일스톤 정산 완료",
  DISPUTE_RAISED: "분쟁 신고",
  ADMIN_OVERRIDE_SETTLE: "운영사 강제 정산",
  ADMIN_OVERRIDE_REFUND: "운영사 강제 환불",
  SUBSCRIPTION_STARTED: "AS 구독 시작",
  SUBSCRIPTION_PAYMENT: "AS 구독 결제",
  SUBSCRIPTION_CANCEL_SCHEDULED: "AS 구독 해지 예약",
};

/** 프로젝트의 모든 최하위 태스크를 평탄화 */
export function flattenTasks(project: Project): SpecTask[] {
  return project.epics.flatMap((epic) =>
    epic.features.flatMap((feature) => feature.tasks)
  );
}

/** 완료 태스크 기준 공정률(%) — 소수점 첫째 자리 */
export function calcProgressRate(project: Project): number {
  const tasks = flattenTasks(project);
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 1000) / 10;
}

/**
 * 50/30/20 금액 분할 — 1·2단계는 버림, 3단계는 잔액 보정으로
 * 세 마일스톤 합이 항상 총액과 일치한다.
 */
export function splitMilestoneAmounts(
  totalAmount: number
): Record<MilestonePhase, number> {
  const first = Math.floor(totalAmount * MILESTONE_RATIOS[1]);
  const second = Math.floor(totalAmount * MILESTONE_RATIOS[2]);
  const third = totalAmount - first - second;
  return { 1: first, 2: second, 3: third };
}

export function formatKrw(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

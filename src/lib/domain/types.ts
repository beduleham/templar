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
}

export type BidStatus = "submitted" | "accepted" | "rejected";

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
  createdAt: string;
}

export type MilestoneStatus =
  | "pending"
  | "escrow_deposited"
  | "inspection_requested"
  | "released";

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
  | "MILESTONE_RELEASED";

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
  | "completed";

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
};

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

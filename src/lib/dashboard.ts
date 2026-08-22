import type { UserRole } from "@/lib/navigation";

/**
 * Supabase 스키마(profiles / projects / system_audit_logs)를 그대로 반영한 타입.
 * Supabase 연동 태스크에서 자동 생성 타입(supabase gen types)으로 교체된다.
 */
export type ProjectStatus = "draft" | "bidding" | "active" | "completed";
export type MilestoneStage = "advance" | "interim" | "final";

export interface ProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  milestone: MilestoneStage;
  budget: number;
  progressRate: number; // 0 ~ 100
  updatedAt: string;
}

export type ActivityType =
  | "spec_generated"
  | "bid_submitted"
  | "milestone_review_requested"
  | "task_completed"
  | "payment_deposited";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  message: string;
  projectTitle: string;
  createdAt: string;
}

export interface DashboardMetrics {
  activeProjects: number;
  /** client: 총 예치 금액(에스크로) / partner: 정산 예정 금액 */
  totalAmount: number;
  /** client: 평균 공정률(%) / partner: 완료된 태스크 수 */
  progressOrTasks: number;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "스펙 작성 중",
  bidding: "입찰 진행 중",
  active: "개발 진행 중",
  completed: "완료",
};

export const MILESTONE_LABELS: Record<MilestoneStage, string> = {
  advance: "선금 50%",
  interim: "중도금 30%",
  final: "잔금 20%",
};

export function formatKrw(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

const MOCK_LATENCY_MS = 450;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MOCK_PROJECTS: ProjectSummary[] = [
  {
    id: "prj-1",
    title: "펫시터 예약·결제 플랫폼",
    status: "active",
    milestone: "interim",
    budget: 28_000_000,
    progressRate: 72,
    updatedAt: "10분 전",
  },
  {
    id: "prj-2",
    title: "사내 재고 관리 시스템",
    status: "active",
    milestone: "advance",
    budget: 17_000_000,
    progressRate: 34,
    updatedAt: "1시간 전",
  },
  {
    id: "prj-3",
    title: "헬스케어 구독 커머스",
    status: "bidding",
    milestone: "advance",
    budget: 42_000_000,
    progressRate: 0,
    updatedAt: "3시간 전",
  },
  {
    id: "prj-4",
    title: "학원 출결 알림 서비스",
    status: "completed",
    milestone: "final",
    budget: 9_500_000,
    progressRate: 100,
    updatedAt: "2일 전",
  },
  {
    id: "prj-5",
    title: "물류사 배차 최적화 대시보드",
    status: "draft",
    milestone: "advance",
    budget: 0,
    progressRate: 0,
    updatedAt: "4일 전",
  },
];

const MOCK_ACTIVITIES: ActivityEntry[] = [
  {
    id: "act-1",
    type: "task_completed",
    message: "'결제 모듈 연동' 태스크가 완료됐어요",
    projectTitle: "펫시터 예약·결제 플랫폼",
    createdAt: "10분 전",
  },
  {
    id: "act-2",
    type: "milestone_review_requested",
    message: "중도금 마일스톤 검수가 요청됐어요",
    projectTitle: "펫시터 예약·결제 플랫폼",
    createdAt: "42분 전",
  },
  {
    id: "act-3",
    type: "bid_submitted",
    message: "새 입찰 2건이 등록됐어요",
    projectTitle: "헬스케어 구독 커머스",
    createdAt: "3시간 전",
  },
  {
    id: "act-4",
    type: "payment_deposited",
    message: "선금 ₩8,500,000이 에스크로에 예치됐어요",
    projectTitle: "사내 재고 관리 시스템",
    createdAt: "어제",
  },
  {
    id: "act-5",
    type: "spec_generated",
    message: "AI 스펙과 설계도 생성이 완료됐어요",
    projectTitle: "물류사 배차 최적화 대시보드",
    createdAt: "4일 전",
  },
];

/**
 * Mock 데이터 페처.
 * Supabase 연동 시 @/utils/supabase/server 기반 Server Actions
 * (getDashboardMetrics / getRecentProjects / getRecentActivities)로 교체된다.
 * LIMIT 5 규칙은 여기서도 동일하게 지킨다.
 */
export async function fetchDashboardMetrics(
  role: UserRole
): Promise<DashboardMetrics> {
  await delay(MOCK_LATENCY_MS);
  if (role === "partner") {
    return { activeProjects: 3, totalAmount: 27_500_000, progressOrTasks: 47 };
  }
  return { activeProjects: 2, totalAmount: 45_000_000, progressOrTasks: 53 };
}

export async function fetchRecentProjects(): Promise<ProjectSummary[]> {
  await delay(MOCK_LATENCY_MS);
  return MOCK_PROJECTS.slice(0, 5);
}

export async function fetchRecentActivities(): Promise<ActivityEntry[]> {
  await delay(MOCK_LATENCY_MS);
  return MOCK_ACTIVITIES.slice(0, 5);
}

// 대시보드 데이터 조회 API.
// 실제 백엔드(GET /api/dashboard/summary, /api/dashboard/recent)가 준비되기
// 전까지는 동일한 응답 형태의 Mock 데이터를 지연과 함께 반환한다.

export interface DashboardSummary {
  monthlyPlanCount: number
  pendingEstimateCount: number
  matchedMaterialCount: number
}

export type PlanStatus = 'IN_PROGRESS' | 'COMPLETED'
export type EstimateStatus = 'PENDING' | 'COMPLETED'

export interface RecentPlan {
  id: string
  title: string
  updatedAt: string
  status: PlanStatus
}

export interface RecentEstimate {
  id: string
  title: string
  totalPrice: number
  status: EstimateStatus
  updatedAt: string
}

export interface DashboardRecent {
  recentPlans: RecentPlan[]
  recentEstimates: RecentEstimate[]
}

const MOCK_DELAY_MS = 400

const mockSummary: DashboardSummary = {
  monthlyPlanCount: 12,
  pendingEstimateCount: 3,
  matchedMaterialCount: 45,
}

const mockRecent: DashboardRecent = {
  recentPlans: [
    {
      id: 'plan-101',
      title: "8월 4주차 만5세 '우주와 행성'",
      updatedAt: '2026-08-21T10:30:00Z',
      status: 'IN_PROGRESS',
    },
    {
      id: 'plan-100',
      title: "8월 3주차 만5세 '시원한 여름'",
      updatedAt: '2026-08-14T15:20:00Z',
      status: 'COMPLETED',
    },
    {
      id: 'plan-099',
      title: "8월 2주차 만4세 '바다 친구들'",
      updatedAt: '2026-08-07T09:10:00Z',
      status: 'COMPLETED',
    },
    {
      id: 'plan-098',
      title: "8월 월간계획 만3세 '여름과 놀이'",
      updatedAt: '2026-08-01T08:00:00Z',
      status: 'COMPLETED',
    },
  ],
  recentEstimates: [
    {
      id: 'est-201',
      title: '만5세 우주 과학 교구 세트 견적서',
      totalPrice: 450000,
      status: 'COMPLETED',
      updatedAt: '2026-08-21T11:00:00Z',
    },
    {
      id: 'est-200',
      title: '만3세 감각 놀이 블록 견적서',
      totalPrice: 280000,
      status: 'PENDING',
      updatedAt: '2026-08-19T09:15:00Z',
    },
    {
      id: 'est-199',
      title: '만4세 여름 미술놀이 재료 견적서',
      totalPrice: 132000,
      status: 'COMPLETED',
      updatedAt: '2026-08-12T14:40:00Z',
    },
  ],
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  await delay(MOCK_DELAY_MS)
  return mockSummary
}

export async function fetchDashboardRecent(): Promise<DashboardRecent> {
  await delay(MOCK_DELAY_MS)
  return mockRecent
}

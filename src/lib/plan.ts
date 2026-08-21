// 교육계획안 데이터 모델 및 조작 유틸 (순수 함수).
// Gemini API responseSchema와 동일한 구조를 사용해, 백엔드 연동 시 그대로 교체 가능하다.

export const NURI_AREAS = [
  '신체운동·건강',
  '의사소통',
  '사회관계',
  '예술경험',
  '자연탐구',
] as const

export type NuriArea = (typeof NURI_AREAS)[number]

export const TARGET_AGES = ['만 3세', '만 4세', '만 5세', '혼합반'] as const
export type TargetAge = (typeof TARGET_AGES)[number]

export type PlanType = 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export const planTypeLabels: Record<PlanType, string> = {
  WEEKLY: '주간',
  MONTHLY: '월간',
  YEARLY: '연간',
}

export const WEEKLY_PERIODS = ['월', '화', '수', '목', '금'] as const
export const MONTHLY_PERIODS = ['1주', '2주', '3주', '4주'] as const
// 연간 계획안: 학사 연도 기준 3월 시작 ~ 이듬해 2월
export const YEARLY_PERIODS = [
  '3월', '4월', '5월', '6월', '7월', '8월',
  '9월', '10월', '11월', '12월', '1월', '2월',
] as const

export const periodsForPlanType = (planType: PlanType): readonly string[] =>
  planType === 'WEEKLY'
    ? WEEKLY_PERIODS
    : planType === 'MONTHLY'
      ? MONTHLY_PERIODS
      : YEARLY_PERIODS

export interface PlanActivity {
  area: string
  activity_name: string
  description: string
  /** 활동 목표 */
  objective?: string
  /** 준비물 */
  materials?: string[]
}

export interface PlanPeriod {
  period: string
  activities: PlanActivity[]
}

export interface PlanContent {
  title: string
  target_age: string
  theme: string
  goals: string[]
  schedule: PlanPeriod[]
}

export interface GeneratePlanParams {
  targetAge: TargetAge
  planType: PlanType
  theme: string
  subTheme?: string
}

export interface SavedPlan {
  id: string
  planType: PlanType
  content: PlanContent
  createdAt: string
  updatedAt: string
}

/** 누리과정 5대 영역이 모든 기간에 포함되어 있는지 검증한다. */
export function validatePlanContent(content: PlanContent): boolean {
  if (!content.title || !content.schedule.length) return false
  return content.schedule.every((period) => {
    const areas = new Set(period.activities.map((a) => a.area))
    return NURI_AREAS.every((area) => areas.has(area))
  })
}

/** 특정 기간·영역의 활동을 불변 방식으로 수정한다. */
export function updateActivity(
  content: PlanContent,
  period: string,
  area: string,
  patch: Partial<Pick<PlanActivity, 'activity_name' | 'description'>>,
): PlanContent {
  return {
    ...content,
    schedule: content.schedule.map((p) =>
      p.period !== period
        ? p
        : {
            ...p,
            activities: p.activities.map((a) =>
              a.area === area ? { ...a, ...patch } : a,
            ),
          },
    ),
  }
}

export function findActivity(
  content: PlanContent,
  period: string,
  area: string,
): PlanActivity | undefined {
  return content.schedule
    .find((p) => p.period === period)
    ?.activities.find((a) => a.area === area)
}

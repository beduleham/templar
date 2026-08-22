// 운영위원회 교구 도입 심의서 도메인 (순수 함수).
// 스펙 지침에 따라 금액 계산(총액·예산 대비율)은 AI가 아닌 코드에서 수행하고,
// AI(및 Mock)는 텍스트 논리 작성만 담당한다.

export interface DeliberationItem {
  itemId: string
  itemName: string
  quantity: number
  unitPrice: number
  /** 누리과정 영역 */
  curriculumArea: string
  description: string
}

export interface DeliberationReportRequest {
  targetAge: string
  classSize: number
  totalBudget: number
  selectedItems: DeliberationItem[]
}

export interface DeliberationReportResponse {
  introductionPurpose: string
  curriculumConnection: string
  budgetFeasibility: string
  expectedEffect: string
}

export const DELIBERATION_SECTIONS: Array<{
  key: keyof DeliberationReportResponse
  label: string
}> = [
  { key: 'introductionPurpose', label: '도입 목적' },
  { key: 'curriculumConnection', label: '누리과정 연계성' },
  { key: 'budgetFeasibility', label: '예산 대비 타당성' },
  { key: 'expectedEffect', label: '기대 효과' },
]

/** 총 소요 금액 = Σ(단가 × 수량). 반드시 코드에서 계산한다. */
export const deliberationTotal = (items: DeliberationItem[]) =>
  items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

/** 예산 대비 소요율(%). 예산이 0이면 null. */
export function budgetUsageRate(totalCost: number, totalBudget: number): number | null {
  if (totalBudget <= 0) return null
  return Math.round((totalCost / totalBudget) * 1000) / 10
}

export function updateItemQuantity(
  items: DeliberationItem[],
  itemId: string,
  quantity: number,
): DeliberationItem[] {
  const qty = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1
  return items.map((item) =>
    item.itemId === itemId ? { ...item, quantity: qty } : item,
  )
}

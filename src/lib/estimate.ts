// 실시간 견적 산출 엔진 (순수 함수).
// 인원수·예산 입력과 항목 수량 편집에 따라 총액과 예산 상태를 즉시 계산한다.

import { sanitizeCount, type Product } from './quotation'

export interface EstimateItem {
  id: string
  name: string
  thumbnailUrl?: string
  unitPrice: number
  quantity: number
  /** true: 인원수 동기화 대상(개인별 지급), false: 학급 공용(기본 수량 1) */
  isPerStudent: boolean
  /** 사용자가 수량을 직접 수정한 항목은 이후 인원수 변경 시 자동 동기화에서 제외 */
  isManuallyEdited: boolean
}

export interface EstimateSummary {
  totalAmount: number
  remainingBudget: number
  isOverBudget: boolean
}

/** 추천 상품 목록으로 견적 항목 초기화. 개인별 항목은 인원수, 공용 항목은 1. */
export function createEstimateItems(
  products: Product[],
  headcount: number,
): EstimateItem[] {
  const count = sanitizeCount(headcount)
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    unitPrice: product.unitPrice,
    quantity: product.isPerStudent ? count : 1,
    isPerStudent: product.isPerStudent,
    isManuallyEdited: false,
  }))
}

/**
 * 인원수 변경에 따른 수량 동기화 + 총액/예산 상태 계산.
 * 개인별(isPerStudent) 항목 중 수동 수정되지 않은 항목만 인원수로 동기화한다.
 */
export function calculateEstimate(
  items: EstimateItem[],
  headcount: number,
  totalBudget: number,
): { updatedItems: EstimateItem[]; summary: EstimateSummary } {
  const count = headcount > 0 ? Math.floor(headcount) : 1
  const updatedItems = items.map((item) =>
    item.isPerStudent && !item.isManuallyEdited ? { ...item, quantity: count } : item,
  )
  return { updatedItems, summary: summarize(updatedItems, totalBudget) }
}

export function summarize(items: EstimateItem[], totalBudget: number): EstimateSummary {
  const totalAmount = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )
  const remainingBudget = totalBudget - totalAmount
  return { totalAmount, remainingBudget, isOverBudget: remainingBudget < 0 }
}

/** 수량 직접 수정: 0 이상 정수로 보정하고 수동 수정 플래그를 남긴다. (0 = 항목 제외) */
export function setItemQuantity(
  items: EstimateItem[],
  itemId: string,
  quantity: number,
): EstimateItem[] {
  return items.map((item) =>
    item.id === itemId
      ? { ...item, quantity: sanitizeCount(quantity, 0), isManuallyEdited: true }
      : item,
  )
}

// 견적 문서(품목·세액) 계산 유틸 (순수 함수).
// 서버 도입 시 동일 로직을 백엔드 검증용으로 재사용할 수 있도록 UI와 분리한다.

export interface Product {
  id: string
  name: string
  unitPrice: number
  /** 부가세율. 교재·도서류 면세 품목은 0. */
  taxRate: number
  /** true: 개인별 지급 항목(수량 = 인원수), false: 학급 공용(기본 수량 1) */
  isPerStudent: boolean
  description?: string
}

export interface QuoteItem {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  supplyValue: number
  tax: number
  totalItemAmount: number
}

export interface QuoteTotals {
  supplyTotal: number
  taxTotal: number
  totalAmount: number
}

/** 수량/인원수 입력값 정규화: 정수로 내림, 최소 min(기본 1). */
export function sanitizeCount(value: number, min = 1): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.floor(value))
}

export function computeItem(product: Product, quantity: number): QuoteItem {
  const qty = sanitizeCount(quantity, 0)
  const supplyValue = product.unitPrice * qty
  const tax = Math.round(supplyValue * product.taxRate)
  return {
    productId: product.id,
    productName: product.name,
    unitPrice: product.unitPrice,
    quantity: qty,
    supplyValue,
    tax,
    totalItemAmount: supplyValue + tax,
  }
}

export function computeTotals(items: QuoteItem[]): QuoteTotals {
  return items.reduce(
    (acc, item) => ({
      supplyTotal: acc.supplyTotal + item.supplyValue,
      taxTotal: acc.taxTotal + item.tax,
      totalAmount: acc.totalAmount + item.totalItemAmount,
    }),
    { supplyTotal: 0, taxTotal: 0, totalAmount: 0 },
  )
}

export const formatKrw = (amount: number) => `${amount.toLocaleString('ko-KR')}원`

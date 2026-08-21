// 견적 계산 엔진 (순수 함수).
// 서버 도입 시 동일 로직을 백엔드 검증용으로 재사용할 수 있도록 UI와 분리한다.

export interface Product {
  id: string
  name: string
  unitPrice: number
  /** 부가세율. 교재·도서류 면세 품목은 0. */
  taxRate: number
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

export interface BudgetStatus {
  /** 예산 초과 여부 */
  over: boolean
  /** over=true면 초과 금액, 아니면 남은 예산 */
  diff: number
}

/** 수량/인원수 입력값 정규화: 정수로 내림, 최소 1. */
export function sanitizeCount(value: number, min = 1): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.floor(value))
}

export function computeItem(product: Product, quantity: number): QuoteItem {
  const qty = sanitizeCount(quantity)
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

/** 추천 상품 목록으로 견적 초안 생성. 기본 수량 = 학급 인원수. */
export function buildQuoteItems(products: Product[], studentCount: number): QuoteItem[] {
  const count = sanitizeCount(studentCount)
  return products.map((product) => computeItem(product, count))
}

export function updateItemQuantity(
  items: QuoteItem[],
  products: Product[],
  productId: string,
  quantity: number,
): QuoteItem[] {
  return items.map((item) => {
    if (item.productId !== productId) return item
    const product = products.find((p) => p.id === productId)
    if (!product) return item
    return computeItem(product, quantity)
  })
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

export function budgetStatus(totalAmount: number, totalBudget: number): BudgetStatus {
  const diff = totalBudget - totalAmount
  return diff < 0 ? { over: true, diff: -diff } : { over: false, diff }
}

export const formatKrw = (amount: number) => `${amount.toLocaleString('ko-KR')}원`

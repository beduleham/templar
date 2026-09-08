// 주문/견적 도메인 모델 (순수 함수).
// 스펙의 Order / OrderItem / OrderStatus 스키마와 동일한 구조를 유지한다.

export const ORDER_STATUSES = [
  'PENDING',
  'ESTIMATED',
  'ORDERED',
  'SHIPPING',
  'COMPLETED',
  'CANCELLED',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: '대기',
  ESTIMATED: '견적확인',
  ORDERED: '발주완료',
  SHIPPING: '배송중',
  COMPLETED: '완료',
  CANCELLED: '취소',
}

/** 목록/칸반에서 상태를 시각 구분하기 위한 스타일 토큰 */
export const orderStatusStyles: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  ESTIMATED: 'bg-sky-50 text-sky-700',
  ORDERED: 'bg-indigo-50 text-indigo-700',
  SHIPPING: 'bg-violet-50 text-violet-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export interface Order {
  id: string
  institutionName: string
  contactPerson: string
  phone: string
  studentCount: number
  totalBudget: number
  totalPrice: number
  status: OrderStatus
  trackingNumber?: string
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

/** 아직 공급업체가 처리하지 않은 주문 (요약 카드용) */
export const isUnprocessed = (order: Order) =>
  order.status === 'PENDING' || order.status === 'ESTIMATED'

export const orderTotal = (items: OrderItem[]) =>
  items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

export const isToday = (iso: string, now: Date) => {
  const d = new Date(iso)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

// 주문/견적 저장소.
// 백엔드(GET/PATCH /api/admin/orders)가 준비되기 전까지 localStorage에 보관한다.
// 교사용 견적 화면의 '발주 요청'이 여기로 주문을 생성하고,
// 공급업체 주문 화면이 폴링 + storage 이벤트로 변화를 감지한다.

import { orderTotal, type Order, type OrderItem, type OrderStatus } from '../lib/order'

const STORAGE_KEY = 'templar.orders.v1'

function seedOrders(): Order[] {
  const base = Date.now()
  const mk = (
    i: number,
    status: OrderStatus,
    institutionName: string,
    items: OrderItem[],
    hoursAgo: number,
  ): Order => ({
    id: `order-seed-${i}`,
    institutionName,
    contactPerson: i === 1 ? '김하늘 교사' : i === 2 ? '이봄 원장' : '박슬기 교사',
    phone: `010-12${i}4-56${i}8`,
    studentCount: 15 + i * 3,
    totalBudget: 300000 + i * 100000,
    totalPrice: orderTotal(items),
    status,
    items,
    createdAt: new Date(base - hoursAgo * 3600_000).toISOString(),
    updatedAt: new Date(base - hoursAgo * 3600_000).toISOString(),
  })
  return [
    mk(1, 'PENDING', '해솔 어린이집', [
      { productId: 'prod-001', productName: '누리과정 미술 놀이 세트', quantity: 18, unitPrice: 10000 },
      { productId: 'prod-004', productName: '어린이 관찰 돋보기 세트', quantity: 18, unitPrice: 4500 },
    ], 2),
    mk(2, 'ORDERED', '푸른숲 유치원', [
      { productId: 'prod-007', productName: '주제별 그림책 꾸러미', quantity: 2, unitPrice: 30000 },
      { productId: 'prod-008', productName: '낱말 카드 놀이 세트', quantity: 21, unitPrice: 6500 },
    ], 30),
    mk(3, 'COMPLETED', '아람 어린이집', [
      { productId: 'prod-002', productName: '창의 블록 교구', quantity: 24, unitPrice: 5000 },
    ], 80),
  ]
}

function readAll(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedOrders()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedOrders()
  } catch {
    return seedOrders()
  }
}

function writeAll(orders: Order[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  } catch {
    throw new Error('로컬 저장소에 저장하지 못했습니다')
  }
}

/** 최신순 주문 목록 */
export function listOrders(): Order[] {
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export interface CreateOrderInput {
  institutionName: string
  contactPerson: string
  phone: string
  studentCount: number
  totalBudget: number
  items: OrderItem[]
}

export function createOrder(input: CreateOrderInput): Order {
  const now = new Date().toISOString()
  const order: Order = {
    id: `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    totalPrice: orderTotal(input.items),
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  }
  writeAll([...readAll(), order])
  return order
}

export function updateOrderStatus(
  id: string,
  status: OrderStatus,
  trackingNumber?: string,
): Order {
  const orders = readAll()
  const target = orders.find((o) => o.id === id)
  if (!target) throw new Error('주문을 찾을 수 없습니다')
  const updated: Order = {
    ...target,
    status,
    trackingNumber: trackingNumber?.trim() || target.trackingNumber,
    updatedAt: new Date().toISOString(),
  }
  writeAll(orders.map((o) => (o.id === id ? updated : o)))
  return updated
}

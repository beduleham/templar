import { describe, expect, it } from 'vitest'
import {
  isToday,
  isUnprocessed,
  ORDER_STATUSES,
  orderStatusLabels,
  orderTotal,
  type Order,
} from './order'

const orderOf = (status: Order['status']): Order => ({
  id: 'o1',
  institutionName: '테스트 어린이집',
  contactPerson: '김교사',
  phone: '010-0000-0000',
  studentCount: 20,
  totalBudget: 300000,
  totalPrice: 0,
  status,
  items: [],
  createdAt: '2026-08-21T01:00:00Z',
  updatedAt: '2026-08-21T01:00:00Z',
})

describe('orderTotal', () => {
  it('수량 × 단가 합계를 계산한다', () => {
    expect(
      orderTotal([
        { productId: 'a', productName: 'A', quantity: 18, unitPrice: 10000 },
        { productId: 'b', productName: 'B', quantity: 18, unitPrice: 4500 },
      ]),
    ).toBe(261000)
  })
})

describe('isUnprocessed', () => {
  it('대기·견적확인 상태만 미처리로 본다', () => {
    expect(isUnprocessed(orderOf('PENDING'))).toBe(true)
    expect(isUnprocessed(orderOf('ESTIMATED'))).toBe(true)
    expect(isUnprocessed(orderOf('ORDERED'))).toBe(false)
    expect(isUnprocessed(orderOf('CANCELLED'))).toBe(false)
  })
})

describe('상태 정의', () => {
  it('스펙의 6개 상태와 한국어 라벨을 모두 가진다', () => {
    expect(ORDER_STATUSES).toHaveLength(6)
    for (const status of ORDER_STATUSES) {
      expect(orderStatusLabels[status]).toBeTruthy()
    }
  })
})

describe('isToday', () => {
  it('같은 날짜만 오늘로 판정한다', () => {
    const now = new Date('2026-08-21T12:00:00')
    expect(isToday(new Date('2026-08-21T01:00:00').toISOString(), now)).toBe(true)
    expect(isToday(new Date('2026-08-20T23:59:00').toISOString(), now)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  calculateEstimate,
  createEstimateItems,
  setItemQuantity,
  summarize,
} from './estimate'
import type { Product } from './quotation'

// 스펙 수동 검증 시나리오 데이터: 개인 교재 8,000원, 학급 교구 15,000원
const personal: Product = {
  id: 'p1',
  name: '개인 교재',
  unitPrice: 8000,
  taxRate: 0,
  isPerStudent: true,
}
const shared: Product = {
  id: 's1',
  name: '학급 교구',
  unitPrice: 15000,
  taxRate: 0,
  isPerStudent: false,
}
const products = [personal, shared]

describe('createEstimateItems', () => {
  it('개인별 항목은 인원수, 공용 항목은 1로 초기화한다', () => {
    const items = createEstimateItems(products, 10)
    expect(items[0].quantity).toBe(10)
    expect(items[1].quantity).toBe(1)
  })
})

describe('calculateEstimate', () => {
  it('인원수 10, 예산 100,000 → 총액 95,000, 예산 내 안전 +5,000', () => {
    const items = createEstimateItems(products, 10)
    const { summary } = calculateEstimate(items, 10, 100000)
    expect(summary.totalAmount).toBe(95000)
    expect(summary.remainingBudget).toBe(5000)
    expect(summary.isOverBudget).toBe(false)
  })

  it('인원수 12로 변경 → 개인 항목 12개, 총액 111,000, 예산 초과 -11,000', () => {
    const items = createEstimateItems(products, 10)
    const { updatedItems, summary } = calculateEstimate(items, 12, 100000)
    expect(updatedItems[0].quantity).toBe(12)
    expect(updatedItems[1].quantity).toBe(1)
    expect(summary.totalAmount).toBe(111000)
    expect(summary.remainingBudget).toBe(-11000)
    expect(summary.isOverBudget).toBe(true)
  })

  it('수동 수정된 항목은 인원수 동기화에서 제외된다', () => {
    let items = createEstimateItems(products, 10)
    items = setItemQuantity(items, 'p1', 5)
    const { updatedItems } = calculateEstimate(items, 20, 100000)
    expect(updatedItems[0].quantity).toBe(5)
    expect(updatedItems[0].isManuallyEdited).toBe(true)
  })

  it('인원수 0 이하는 1로 폴백한다', () => {
    const items = createEstimateItems(products, 10)
    const { updatedItems } = calculateEstimate(items, 0, 100000)
    expect(updatedItems[0].quantity).toBe(1)
  })

  it('빈 항목 목록이면 총액 0', () => {
    const { summary } = calculateEstimate([], 10, 100000)
    expect(summary.totalAmount).toBe(0)
    expect(summary.isOverBudget).toBe(false)
  })
})

describe('setItemQuantity', () => {
  it('수량을 0으로 수정하면 항목이 총액에서 제외된다 (시나리오 4단계)', () => {
    let items = createEstimateItems(products, 12)
    items = setItemQuantity(items, 's1', 0)
    const summary = summarize(items, 100000)
    expect(summary.totalAmount).toBe(96000)
    expect(summary.remainingBudget).toBe(4000)
    expect(summary.isOverBudget).toBe(false)
  })

  it('음수 수량은 0으로 보정한다', () => {
    let items = createEstimateItems(products, 10)
    items = setItemQuantity(items, 'p1', -3)
    expect(items[0].quantity).toBe(0)
  })

  it('소수점 수량은 내림 처리한다', () => {
    let items = createEstimateItems(products, 10)
    items = setItemQuantity(items, 'p1', 7.9)
    expect(items[0].quantity).toBe(7)
  })
})

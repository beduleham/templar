import { describe, expect, it } from 'vitest'
import {
  budgetStatus,
  buildQuoteItems,
  computeItem,
  computeTotals,
  sanitizeCount,
  updateItemQuantity,
  type Product,
} from './quotation'

const productA: Product = { id: 'prod-001', name: '상품 A', unitPrice: 10000, taxRate: 0 }
const productB: Product = { id: 'prod-002', name: '상품 B', unitPrice: 5000, taxRate: 0 }
const products = [productA, productB]

describe('sanitizeCount', () => {
  it('내림 처리로 정수만 허용한다', () => {
    expect(sanitizeCount(20.7)).toBe(20)
  })
  it('0 이하와 비정상 값은 최소값 1로 보정한다', () => {
    expect(sanitizeCount(0)).toBe(1)
    expect(sanitizeCount(-5)).toBe(1)
    expect(sanitizeCount(Number.NaN)).toBe(1)
  })
})

describe('buildQuoteItems', () => {
  it('기본 수량은 학급 인원수와 같다', () => {
    const items = buildQuoteItems(products, 20)
    expect(items).toHaveLength(2)
    expect(items.every((i) => i.quantity === 20)).toBe(true)
  })
  it('단가 × 수량으로 공급가액을 계산한다', () => {
    const items = buildQuoteItems(products, 20)
    expect(items[0].supplyValue).toBe(200000)
    expect(items[1].supplyValue).toBe(100000)
  })
})

describe('computeItem', () => {
  it('면세 품목의 부가세는 0이다', () => {
    const item = computeItem(productA, 10)
    expect(item.tax).toBe(0)
    expect(item.totalItemAmount).toBe(100000)
  })
  it('과세 품목은 부가세를 반올림해 더한다', () => {
    const taxed: Product = { id: 'p', name: '과세 교구', unitPrice: 3333, taxRate: 0.1 }
    const item = computeItem(taxed, 3)
    expect(item.supplyValue).toBe(9999)
    expect(item.tax).toBe(1000)
    expect(item.totalItemAmount).toBe(10999)
  })
})

describe('computeTotals', () => {
  it('스펙 수동 검증 시나리오: 20명 → 총합 300,000원', () => {
    const totals = computeTotals(buildQuoteItems(products, 20))
    expect(totals.supplyTotal).toBe(300000)
    expect(totals.taxTotal).toBe(0)
    expect(totals.totalAmount).toBe(300000)
  })
})

describe('updateItemQuantity', () => {
  it('수량 변경 시 해당 품목만 재계산한다', () => {
    let items = buildQuoteItems(products, 20)
    items = updateItemQuantity(items, products, 'prod-002', 10)
    expect(items[0].quantity).toBe(20)
    expect(items[1].quantity).toBe(10)
    expect(computeTotals(items).totalAmount).toBe(250000)
  })
  it('0 이하 수량은 1로 보정된다', () => {
    let items = buildQuoteItems(products, 20)
    items = updateItemQuantity(items, products, 'prod-001', -3)
    expect(items[0].quantity).toBe(1)
  })
})

describe('budgetStatus', () => {
  it('예산 초과 시 초과 금액을 반환한다', () => {
    const status = budgetStatus(300000, 250000)
    expect(status.over).toBe(true)
    expect(status.diff).toBe(50000)
  })
  it('예산 이내면 남은 예산을 반환한다', () => {
    const status = budgetStatus(250000, 250000)
    expect(status.over).toBe(false)
    expect(status.diff).toBe(0)
  })
})

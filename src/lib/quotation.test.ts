import { describe, expect, it } from 'vitest'
import {
  computeItem,
  computeTotals,
  sanitizeCount,
  type Product,
} from './quotation'

const productA: Product = {
  id: 'prod-001',
  name: '상품 A',
  unitPrice: 10000,
  taxRate: 0,
  isPerStudent: true,
}

describe('sanitizeCount', () => {
  it('내림 처리로 정수만 허용한다', () => {
    expect(sanitizeCount(20.7)).toBe(20)
  })
  it('기본 최소값은 1이다', () => {
    expect(sanitizeCount(0)).toBe(1)
    expect(sanitizeCount(-5)).toBe(1)
    expect(sanitizeCount(Number.NaN)).toBe(1)
  })
  it('min=0이면 수량 0을 허용한다', () => {
    expect(sanitizeCount(0, 0)).toBe(0)
    expect(sanitizeCount(-1, 0)).toBe(0)
  })
})

describe('computeItem', () => {
  it('단가 × 수량으로 공급가액을 계산한다', () => {
    const item = computeItem(productA, 20)
    expect(item.supplyValue).toBe(200000)
    expect(item.totalItemAmount).toBe(200000)
  })
  it('면세 품목의 부가세는 0이다', () => {
    expect(computeItem(productA, 10).tax).toBe(0)
  })
  it('과세 품목은 부가세를 반올림해 더한다', () => {
    const taxed: Product = {
      id: 'p',
      name: '과세 교구',
      unitPrice: 3333,
      taxRate: 0.1,
      isPerStudent: true,
    }
    const item = computeItem(taxed, 3)
    expect(item.supplyValue).toBe(9999)
    expect(item.tax).toBe(1000)
    expect(item.totalItemAmount).toBe(10999)
  })
  it('음수 수량은 0으로 보정한다', () => {
    expect(computeItem(productA, -3).quantity).toBe(0)
  })
})

describe('computeTotals', () => {
  it('품목 합계를 집계한다', () => {
    const items = [computeItem(productA, 20), computeItem(productA, 5)]
    const totals = computeTotals(items)
    expect(totals.supplyTotal).toBe(250000)
    expect(totals.taxTotal).toBe(0)
    expect(totals.totalAmount).toBe(250000)
  })
})

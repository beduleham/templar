import { describe, expect, it } from 'vitest'
import {
  applyBulkUpsert,
  EXCEL_HEADERS,
  validateHeaders,
  validateRow,
  type RowError,
  type SupplierProduct,
} from './supplierProduct'

const validValues = [
  'NURI-100',
  '테스트 교재',
  '미술',
  '만 4세',
  '예술경험',
  '12000',
  '설명',
  '',
  'Y',
]

const rowOf = (overrides: Record<number, string>) => {
  const values = [...validValues]
  for (const [i, v] of Object.entries(overrides)) values[Number(i)] = v
  return { rowNumber: 5, values }
}

describe('validateHeaders', () => {
  it('표준 헤더는 통과한다', () => {
    expect(validateHeaders([...EXCEL_HEADERS])).toBeNull()
  })
  it('헤더 이름이 다르면 어떤 열이 잘못됐는지 알려준다', () => {
    const headers = [...EXCEL_HEADERS] as string[]
    headers[5] = '가격'
    const error = validateHeaders(headers)
    expect(error).toContain('6번째 열')
    expect(error).toContain('단가')
  })
})

describe('validateRow', () => {
  it('정상 행은 파싱된다', () => {
    const errors: RowError[] = []
    const parsed = validateRow(rowOf({}), errors)
    expect(errors).toHaveLength(0)
    expect(parsed).toMatchObject({
      productCode: 'NURI-100',
      unitPrice: 12000,
      isAvailable: true,
    })
  })

  it('단가에 문자가 들어가면 행 번호와 함께 에러를 낸다', () => {
    const errors: RowError[] = []
    expect(validateRow(rowOf({ 5: '만오천원' }), errors)).toBeNull()
    expect(errors[0]).toMatchObject({ row: 5, column: '단가' })
    expect(errors[0].reason).toContain('숫자')
  })

  it('음수 단가는 거부한다', () => {
    const errors: RowError[] = []
    expect(validateRow(rowOf({ 5: '-5000' }), errors)).toBeNull()
    expect(errors[0].reason).toContain('0 이상')
  })

  it('정의되지 않은 누리과정 영역은 거부한다', () => {
    const errors: RowError[] = []
    expect(validateRow(rowOf({ 4: '수학영역' }), errors)).toBeNull()
    expect(errors[0]).toMatchObject({ row: 5, column: '누리과정영역' })
    expect(errors[0].reason).toContain('허용 값')
  })

  it('필수값 누락을 모두 보고한다', () => {
    const errors: RowError[] = []
    validateRow(rowOf({ 0: '', 1: '' }), errors)
    expect(errors.map((e) => e.column)).toEqual(['상품코드', '상품명'])
  })

  it('천 단위 콤마가 있는 단가를 허용한다', () => {
    const errors: RowError[] = []
    const parsed = validateRow(rowOf({ 5: '12,000' }), errors)
    expect(parsed?.unitPrice).toBe(12000)
  })
})

describe('applyBulkUpsert', () => {
  const existing: SupplierProduct[] = [
    {
      id: 'prod-a',
      productCode: 'NURI-001',
      name: '기존 상품',
      category: '미술',
      targetAge: '만 3세',
      nuriDomain: '예술경험',
      unitPrice: 10000,
      taxRate: 0,
      isPerStudent: true,
      keywords: [],
      isAvailable: true,
      ragSynced: true,
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ]

  const parsedRow = (code: string, price: number) => ({
    productCode: code,
    name: '업로드 상품',
    category: '교구',
    targetAge: '만 4세',
    nuriDomain: '자연탐구',
    unitPrice: price,
    description: '',
    imageUrl: '',
    isAvailable: true,
  })

  it('동일 상품코드는 업데이트, 신규는 인서트한다', () => {
    const result = applyBulkUpsert(
      existing,
      [parsedRow('NURI-001', 99000), parsedRow('NURI-002', 5000)],
      '2026-08-21T00:00:00Z',
    )
    expect(result.updatedCount).toBe(1)
    expect(result.insertedCount).toBe(1)
    expect(result.products).toHaveLength(2)
    const updated = result.products.find((p) => p.productCode === 'NURI-001')
    expect(updated?.unitPrice).toBe(99000)
    expect(updated?.id).toBe('prod-a') // 기존 id 유지
  })

  it('변경된 모든 레코드는 ragSynced=false로 마킹된다', () => {
    const result = applyBulkUpsert(
      existing,
      [parsedRow('NURI-001', 99000), parsedRow('NURI-002', 5000)],
      '2026-08-21T00:00:00Z',
    )
    expect(result.products.every((p) => p.ragSynced === false)).toBe(true)
  })
})

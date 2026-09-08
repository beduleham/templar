import { describe, expect, it } from 'vitest'
import { generateDeliberationReport } from '../api/deliberationGenerator'
import {
  budgetUsageRate,
  deliberationTotal,
  updateItemQuantity,
  type DeliberationItem,
} from './deliberation'

const items: DeliberationItem[] = [
  {
    itemId: 'a',
    itemName: '누리과정 미술 놀이 세트',
    quantity: 20,
    unitPrice: 10000,
    curriculumArea: '예술경험',
    description: '미술 활동 재료 모음입니다.',
  },
  {
    itemId: 'b',
    itemName: '어린이 관찰 돋보기 세트',
    quantity: 20,
    unitPrice: 4500,
    curriculumArea: '자연탐구',
    description: '안전한 관찰 도구입니다.',
  },
]

describe('deliberationTotal / budgetUsageRate', () => {
  it('총액은 단가 × 수량 합계로 계산된다', () => {
    expect(deliberationTotal(items)).toBe(290000)
  })
  it('예산 대비 소요율을 소수 1자리로 계산한다', () => {
    expect(budgetUsageRate(290000, 500000)).toBe(58)
    expect(budgetUsageRate(325000, 500000)).toBe(65)
  })
  it('예산이 0이면 null', () => {
    expect(budgetUsageRate(100, 0)).toBeNull()
  })
})

describe('updateItemQuantity', () => {
  it('수량 변경 시 최소 1로 보정하며 해당 품목만 바꾼다', () => {
    const updated = updateItemQuantity(items, 'b', 0)
    expect(updated[1].quantity).toBe(1)
    expect(updated[0].quantity).toBe(20)
  })
})

describe('generateDeliberationReport (mock)', () => {
  const request = {
    targetAge: '만 5세',
    classSize: 20,
    totalBudget: 500000,
    selectedItems: items,
  }

  it('4개 항목을 모두 생성한다', async () => {
    const report = await generateDeliberationReport(request)
    expect(report.introductionPurpose).toBeTruthy()
    expect(report.curriculumConnection).toBeTruthy()
    expect(report.budgetFeasibility).toBeTruthy()
    expect(report.expectedEffect).toBeTruthy()
  })

  it('금액 수치는 코드 계산값과 정확히 일치한다', async () => {
    const report = await generateDeliberationReport(request)
    expect(report.budgetFeasibility).toContain('290,000원')
    expect(report.budgetFeasibility).toContain('500,000원')
    expect(report.budgetFeasibility).toContain('58%')
  })

  it('제공된 교구·영역 정보만 사용한다 (환각 차단)', async () => {
    const report = await generateDeliberationReport(request)
    const text = JSON.stringify(report)
    expect(text).toContain('누리과정 미술 놀이 세트')
    expect(text).toContain('예술경험')
    expect(text).toContain('자연탐구')
  })

  it('학급 정보가 도입 목적에 반영된다', async () => {
    const report = await generateDeliberationReport(request)
    expect(report.introductionPurpose).toContain('만 5세')
    expect(report.introductionPurpose).toContain('20명')
  })

  it('교구가 없으면 에러를 던진다', async () => {
    await expect(
      generateDeliberationReport({ ...request, selectedItems: [] }),
    ).rejects.toThrow('심의 대상 교구가 없습니다')
  })
})

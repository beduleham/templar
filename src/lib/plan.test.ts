import { describe, expect, it } from 'vitest'
import { generatePlan } from '../api/planGenerator'
import {
  findActivity,
  MONTHLY_PERIODS,
  NURI_AREAS,
  updateActivity,
  validatePlanContent,
  WEEKLY_PERIODS,
  type PlanContent,
} from './plan'

const params = {
  targetAge: '만 5세' as const,
  planType: 'WEEKLY' as const,
  theme: '우주와 지구',
  subTheme: '태양계 행성 탐험',
}

describe('generatePlan (mock)', () => {
  it('주간 계획안은 월~금 5개 기간을 가진다', async () => {
    const plan = await generatePlan(params)
    expect(plan.schedule.map((p) => p.period)).toEqual([...WEEKLY_PERIODS])
  })

  it('월간 계획안은 1~4주 4개 기간을 가진다', async () => {
    const plan = await generatePlan({ ...params, planType: 'MONTHLY' })
    expect(plan.schedule.map((p) => p.period)).toEqual([...MONTHLY_PERIODS])
  })

  it('모든 기간에 누리과정 5대 영역이 포함된다', async () => {
    const plan = await generatePlan(params)
    for (const period of plan.schedule) {
      expect(period.activities.map((a) => a.area)).toEqual([...NURI_AREAS])
    }
    expect(validatePlanContent(plan)).toBe(true)
  })

  it('제목과 주제에 입력값이 반영된다', async () => {
    const plan = await generatePlan(params)
    expect(plan.title).toContain('만 5세')
    expect(plan.title).toContain('우주와 지구')
    expect(plan.theme).toContain('태양계 행성 탐험')
    expect(plan.goals.length).toBeGreaterThan(0)
  })

  it('빈 대주제는 에러를 던진다', async () => {
    await expect(generatePlan({ ...params, theme: '  ' })).rejects.toThrow()
  })
})

describe('updateActivity', () => {
  it('특정 기간·영역의 활동만 불변 수정한다', async () => {
    const plan = await generatePlan(params)
    const updated = updateActivity(plan, '월', '자연탐구', {
      activity_name: '클레이로 나만의 행성 만들기',
    })
    expect(findActivity(updated, '월', '자연탐구')?.activity_name).toBe(
      '클레이로 나만의 행성 만들기',
    )
    // 원본 불변 + 다른 셀 영향 없음
    expect(findActivity(plan, '월', '자연탐구')?.activity_name).not.toBe(
      '클레이로 나만의 행성 만들기',
    )
    expect(findActivity(updated, '화', '자연탐구')).toEqual(
      findActivity(plan, '화', '자연탐구'),
    )
  })
})

describe('validatePlanContent', () => {
  it('영역이 누락되면 실패한다', () => {
    const broken: PlanContent = {
      title: 't',
      target_age: '만 3세',
      theme: 'x',
      goals: [],
      schedule: [
        { period: '월', activities: [{ area: '의사소통', activity_name: 'a', description: 'd' }] },
      ],
    }
    expect(validatePlanContent(broken)).toBe(false)
  })
})

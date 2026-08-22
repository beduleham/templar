import { describe, expect, it } from 'vitest'
import { generateJournalDraft } from '../api/journalGenerator'
import { generatePlan } from '../api/planGenerator'
import {
  activitiesForDate,
  periodForDate,
  updateScheduleContent,
} from './journal'

// 2026-08-24 = 월요일, 2026-08-22 = 토요일
describe('periodForDate', () => {
  it('주간 계획안은 요일로 매핑된다 (주말은 null)', () => {
    expect(periodForDate('WEEKLY', '2026-08-24')).toBe('월')
    expect(periodForDate('WEEKLY', '2026-08-28')).toBe('금')
    expect(periodForDate('WEEKLY', '2026-08-22')).toBeNull()
    expect(periodForDate('WEEKLY', '2026-08-23')).toBeNull()
  })
  it('월간 계획안은 N주로 매핑된다 (29일 이후는 4주로 캡)', () => {
    expect(periodForDate('MONTHLY', '2026-08-03')).toBe('1주')
    expect(periodForDate('MONTHLY', '2026-08-14')).toBe('2주')
    expect(periodForDate('MONTHLY', '2026-08-31')).toBe('4주')
  })
  it('연간 계획안은 N월로 매핑된다', () => {
    expect(periodForDate('YEARLY', '2026-08-24')).toBe('8월')
    expect(periodForDate('YEARLY', '2026-01-15')).toBe('1월')
  })
  it('잘못된 날짜는 null', () => {
    expect(periodForDate('WEEKLY', 'invalid')).toBeNull()
  })
})

describe('activitiesForDate', () => {
  it('주간 계획안에서 해당 요일의 활동을 찾는다', async () => {
    const plan = await generatePlan({
      targetAge: '만 5세',
      planType: 'WEEKLY',
      theme: '여름',
    })
    const activities = activitiesForDate(plan, 'WEEKLY', '2026-08-24')
    expect(activities).toHaveLength(5)
    expect(activitiesForDate(plan, 'WEEKLY', '2026-08-22')).toBeNull()
  })
})

describe('generateJournalDraft', () => {
  it('일과표와 활동 평가를 생성하고 계획안 활동을 반영한다', async () => {
    const plan = await generatePlan({
      targetAge: '만 4세',
      planType: 'WEEKLY',
      theme: '바다',
    })
    const activities = activitiesForDate(plan, 'WEEKLY', '2026-08-24')!
    const draft = await generateJournalDraft({
      dateISO: '2026-08-24',
      targetAge: '만 4세',
      theme: '바다',
      activities,
    })
    expect(draft.dailySchedule.length).toBeGreaterThanOrEqual(7)
    const text = JSON.stringify(draft)
    // 계획안 활동명이 일과에 반영됨
    expect(text).toContain(activities[0].activity_name)
    // 등원/점심/낮잠 등 표준 일과 포함
    expect(text).toContain('등원')
    expect(text).toContain('점심')
    expect(draft.activityEvaluation).toContain('만 4세')
    expect(draft.activityEvaluation).toContain('바다')
  })

  it('계획안 활동 외의 허구 교구를 지어내지 않는다', async () => {
    const plan = await generatePlan({
      targetAge: '만 3세',
      planType: 'WEEKLY',
      theme: '가을',
    })
    const activities = activitiesForDate(plan, 'WEEKLY', '2026-08-25')!
    const draft = await generateJournalDraft({
      dateISO: '2026-08-25',
      targetAge: '만 3세',
      theme: '가을',
      activities,
    })
    // 초안에 언급된 준비물은 모두 계획안 활동의 materials에서 온 것이어야 한다
    const allowed = new Set(activities.flatMap((a) => a.materials ?? []))
    for (const entry of draft.dailySchedule) {
      const m = entry.content.match(/준비물: ([^)]+)\)/)
      if (m) {
        for (const item of m[1].split(', ')) {
          expect(allowed.has(item)).toBe(true)
        }
      }
    }
  })

  it('활동이 없으면 에러를 던진다', async () => {
    await expect(
      generateJournalDraft({
        dateISO: '2026-08-24',
        targetAge: '만 5세',
        theme: 'x',
        activities: [],
      }),
    ).rejects.toThrow('교육계획안이 존재하지 않습니다')
  })
})

describe('updateScheduleContent', () => {
  it('해당 인덱스의 내용만 불변 수정한다', () => {
    const schedule = [
      { time: '09:00', activity: 'a', content: 'c1' },
      { time: '10:00', activity: 'b', content: 'c2' },
    ]
    const updated = updateScheduleContent(schedule, 1, '수정됨')
    expect(updated[0].content).toBe('c1')
    expect(updated[1].content).toBe('수정됨')
    expect(schedule[1].content).toBe('c2')
  })
})

// 보육일지·활동 평가서 도메인 모델 및 날짜↔계획안 매핑 (순수 함수).
// 스펙의 daily_journals 테이블(daily_schedule JSONB + activity_evaluation)과
// 동일한 구조를 유지해 백엔드 도입 시 그대로 이관할 수 있게 한다.

import type { PlanActivity, PlanContent, PlanType } from './plan'

export interface JournalEntry {
  time: string
  activity: string
  content: string
}

export interface DailyJournal {
  id: string
  planId?: string
  /** YYYY-MM-DD (일자별 1건) */
  journalDate: string
  dailySchedule: JournalEntry[]
  activityEvaluation: string
  createdAt: string
  updatedAt: string
}

const WEEKDAY_PERIODS = ['월', '화', '수', '목', '금'] as const

/**
 * 선택한 날짜가 계획안의 어느 기간(period)에 해당하는지 계산한다.
 * 주간: 요일(월~금, 주말은 null) / 월간: N주(1~4주) / 연간: N월
 */
export function periodForDate(planType: PlanType, dateISO: string): string | null {
  const date = new Date(`${dateISO}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  if (planType === 'WEEKLY') {
    const day = date.getDay() // 0=일, 6=토
    if (day === 0 || day === 6) return null
    return WEEKDAY_PERIODS[day - 1]
  }
  if (planType === 'MONTHLY') {
    const week = Math.min(4, Math.ceil(date.getDate() / 7))
    return `${week}주`
  }
  return `${date.getMonth() + 1}월`
}

/** 선택한 날짜에 해당하는 계획안 활동 목록을 찾는다. (없으면 null) */
export function activitiesForDate(
  content: PlanContent,
  planType: PlanType,
  dateISO: string,
): PlanActivity[] | null {
  const period = periodForDate(planType, dateISO)
  if (!period) return null
  const entry = content.schedule.find((p) => p.period === period)
  return entry ? entry.activities : null
}

export function updateScheduleContent(
  schedule: JournalEntry[],
  index: number,
  content: string,
): JournalEntry[] {
  return schedule.map((entry, i) => (i === index ? { ...entry, content } : entry))
}

export const formatJournalDate = (dateISO: string) =>
  new Date(`${dateISO}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

// 보육일지 저장소.
// 백엔드(POST/PUT /api/v1/journals)가 준비되기 전까지 localStorage에 보관한다.
// journalDate 기준 1건(UNIQUE)을 유지한다.

import type { DailyJournal, JournalEntry } from '../lib/journal'

const STORAGE_KEY = 'templar.dailyJournals.v1'

function readAll(): DailyJournal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(journals: DailyJournal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journals))
  } catch {
    throw new Error('로컬 저장소에 저장하지 못했습니다')
  }
}

export function getJournalByDate(dateISO: string): DailyJournal | undefined {
  return readAll().find((j) => j.journalDate === dateISO)
}

export interface SaveJournalInput {
  planId?: string
  journalDate: string
  dailySchedule: JournalEntry[]
  activityEvaluation: string
}

/** 일자 기준 upsert */
export function saveJournal(input: SaveJournalInput): DailyJournal {
  const journals = readAll()
  const now = new Date().toISOString()
  const existing = journals.find((j) => j.journalDate === input.journalDate)
  if (existing) {
    const updated: DailyJournal = { ...existing, ...input, updatedAt: now }
    writeAll(journals.map((j) => (j.journalDate === input.journalDate ? updated : j)))
    return updated
  }
  const created: DailyJournal = {
    id: `journal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    createdAt: now,
    updatedAt: now,
  }
  writeAll([...journals, created])
  return created
}

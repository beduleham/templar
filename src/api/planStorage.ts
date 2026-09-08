// 계획안 저장소.
// DB(POST/PUT /api/education-plans)가 준비되기 전까지 localStorage에 보관한다.
// SavedPlan 구조는 스펙의 EducationPlan 테이블(content: Json)과 동일하게 유지한다.

import type { PlanContent, PlanType, SavedPlan } from '../lib/plan'

const STORAGE_KEY = 'templar.educationPlans.v1'

function readAll(): SavedPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(plans: SavedPlan[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
  } catch {
    // 저장 공간 부족/프라이빗 모드 등 — 저장 실패는 호출부에서 안내한다.
    throw new Error('로컬 저장소에 저장하지 못했습니다')
  }
}

export function listPlans(): SavedPlan[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function getPlan(id: string): SavedPlan | undefined {
  return readAll().find((p) => p.id === id)
}

export function savePlan(
  content: PlanContent,
  planType: PlanType,
  existingId?: string,
): SavedPlan {
  const plans = readAll()
  const now = new Date().toISOString()
  const existing = existingId ? plans.find((p) => p.id === existingId) : undefined

  if (existing) {
    existing.content = content
    existing.planType = planType
    existing.updatedAt = now
    writeAll(plans)
    return existing
  }

  const created: SavedPlan = {
    id: `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    planType,
    content,
    createdAt: now,
    updatedAt: now,
  }
  writeAll([...plans, created])
  return created
}

export function deletePlan(id: string) {
  writeAll(readAll().filter((p) => p.id !== id))
}

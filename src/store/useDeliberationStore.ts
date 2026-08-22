import { create } from 'zustand'
import type { DeliberationItem } from '../lib/deliberation'

interface DeliberationSource {
  targetAge: string
  classSize: number
  totalBudget: number
  items: DeliberationItem[]
}

interface DeliberationState {
  /** 견적 화면에서 심의서 생성으로 넘어올 때 전달되는 원천 데이터 */
  source: DeliberationSource | null
  setSource: (source: DeliberationSource) => void
}

export const useDeliberationStore = create<DeliberationState>((set) => ({
  source: null,
  setSource: (source) => set({ source }),
}))

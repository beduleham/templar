import { create } from 'zustand'
import type { CatalogProduct } from '../api/products'

export interface SelectedRecommendation {
  product: CatalogProduct
  matchScore: number
  relatedActivity: string
  selected: boolean
}

interface RecommendationState {
  /** 계획안 기반 추천 + 사용자가 선택한 교재 목록 (견적서 생성 단계로 전달) */
  entries: SelectedRecommendation[]
  setEntries: (entries: SelectedRecommendation[]) => void
  toggleSelected: (productId: string) => void
  addEntry: (entry: SelectedRecommendation) => void
}

export const useRecommendationStore = create<RecommendationState>((set) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
  toggleSelected: (productId) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.product.id === productId ? { ...e, selected: !e.selected } : e,
      ),
    })),
  addEntry: (entry) =>
    set((state) => {
      const exists = state.entries.some((e) => e.product.id === entry.product.id)
      // 이미 목록에 있으면 선택 상태만 켠다 (업서트)
      return exists
        ? {
            entries: state.entries.map((e) =>
              e.product.id === entry.product.id ? { ...e, selected: true } : e,
            ),
          }
        : { entries: [...state.entries, entry] }
    }),
}))

/** 견적서에 반영할 선택된 상품 목록 */
export const selectedProducts = (entries: SelectedRecommendation[]) =>
  entries.filter((e) => e.selected).map((e) => e.product)

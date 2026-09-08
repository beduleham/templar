import { useMemo, useState } from 'react'
import {
  calculateEstimate,
  createEstimateItems,
  removeItem,
  replaceItem,
  setItemQuantity,
  summarize,
  type EstimateItem,
  type EstimateSummary,
} from '../lib/estimate'
import type { Product } from '../lib/quotation'

export interface UseEstimateResult {
  headcount: number
  totalBudget: number
  items: EstimateItem[]
  summary: EstimateSummary
  setHeadcount: (value: number) => void
  setTotalBudget: (value: number) => void
  updateQuantity: (itemId: string, quantity: number) => void
  deleteItem: (itemId: string) => void
  swapItem: (itemId: string, product: Product) => void
}

/** 인원수·예산·항목 수량을 관리하며 총액과 예산 상태를 실시간 산출하는 훅. */
export function useEstimate(products: Product[], initialHeadcount = 1): UseEstimateResult {
  const [headcount, setHeadcountState] = useState(initialHeadcount)
  const [totalBudget, setTotalBudgetState] = useState(0)
  const [items, setItems] = useState<EstimateItem[]>(() =>
    createEstimateItems(products, initialHeadcount),
  )

  const setHeadcount = (value: number) => {
    const next = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
    setHeadcountState(next)
    setItems((prev) => calculateEstimate(prev, next, totalBudget).updatedItems)
  }

  const setTotalBudget = (value: number) => {
    setTotalBudgetState(Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0)
  }

  const updateQuantity = (itemId: string, quantity: number) => {
    setItems((prev) => setItemQuantity(prev, itemId, quantity))
  }

  const deleteItem = (itemId: string) => {
    setItems((prev) => removeItem(prev, itemId))
  }

  const swapItem = (itemId: string, product: Product) => {
    setItems((prev) => replaceItem(prev, itemId, product))
  }

  const summary = useMemo(() => summarize(items, totalBudget), [items, totalBudget])

  return {
    headcount,
    totalBudget,
    items,
    summary,
    setHeadcount,
    setTotalBudget,
    updateQuantity,
    deleteItem,
    swapItem,
  }
}

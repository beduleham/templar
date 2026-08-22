import { ChevronDown, ChevronUp, FileSpreadsheet, PlusCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { CatalogProduct } from '../../api/products'
import type { PlanRecommendation } from '../../lib/similarity'
import { formatKrw } from '../../lib/quotation'
import {
  selectedProducts,
  useRecommendationStore,
} from '../../store/useRecommendationStore'
import MaterialCard from '../shared/MaterialCard'
import ProductDetailModal from './ProductDetailModal'

interface RecommendationPanelProps {
  recommendations: PlanRecommendation[]
}

export default function RecommendationPanel({
  recommendations,
}: RecommendationPanelProps) {
  const entries = useRecommendationStore((s) => s.entries)
  const toggleSelected = useRecommendationStore((s) => s.toggleSelected)
  const addEntry = useRecommendationStore((s) => s.addEntry)
  const [detail, setDetail] = useState<{
    product: CatalogProduct
    matchScore?: number
  } | null>(null)
  const [expandedAlt, setExpandedAlt] = useState<string | null>(null)

  const selectedCount = selectedProducts(entries).length

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            AI 추천 교재·교구
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            계획안 활동과 공급업체 등록 상품을 매칭했습니다. 견적서에 포함할 교재를
            선택하세요.
          </p>
        </div>
        <Link
          to="/teacher/quotes"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <FileSpreadsheet className="size-4" aria-hidden />
          선택한 교재로 견적서 만들기 ({selectedCount})
        </Link>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => {
          const rec = recommendations.find(
            (r) => r.product.id === entry.product.id,
          )
          const alternatives = rec?.alternatives ?? []
          const isExpanded = expandedAlt === entry.product.id
          return (
            <MaterialCard
              key={entry.product.id}
              product={entry.product}
              isSelected={entry.selected}
              onToggle={() => toggleSelected(entry.product.id)}
              matchScore={entry.matchScore}
              relatedActivity={entry.relatedActivity}
              onOpenDetail={() =>
                setDetail({ product: entry.product, matchScore: entry.matchScore })
              }
              footer={
                alternatives.length > 0 ? (
                  <div className="mt-3 border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedAlt(isExpanded ? null : entry.product.id)
                      }
                      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                    >
                      {isExpanded ? (
                        <ChevronUp className="size-3.5" aria-hidden />
                      ) : (
                        <ChevronDown className="size-3.5" aria-hidden />
                      )}
                      다른 교재 보기 ({alternatives.length})
                    </button>
                    {isExpanded && (
                      <ul className="mt-2 space-y-2">
                        {alternatives.map((alt) => {
                          const isSelected = entries.some(
                            (e) => e.product.id === alt.product.id && e.selected,
                          )
                          return (
                            <li
                              key={alt.product.id}
                              className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-slate-700">
                                  {alt.product.name}
                                  <span className="ml-1.5 text-[10px] font-bold text-sky-600">
                                    {Math.round(alt.matchScore * 100)}%
                                  </span>
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {formatKrw(alt.product.unitPrice)}
                                </p>
                              </div>
                              {isSelected ? (
                                <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                  선택됨
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    addEntry({
                                      product: alt.product,
                                      matchScore: alt.matchScore,
                                      relatedActivity: entry.relatedActivity,
                                      selected: true,
                                    })
                                  }
                                  className="flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                                >
                                  <PlusCircle className="size-3" aria-hidden />
                                  선택
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ) : undefined
              }
            />
          )
        })}
      </ul>

      {detail && (
        <ProductDetailModal
          product={detail.product}
          matchScore={detail.matchScore}
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  )
}

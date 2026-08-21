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
import CategoryIcon from './CategoryIcon'
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

      <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {entries.map((entry) => {
          const rec = recommendations.find(
            (r) => r.product.id === entry.product.id,
          )
          const alternatives = rec?.alternatives ?? []
          const isExpanded = expandedAlt === entry.product.id
          return (
            <li
              key={entry.product.id}
              className={`rounded-xl border p-4 transition-colors ${
                entry.selected
                  ? 'border-emerald-300 bg-emerald-50/40'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={entry.selected}
                  onChange={() => toggleSelected(entry.product.id)}
                  aria-label={`${entry.product.name} 견적 포함`}
                  className="mt-1 size-4 accent-emerald-600"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDetail({
                      product: entry.product,
                      matchScore: entry.matchScore,
                    })
                  }
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
                    <CategoryIcon
                      category={entry.product.category}
                      className="size-6"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {entry.product.name}
                      </p>
                      {entry.matchScore > 0 && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                          {Math.round(entry.matchScore * 100)}% 일치
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-bold text-emerald-700">
                      {formatKrw(entry.product.unitPrice)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {entry.product.description}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      관련 활동: {entry.relatedActivity}
                    </p>
                  </div>
                </button>
              </div>

              {alternatives.length > 0 && (
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
              )}
            </li>
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

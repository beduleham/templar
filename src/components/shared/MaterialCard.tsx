import { useState } from 'react'
import type { CatalogProduct } from '../../api/products'
import { formatKrw } from '../../lib/quotation'
import CategoryIcon from '../plan/CategoryIcon'

const SUPPLIER_NAME = '누리에듀'

/** 누리과정 영역별 파스텔 칩 색상 */
const nuriChipStyles: Record<string, string> = {
  '신체운동·건강': 'bg-blue-50 text-blue-600',
  의사소통: 'bg-violet-50 text-violet-600',
  사회관계: 'bg-rose-50 text-rose-600',
  예술경험: 'bg-amber-50 text-amber-700',
  자연탐구: 'bg-emerald-50 text-emerald-700',
}

interface MaterialCardProps {
  product: CatalogProduct
  isSelected: boolean
  onToggle: () => void
  /** 매칭 점수 (0~1). 있으면 % 배지로 표시 */
  matchScore?: number
  /** 이 상품이 매칭된 대표 활동명 */
  relatedActivity?: string
  /** 카드 본문 클릭 시 상세 모달 열기 */
  onOpenDetail: () => void
  /** 카드 하단 부가 영역 (대체 추천 등) */
  footer?: React.ReactNode
}

/**
 * 추천 교재·교구 상세 카드.
 * 이미지(실패 시 카테고리 아이콘 플레이스홀더), 공급사, 단가, 적정 연령,
 * 누리과정 연계 태그, 선택/제외 토글을 제공한다.
 */
export default function MaterialCard({
  product,
  isSelected,
  onToggle,
  matchScore,
  relatedActivity,
  onOpenDetail,
  footer,
}: MaterialCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = product.imageUrl && !imageFailed

  return (
    <li
      className={`rounded-xl border p-4 shadow-md transition-transform hover:scale-[1.02] ${
        isSelected
          ? 'border-emerald-300 bg-emerald-50/40'
          : 'border-slate-200 bg-white opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          aria-label={`${product.name} 견적 포함`}
          className="mt-1 size-4 accent-emerald-600"
        />
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          {showImage ? (
            <img
              src={product.imageUrl}
              alt={`${product.name} 이미지`}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="size-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600"
              aria-label="상품 이미지 준비 중"
            >
              <CategoryIcon category={product.category} className="size-6" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">{product.name}</p>
              {matchScore !== undefined && matchScore > 0 && (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                  {Math.round(matchScore * 100)}% 일치
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{SUPPLIER_NAME}</p>
            <p className="mt-0.5 text-sm font-bold text-emerald-700">
              {formatKrw(product.unitPrice)}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {product.targetAge}
              </span>
              {product.nuriDomain && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    nuriChipStyles[product.nuriDomain] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  #{product.nuriDomain}
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
              {product.description}
            </p>
            {relatedActivity && (
              <p className="mt-1 text-[11px] text-slate-400">
                관련 활동: {relatedActivity}
              </p>
            )}
          </div>
        </button>
      </div>
      {footer}
    </li>
  )
}

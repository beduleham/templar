import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { CatalogProduct } from '../../api/products'
import { formatKrw } from '../../lib/quotation'
import CategoryIcon from './CategoryIcon'

interface ProductDetailModalProps {
  product: CatalogProduct
  matchScore?: number
  onClose: () => void
}

export default function ProductDetailModal({
  product,
  matchScore,
  onClose,
}: ProductDetailModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${product.name} 상세 정보`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50"
        aria-label="상세 정보 닫기"
        tabIndex={-1}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="닫기"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-50 p-4 text-emerald-600">
            <CategoryIcon category={product.category} className="size-10" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{product.name}</h2>
            <p className="mt-0.5 text-sm font-bold text-emerald-700">
              {formatKrw(product.unitPrice)}
            </p>
            {matchScore !== undefined && matchScore > 0 && (
              <p className="mt-1 text-xs font-semibold text-sky-600">
                계획안 활동과 {Math.round(matchScore * 100)}% 일치
              </p>
            )}
          </div>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 font-medium text-slate-400">카테고리</dt>
            <dd className="text-slate-700">{product.category}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 font-medium text-slate-400">대상 연령</dt>
            <dd className="text-slate-700">{product.targetAge}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 font-medium text-slate-400">구매 단위</dt>
            <dd className="text-slate-700">
              {product.isPerStudent ? '개인별 (인원수만큼)' : '학급 공용'}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 font-medium text-slate-400">상세 설명</dt>
            <dd className="text-slate-700">{product.description}</dd>
          </div>
        </dl>

        <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          공급업체 등록 상품만 추천됩니다. 실제 재고와 단가는 견적서 발행 시점 기준입니다.
        </p>
      </div>
    </div>
  )
}

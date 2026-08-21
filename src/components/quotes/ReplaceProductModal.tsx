import { X } from 'lucide-react'
import { useEffect } from 'react'
import { listAvailableProducts } from '../../api/productStore'
import CategoryIcon from '../plan/CategoryIcon'
import { formatKrw } from '../../lib/quotation'
import type { SupplierProduct } from '../../lib/supplierProduct'

interface ReplaceProductModalProps {
  /** 교체 대상 항목명 */
  targetName: string
  /** 이미 견적에 포함된 상품 id 목록 (목록에서 제외) */
  excludeIds: string[]
  onSelect: (product: SupplierProduct) => void
  onClose: () => void
}

/** 대체 교재 선택 모달 — 공급업체 등록 상품만 노출한다 (임의 상품 추가 불가) */
export default function ReplaceProductModal({
  targetName,
  excludeIds,
  onSelect,
  onClose,
}: ReplaceProductModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const candidates = listAvailableProducts().filter(
    (p) => !excludeIds.includes(p.id),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="대체 교재 선택"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50"
        aria-label="닫기"
        tabIndex={-1}
      />
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">대체 교재 선택</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              '{targetName}'을(를) 아래 공급업체 등록 상품으로 교체합니다. 단가는
              등록된 값이 그대로 적용됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            <X className="size-5" />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-slate-100">
          {candidates.length === 0 ? (
            <li className="py-8 text-center text-sm text-slate-400">
              교체 가능한 상품이 없습니다.
            </li>
          ) : (
            candidates.map((product) => (
              <li key={product.id} className="flex items-center gap-3 py-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <CategoryIcon category={product.category} className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {product.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {product.targetAge} · {product.category} ·{' '}
                    {formatKrw(product.unitPrice)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(product)}
                  className="shrink-0 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  이 상품으로 교체
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ProductInput } from '../../api/productStore'
import { NURI_AREAS } from '../../lib/plan'
import { PRODUCT_TARGET_AGES, type SupplierProduct } from '../../lib/supplierProduct'

interface ProductFormModalProps {
  /** 수정 대상 (없으면 신규 등록) */
  product?: SupplierProduct
  onSubmit: (input: ProductInput) => void
  onClose: () => void
  errorMessage?: string | null
}

const emptyForm: ProductInput = {
  productCode: '',
  name: '',
  category: '',
  targetAge: PRODUCT_TARGET_AGES[0],
  nuriDomain: NURI_AREAS[0],
  unitPrice: 0,
  description: '',
  isPerStudent: true,
  isAvailable: true,
}

const inputClass =
  'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

export default function ProductFormModal({
  product,
  onSubmit,
  onClose,
  errorMessage,
}: ProductFormModalProps) {
  const [form, setForm] = useState<ProductInput>(
    product
      ? {
          productCode: product.productCode,
          name: product.name,
          category: product.category,
          targetAge: product.targetAge,
          nuriDomain: product.nuriDomain,
          unitPrice: product.unitPrice,
          description: product.description ?? '',
          isPerStudent: product.isPerStudent,
          isAvailable: product.isAvailable,
        }
      : emptyForm,
  )
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const missing = {
    productCode: form.productCode.trim() === '',
    name: form.name.trim() === '',
    category: form.category.trim() === '',
  }
  const invalid = missing.productCode || missing.name || missing.category

  const handleSubmit = () => {
    setTouched(true)
    if (invalid) return
    onSubmit({
      ...form,
      productCode: form.productCode.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      unitPrice: Math.max(0, Math.floor(form.unitPrice) || 0),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={product ? '상품 수정' : '상품 등록'}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50"
        aria-label="닫기"
        tabIndex={-1}
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {product ? '상품 수정' : '상품 등록'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-500">
            상품코드 *
            <input
              value={form.productCode}
              onChange={(e) => setForm({ ...form, productCode: e.target.value })}
              placeholder="예: NURI-013"
              className={inputClass}
            />
            {touched && missing.productCode && (
              <p className="mt-1 text-xs text-red-600">상품코드를 입력해 주세요.</p>
            )}
          </label>
          <label className="block text-xs font-medium text-slate-500">
            상품명 *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
            {touched && missing.name && (
              <p className="mt-1 text-xs text-red-600">상품명을 입력해 주세요.</p>
            )}
          </label>
          <label className="block text-xs font-medium text-slate-500">
            카테고리 *
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="예: 미술, 과학탐구"
              className={inputClass}
            />
            {touched && missing.category && (
              <p className="mt-1 text-xs text-red-600">카테고리를 입력해 주세요.</p>
            )}
          </label>
          <label className="block text-xs font-medium text-slate-500">
            단가 (원) *
            <input
              type="number"
              min={0}
              step={100}
              value={form.unitPrice}
              onChange={(e) =>
                setForm({ ...form, unitPrice: Number(e.target.value) })
              }
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            대상 연령 *
            <select
              value={form.targetAge}
              onChange={(e) => setForm({ ...form, targetAge: e.target.value })}
              className={inputClass}
            >
              {PRODUCT_TARGET_AGES.map((age) => (
                <option key={age}>{age}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500">
            누리과정 영역 *
            <select
              value={form.nuriDomain}
              onChange={(e) => setForm({ ...form, nuriDomain: e.target.value })}
              className={inputClass}
            >
              {NURI_AREAS.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500 sm:col-span-2">
            상세 설명
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`${inputClass} resize-none`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isPerStudent}
              onChange={(e) => setForm({ ...form, isPerStudent: e.target.checked })}
              className="size-4 accent-emerald-600"
            />
            개인별 지급 (수량 = 인원수)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isAvailable}
              onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
              className="size-4 accent-emerald-600"
            />
            판매 중 (추천·견적 노출)
          </label>
        </div>

        {errorMessage && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {product ? '수정 저장' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}

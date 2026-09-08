import { Inbox, Minus, Plus, Repeat, Trash2 } from 'lucide-react'
import type { EstimateItem } from '../../lib/estimate'

interface QuoteTableProps {
  items: EstimateItem[]
  onQuantityChange: (itemId: string, quantity: number) => void
  onDelete: (itemId: string) => void
  onReplace: (itemId: string) => void
  /** 견적 확정 후 편집 잠금 */
  readOnly?: boolean
}

const krw = (n: number) => n.toLocaleString('ko-KR')

export default function QuoteTable({
  items,
  onQuantityChange,
  onDelete,
  onReplace,
  readOnly = false,
}: QuoteTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white py-14 text-center">
        <Inbox className="size-8 text-slate-300" aria-hidden />
        <p className="text-sm text-slate-400">
          견적 항목이 없습니다. AI 교육계획안에서 교재를 선택해 보세요.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-140 text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <th className="px-4 py-3 font-semibold">품목명</th>
            <th className="px-4 py-3 text-center font-semibold">구분</th>
            <th className="px-4 py-3 text-right font-semibold">단가</th>
            <th className="px-4 py-3 text-center font-semibold">수량</th>
            <th className="px-4 py-3 text-right font-semibold">소계</th>
            {!readOnly && (
              <th className="px-4 py-3 text-center font-semibold">관리</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 font-medium text-slate-800">
                {item.name}
                {item.isManuallyEdited && !readOnly && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    수동 조정됨
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.isPerStudent
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-sky-50 text-sky-700'
                  }`}
                >
                  {item.isPerStudent ? '개인별' : '학급 공용'}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {krw(item.unitPrice)}원
              </td>
              <td className="px-4 py-3">
                <div
                  className={`mx-auto flex w-fit items-center rounded-lg border border-slate-200 ${
                    readOnly ? 'opacity-60' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                    disabled={readOnly || item.quantity <= 1}
                    aria-label={`${item.name} 수량 감소`}
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={item.quantity}
                    disabled={readOnly}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10)
                      onQuantityChange(item.id, Number.isNaN(next) ? 1 : next)
                    }}
                    aria-label={`${item.name} 수량`}
                    className="w-14 border-x border-slate-200 py-1 text-center text-sm font-medium outline-none disabled:bg-slate-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                    disabled={readOnly}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                    aria-label={`${item.name} 수량 증가`}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {krw(item.unitPrice * item.quantity)}원
              </td>
              {!readOnly && (
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onReplace(item.id)}
                      className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      aria-label={`${item.name} 대체`}
                    >
                      <Repeat className="size-3.5" aria-hidden />
                      대체
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`${item.name} 삭제`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

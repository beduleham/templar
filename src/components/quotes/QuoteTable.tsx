import { Minus, Plus } from 'lucide-react'
import type { QuoteItem } from '../../lib/quotation'

interface QuoteTableProps {
  items: QuoteItem[]
  onQuantityChange: (productId: string, quantity: number) => void
}

const krw = (n: number) => n.toLocaleString('ko-KR')

export default function QuoteTable({ items, onQuantityChange }: QuoteTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-130 text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <th className="px-4 py-3 font-semibold">품목명</th>
            <th className="px-4 py-3 text-right font-semibold">단가</th>
            <th className="px-4 py-3 text-center font-semibold">수량</th>
            <th className="px-4 py-3 text-right font-semibold">공급가액</th>
            <th className="px-4 py-3 text-right font-semibold">부가세</th>
            <th className="px-4 py-3 text-right font-semibold">금액</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.productId}>
              <td className="px-4 py-3 font-medium text-slate-800">
                {item.productName}
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {krw(item.unitPrice)}원
              </td>
              <td className="px-4 py-3">
                <div className="mx-auto flex w-fit items-center rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => onQuantityChange(item.productId, item.quantity - 1)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                    disabled={item.quantity <= 1}
                    aria-label={`${item.productName} 수량 감소`}
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10)
                      if (!Number.isNaN(next)) onQuantityChange(item.productId, next)
                    }}
                    aria-label={`${item.productName} 수량`}
                    className="w-14 border-x border-slate-200 py-1 text-center text-sm font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => onQuantityChange(item.productId, item.quantity + 1)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100"
                    aria-label={`${item.productName} 수량 증가`}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {krw(item.supplyValue)}원
              </td>
              <td className="px-4 py-3 text-right text-slate-600">{krw(item.tax)}원</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {krw(item.totalItemAmount)}원
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

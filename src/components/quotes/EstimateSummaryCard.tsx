import { CircleAlert, CircleCheck } from 'lucide-react'
import type { EstimateSummary } from '../../lib/estimate'
import { formatKrw } from '../../lib/quotation'

interface EstimateSummaryCardProps {
  summary: EstimateSummary
  totalBudget: number
}

export default function EstimateSummaryCard({
  summary,
  totalBudget,
}: EstimateSummaryCardProps) {
  const { totalAmount, remainingBudget, isOverBudget } = summary

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-1 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm">
        <p className="text-slate-500">
          입력 예산{' '}
          <span className="ml-1 font-semibold text-slate-800">
            {formatKrw(totalBudget)}
          </span>
        </p>
        <p className="text-slate-500">
          총 견적 금액{' '}
          <span
            className={`ml-1 text-lg font-bold ${
              isOverBudget ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {formatKrw(totalAmount)}
          </span>
        </p>
      </div>

      {isOverBudget ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700"
        >
          <CircleAlert className="size-5 shrink-0" aria-hidden />
          예산 초과 (초과액: -{Math.abs(remainingBudget).toLocaleString('ko-KR')}원) ·
          수량을 조정해 주세요.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-medium text-emerald-700">
          <CircleCheck className="size-5 shrink-0" aria-hidden />
          예산 내 안전 (잔액: +{remainingBudget.toLocaleString('ko-KR')}원)
        </div>
      )}
    </div>
  )
}

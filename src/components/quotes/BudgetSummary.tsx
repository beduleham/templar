import { CircleAlert, CircleCheck } from 'lucide-react'
import { budgetStatus, formatKrw, type QuoteTotals } from '../../lib/quotation'

interface BudgetSummaryProps {
  totals: QuoteTotals
  totalBudget: number
}

export default function BudgetSummary({ totals, totalBudget }: BudgetSummaryProps) {
  const status = budgetStatus(totals.totalAmount, totalBudget)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-1 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm">
        <p className="text-slate-500">
          총 공급가액{' '}
          <span className="ml-1 font-semibold text-slate-800">
            {formatKrw(totals.supplyTotal)}
          </span>
        </p>
        <p className="text-slate-500">
          부가세{' '}
          <span className="ml-1 font-semibold text-slate-800">
            {formatKrw(totals.taxTotal)}
          </span>
        </p>
        <p className="text-slate-500">
          총 합계 금액{' '}
          <span
            className={`ml-1 text-lg font-bold ${
              status.over ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {formatKrw(totals.totalAmount)}
          </span>
        </p>
      </div>

      {status.over ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700"
        >
          <CircleAlert className="size-5 shrink-0" aria-hidden />
          예산을 {formatKrw(status.diff)} 초과했습니다. 수량을 조정해 주세요.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-medium text-emerald-700">
          <CircleCheck className="size-5 shrink-0" aria-hidden />
          예산 충족 · 남은 예산 {formatKrw(status.diff)}
        </div>
      )}
    </div>
  )
}

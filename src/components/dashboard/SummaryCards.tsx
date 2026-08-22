import { FileSpreadsheet, NotebookPen, Puzzle, type LucideIcon } from 'lucide-react'
import type { DashboardSummary } from '../../api/dashboard'

interface SummaryCardsProps {
  summary: DashboardSummary | null
  loading: boolean
}

interface CardDef {
  label: string
  unit: string
  icon: LucideIcon
  accent: string
  value: (s: DashboardSummary) => number
}

const cards: CardDef[] = [
  {
    label: '이번 달 생성한 교육계획안',
    unit: '건',
    icon: NotebookPen,
    accent: 'bg-emerald-50 text-emerald-700',
    value: (s) => s.monthlyPlanCount,
  },
  {
    label: '진행 중인 견적서',
    unit: '건',
    icon: FileSpreadsheet,
    accent: 'bg-amber-50 text-amber-700',
    value: (s) => s.pendingEstimateCount,
  },
  {
    label: 'AI 매칭 교재·교구',
    unit: '개',
    icon: Puzzle,
    accent: 'bg-sky-50 text-sky-700',
    value: (s) => s.matchedMaterialCount,
  },
]

export default function SummaryCards({ summary, loading }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map(({ label, unit, icon: Icon, accent, value }) => (
        <div
          key={label}
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className={`rounded-lg p-3 ${accent}`}>
            <Icon className="size-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-500">{label}</p>
            {loading || !summary ? (
              <div className="mt-1.5 h-7 w-16 animate-pulse rounded bg-slate-200" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">
                {value(summary).toLocaleString('ko-KR')}
                <span className="ml-0.5 text-sm font-medium text-slate-400">
                  {unit}
                </span>
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

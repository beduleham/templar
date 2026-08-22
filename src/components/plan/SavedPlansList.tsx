import { FolderOpen, Trash2 } from 'lucide-react'
import type { SavedPlan } from '../../lib/plan'

interface SavedPlansListProps {
  plans: SavedPlan[]
  currentId?: string
  onOpen: (plan: SavedPlan) => void
  onDelete: (id: string) => void
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function SavedPlansList({
  plans,
  currentId,
  onOpen,
  onDelete,
}: SavedPlansListProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">저장된 계획안</h2>
      {plans.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          아직 저장된 계획안이 없습니다. 계획안을 생성하고 저장해 보세요.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {plans.map((plan) => (
            <li key={plan.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {plan.content.title}
                  {plan.id === currentId && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      편집 중
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatDateTime(plan.updatedAt)} 저장
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpen(plan)}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <FolderOpen className="size-3.5" aria-hidden />
                열기
              </button>
              <button
                type="button"
                onClick={() => onDelete(plan.id)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`${plan.content.title} 삭제`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

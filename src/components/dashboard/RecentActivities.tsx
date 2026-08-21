import { Download, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import type {
  DashboardRecent,
  EstimateStatus,
  PlanStatus,
  RecentEstimate,
  RecentPlan,
} from '../../api/dashboard'
import DashboardCard from './DashboardCard'

const MAX_ITEMS = 5

const statusBadges: Record<PlanStatus | EstimateStatus, { label: string; className: string }> = {
  IN_PROGRESS: { label: '진행중', className: 'bg-amber-50 text-amber-700' },
  PENDING: { label: '대기', className: 'bg-amber-50 text-amber-700' },
  COMPLETED: { label: '완료', className: 'bg-emerald-50 text-emerald-700' },
}

const byUpdatedAtDesc = (a: { updatedAt: string }, b: { updatedAt: string }) =>
  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  })

const formatPrice = (price: number) => `${price.toLocaleString('ko-KR')}원`

function StatusBadge({ status }: { status: PlanStatus | EstimateStatus }) {
  const badge = statusBadges[status]
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}
    >
      {badge.label}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Inbox className="size-8 text-slate-300" aria-hidden />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function RowSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="h-11 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </ul>
  )
}

function PlanList({ plans }: { plans: RecentPlan[] }) {
  if (plans.length === 0) {
    return (
      <EmptyState message="아직 생성된 계획안이 없습니다. 첫 계획안을 만들어보세요!" />
    )
  }
  return (
    <ul className="divide-y divide-slate-100">
      {[...plans].sort(byUpdatedAtDesc).slice(0, MAX_ITEMS).map((plan) => (
        <li key={plan.id}>
          <Link
            to="/teacher/plan"
            className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {plan.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDate(plan.updatedAt)} 수정
              </p>
            </div>
            <StatusBadge status={plan.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function EstimateList({ estimates }: { estimates: RecentEstimate[] }) {
  if (estimates.length === 0) {
    return <EmptyState message="최근 작업 내역이 없습니다" />
  }
  return (
    <ul className="divide-y divide-slate-100">
      {[...estimates].sort(byUpdatedAtDesc).slice(0, MAX_ITEMS).map((est) => (
        <li key={est.id} className="flex items-center gap-3 px-2 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">
              {est.title}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {formatDate(est.updatedAt)} · {formatPrice(est.totalPrice)}
            </p>
          </div>
          <StatusBadge status={est.status} />
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`${est.title} 다운로드`}
            title="다운로드 (PDF/Excel 발행 기능 준비 중)"
          >
            <Download className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}

interface RecentActivitiesProps {
  recent: DashboardRecent | null
  loading: boolean
}

export default function RecentActivities({ recent, loading }: RecentActivitiesProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DashboardCard
        title="최근 교육계획안"
        action={
          <Link
            to="/teacher/plan"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            전체 보기
          </Link>
        }
      >
        {loading || !recent ? (
          <RowSkeleton />
        ) : (
          <PlanList plans={recent.recentPlans} />
        )}
      </DashboardCard>

      <DashboardCard
        title="최근 견적서"
        action={
          <Link
            to="/teacher/quotes"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            전체 보기
          </Link>
        }
      >
        {loading || !recent ? (
          <RowSkeleton />
        ) : (
          <EstimateList estimates={recent.recentEstimates} />
        )}
      </DashboardCard>
    </div>
  )
}

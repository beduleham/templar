import { useEffect, useState } from 'react'
import {
  fetchDashboardRecent,
  fetchDashboardSummary,
  type DashboardRecent,
  type DashboardSummary,
} from '../../api/dashboard'
import NuriGuideWidget from '../../components/dashboard/NuriGuideWidget'
import QuickActions from '../../components/dashboard/QuickActions'
import RecentActivities from '../../components/dashboard/RecentActivities'
import SummaryCards from '../../components/dashboard/SummaryCards'

export default function TeacherDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recent, setRecent] = useState<DashboardRecent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchDashboardSummary(), fetchDashboardRecent()])
      .then(([summaryData, recentData]) => {
        if (cancelled) return
        setSummary(summaryData)
        setRecent(recentData)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          교육계획안과 견적 현황을 한눈에 확인하세요.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">
            대시보드 정보를 불러오지 못했습니다.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(false)
              setLoading(true)
              setReloadKey((k) => k + 1)
            }}
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <SummaryCards summary={summary} loading={loading} />
          <QuickActions />
          <RecentActivities recent={recent} loading={loading} />
          <NuriGuideWidget />
        </>
      )}
    </div>
  )
}

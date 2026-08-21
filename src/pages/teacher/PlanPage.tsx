import { CircleAlert, Loader2, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { generatePlan } from '../../api/planGenerator'
import { deletePlan, listPlans, savePlan } from '../../api/planStorage'
import { productCatalog } from '../../api/products'
import PlanSetupForm from '../../components/plan/PlanSetupForm'
import PlanTable from '../../components/plan/PlanTable'
import RecommendationPanel from '../../components/plan/RecommendationPanel'
import SavedPlansList from '../../components/plan/SavedPlansList'
import {
  updateActivity,
  type GeneratePlanParams,
  type PlanContent,
  type SavedPlan,
} from '../../lib/plan'
import { recommendForPlan } from '../../lib/similarity'
import { useRecommendationStore } from '../../store/useRecommendationStore'

const planActivities = (content: PlanContent) =>
  content.schedule.flatMap((p) => p.activities)

export default function PlanPage() {
  const [params, setParams] = useState<GeneratePlanParams>({
    targetAge: '만 5세',
    planType: 'WEEKLY',
    theme: '',
    subTheme: '',
  })
  const [content, setContent] = useState<PlanContent | null>(null)
  const [currentId, setCurrentId] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => listPlans())
  const [toast, setToast] = useState<string | null>(null)
  const setRecommendationEntries = useRecommendationStore((s) => s.setEntries)

  // 현재 계획안의 활동 기반 추천 (대체 추천 목록 렌더링용)
  const recommendations = useMemo(
    () => (content ? recommendForPlan(planActivities(content), productCatalog) : []),
    [content],
  )

  const seedRecommendations = (planContent: PlanContent) => {
    const recs = recommendForPlan(planActivities(planContent), productCatalog)
    setRecommendationEntries(
      recs.map((rec) => ({
        product: rec.product,
        matchScore: rec.matchScore,
        relatedActivity: rec.relatedActivity,
        selected: true,
      })),
    )
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const generated = await generatePlan(params)
      setContent(generated)
      setCurrentId(undefined)
      seedRecommendations(generated)
    } catch {
      setError('서버가 혼잡합니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleActivityChange = (
    period: string,
    area: string,
    patch: { activity_name: string; description: string },
  ) => {
    setContent((prev) => (prev ? updateActivity(prev, period, area, patch) : prev))
  }

  const handleSave = () => {
    if (!content) return
    try {
      const saved = savePlan(content, params.planType, currentId)
      setCurrentId(saved.id)
      setSavedPlans(listPlans())
      setToast('계획안이 저장되었습니다')
    } catch {
      setError('계획안 저장에 실패했습니다. 브라우저 저장소 상태를 확인해 주세요.')
    }
  }

  const handleOpen = (plan: SavedPlan) => {
    setContent(plan.content)
    setCurrentId(plan.id)
    setParams((prev) => ({ ...prev, planType: plan.planType }))
    setError(null)
    seedRecommendations(plan.content)
  }

  const handleDelete = (id: string) => {
    deletePlan(id)
    setSavedPlans(listPlans())
    if (id === currentId) setCurrentId(undefined)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI 교육계획안 수립</h1>
        <p className="mt-1 text-sm text-slate-500">
          연령과 주제를 선택하면 누리과정 5대 영역 기반 계획안 초안을 생성합니다.
          셀을 더블클릭해 직접 수정할 수 있습니다.
        </p>
      </div>

      <PlanSetupForm
        value={params}
        loading={loading}
        onChange={setParams}
        onGenerate={handleGenerate}
      />

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-14 text-sm font-medium text-slate-500 shadow-sm">
          <Loader2 className="size-5 animate-spin text-emerald-600" aria-hidden />
          누리과정 기반 계획안을 생성하고 있습니다...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700"
        >
          <CircleAlert className="size-5 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {content && !loading && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{content.title}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {content.target_age} · {content.theme}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Save className="size-4" aria-hidden />
                계획안 저장
              </button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {content.goals.map((goal) => (
                <li
                  key={goal}
                  className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
                >
                  {goal}
                </li>
              ))}
            </ul>
          </section>

          <PlanTable content={content} onActivityChange={handleActivityChange} />

          <RecommendationPanel recommendations={recommendations} />
        </>
      )}

      <SavedPlansList
        plans={savedPlans}
        currentId={currentId}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

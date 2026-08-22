import { CircleAlert, FileDown, Loader2, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import {
  GENERATION_TIMEOUT_MS,
  generatePlan,
  withTimeout,
} from '../../api/planGenerator'
import { deletePlan, listPlans, savePlan } from '../../api/planStorage'
import { listAvailableProducts } from '../../api/productStore'
import PlanSetupForm from '../../components/plan/PlanSetupForm'
import PlanTable from '../../components/plan/PlanTable'
import RecommendationPanel from '../../components/plan/RecommendationPanel'
import SavedPlansList from '../../components/plan/SavedPlansList'
import { downloadBlob } from '../../lib/download'
import { EXPORT_DISABLED, EXPORT_DISABLED_MESSAGE } from '../../lib/exportGate'
import {
  planTypeLabels,
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
  /** 저장되지 않은 변경사항 여부 (생성/편집 시 true, 저장/열기 시 false) */
  const [dirty, setDirty] = useState(false)
  const setRecommendationEntries = useRecommendationStore((s) => s.setEntries)

  // 미저장 상태 이탈 방지: SPA 라우팅 차단 + 브라우저 이탈(beforeunload) 경고
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (
      window.confirm('저장되지 않은 변경사항이 있습니다. 이동하시겠습니까?')
    ) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker])
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // 현재 계획안의 활동 기반 추천 (대체 추천 목록 렌더링용)
  const recommendations = useMemo(
    () =>
      content
        ? recommendForPlan(planActivities(content), listAvailableProducts(), 2, {
            targetAge: content.target_age,
          })
        : [],
    [content],
  )

  const seedRecommendations = (planContent: PlanContent) => {
    const recs = recommendForPlan(planActivities(planContent), listAvailableProducts(), 2, {
      targetAge: planContent.target_age,
    })
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
      const generated = await withTimeout(generatePlan(params), GENERATION_TIMEOUT_MS)
      setContent(generated)
      setCurrentId(undefined)
      setDirty(true)
      seedRecommendations(generated)
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleActivityChange = (
    period: string,
    area: string,
    patch: { activity_name?: string; description?: string; objective?: string },
  ) => {
    setContent((prev) => (prev ? updateActivity(prev, period, area, patch) : prev))
    setDirty(true)
  }

  const handleSave = () => {
    if (!content) return
    try {
      const saved = savePlan(content, params.planType, currentId)
      setCurrentId(saved.id)
      setSavedPlans(listPlans())
      setDirty(false)
      setToast('성공적으로 저장되었습니다.')
    } catch {
      setError('계획안 저장에 실패했습니다. 브라우저 저장소 상태를 확인해 주세요.')
    }
  }

  const handleOpen = (plan: SavedPlan) => {
    setContent(plan.content)
    setCurrentId(plan.id)
    setParams((prev) => ({ ...prev, planType: plan.planType }))
    setError(null)
    setDirty(false)
    seedRecommendations(plan.content)
  }

  const handleDelete = (id: string) => {
    deletePlan(id)
    setSavedPlans(listPlans())
    if (id === currentId) setCurrentId(undefined)
  }

  const [exportingPdf, setExportingPdf] = useState(false)
  const handlePdfDownload = async () => {
    if (!content || exportingPdf) return
    if (EXPORT_DISABLED) {
      setError(EXPORT_DISABLED_MESSAGE)
      return
    }
    setExportingPdf(true)
    try {
      const { generatePlanPdf, planPdfFileName } = await import(
        '../../lib/exportPlanPdf'
      )
      const entries = useRecommendationStore.getState().entries
      const blob = await generatePlanPdf({
        content,
        planTypeLabel: planTypeLabels[params.planType],
        institution: '누리 어린이집',
        recommendations: entries
          .filter((e) => e.selected)
          .map((e) => ({
            name: e.product.name,
            unitPrice: e.product.unitPrice,
            matchScore: e.matchScore,
            relatedActivity: e.relatedActivity,
          })),
        issuedAt: new Date(),
      })
      downloadBlob(blob, planPdfFileName('누리 어린이집', new Date()))
    } catch (error) {
      console.error('계획안 PDF 생성 실패:', error)
      setError('PDF 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setExportingPdf(false)
    }
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
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700"
        >
          <CircleAlert className="size-5 shrink-0" aria-hidden />
          {error}
          <button
            type="button"
            onClick={handleGenerate}
            className="ml-auto shrink-0 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            다시 시도
          </button>
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePdfDownload}
                  disabled={exportingPdf}
                  className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
                >
                  {exportingPdf ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <FileDown className="size-4" aria-hidden />
                  )}
                  PDF 다운로드
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Save className="size-4" aria-hidden />
                  {dirty ? '변경사항 저장' : '저장됨'}
                </button>
              </div>
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

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById('recommendation-panel')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              계획안 확정 및 교재 추천 받기 ↓
            </button>
          </div>

          <div id="recommendation-panel">
            <RecommendationPanel recommendations={recommendations} />
          </div>
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

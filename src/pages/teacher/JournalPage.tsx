import {
  CircleAlert,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Save,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { generateJournalDraft } from '../../api/journalGenerator'
import { getJournalByDate, saveJournal } from '../../api/journalStorage'
import { listPlans } from '../../api/planStorage'
import { downloadBlob } from '../../lib/download'
import {
  confirmAction,
  EXPORT_DISABLED,
  EXPORT_DISABLED_MESSAGE,
} from '../../lib/exportGate'
import {
  activitiesForDate,
  formatJournalDate,
  updateScheduleContent,
  type JournalEntry,
} from '../../lib/journal'
import { planTypeLabels } from '../../lib/plan'

const INSTITUTION = '누리 어린이집'

const todayISO = () => {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

export default function JournalPage() {
  const [dateISO, setDateISO] = useState(todayISO)
  const [schedule, setSchedule] = useState<JournalEntry[] | null>(
    () => getJournalByDate(todayISO())?.dailySchedule ?? null,
  )
  const [evaluation, setEvaluation] = useState(
    () => getJournalByDate(todayISO())?.activityEvaluation ?? '',
  )
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // 가장 최근 저장된 계획안을 기준으로 해당 일자의 활동을 찾는다
  const plan = useMemo(() => listPlans()[0], [])
  const activities = useMemo(
    () =>
      plan ? activitiesForDate(plan.content, plan.planType, dateISO) : null,
    [plan, dateISO],
  )

  // 일자 변경 시 저장된 보육일지를 불러온다 (이벤트 핸들러에서 호출)
  const applyDate = (next: string) => {
    setDateISO(next)
    const saved = getJournalByDate(next)
    setSchedule(saved?.dailySchedule ?? null)
    setEvaluation(saved?.activityEvaluation ?? '')
    setDirty(false)
    setError(null)
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  // 미저장 이탈 방지
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (confirmAction('저장되지 않은 변경사항이 있습니다. 이동하시겠습니까?')) {
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

  const handleGenerate = async () => {
    if (!plan || !activities || loading) return
    setLoading(true)
    setError(null)
    try {
      const draft = await generateJournalDraft({
        dateISO,
        targetAge: plan.content.target_age,
        theme: plan.content.theme,
        activities,
      })
      setSchedule(draft.dailySchedule)
      setEvaluation(draft.activityEvaluation)
      setDirty(true)
    } catch {
      setError('초안 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!schedule) return
    try {
      saveJournal({
        planId: plan?.id,
        journalDate: dateISO,
        dailySchedule: schedule,
        activityEvaluation: evaluation,
      })
      setDirty(false)
      setToast('성공적으로 저장되었습니다.')
    } catch {
      setError('저장에 실패했습니다. 브라우저 저장소 상태를 확인해주세요.')
    }
  }

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!schedule || exporting) return
    if (EXPORT_DISABLED) {
      setError(EXPORT_DISABLED_MESSAGE)
      return
    }
    setExporting(format)
    try {
      const { generateJournalPdf, generateJournalExcel, journalFileName } =
        await import('../../lib/exportJournal')
      const journal = {
        id: 'export',
        planId: plan?.id,
        journalDate: dateISO,
        dailySchedule: schedule,
        activityEvaluation: evaluation,
        createdAt: '',
        updatedAt: '',
      }
      const meta = {
        institution: INSTITUTION,
        targetAge: plan?.content.target_age ?? '',
        theme: plan?.content.theme ?? '',
      }
      if (format === 'pdf') {
        downloadBlob(
          await generateJournalPdf(journal, meta),
          journalFileName(INSTITUTION, dateISO, 'pdf'),
        )
      } else {
        downloadBlob(
          await generateJournalExcel(journal, meta),
          journalFileName(INSTITUTION, dateISO, 'xlsx'),
        )
      }
    } catch (err) {
      console.error('보육일지 파일 생성 실패:', err)
      setError('파일 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">보육일지 및 평가</h1>
        <p className="mt-1 text-sm text-slate-500">
          교육계획안과 연계된 일일 보육일지·활동 평가서 초안을 생성하고 검수하세요.
        </p>
      </div>

      {/* 일자 선택 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-xs font-medium text-slate-500">
            작성 일자
            <input
              type="date"
              value={dateISO}
              onChange={(e) => {
                if (
                  dirty &&
                  !confirmAction('저장되지 않은 변경사항이 있습니다. 날짜를 변경하시겠습니까?')
                ) {
                  return
                }
                applyDate(e.target.value)
              }}
              className="mt-1.5 block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <p className="pb-2 text-sm font-medium text-slate-700">
            {formatJournalDate(dateISO)}
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!activities || loading}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            AI 초안 생성
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* 좌측: 해당 일자 계획안 */}
        <section className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">해당 일자 교육계획안</h2>
          {!plan || !activities ? (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              해당 일자의 교육계획안이 존재하지 않습니다. 계획안을 먼저 작성해주세요.
            </div>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-400">
                {plan.content.title} ({planTypeLabels[plan.planType]})
              </p>
              <ul className="mt-3 space-y-2.5">
                {activities.map((activity) => (
                  <li
                    key={activity.area}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <p className="text-xs font-semibold text-emerald-700">
                      {activity.area}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {activity.activity_name}
                    </p>
                    {activity.materials && activity.materials.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        준비물: {activity.materials.join(', ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* 우측: 초안 편집 */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              일일 보육일지 · 활동 평가서
            </h2>
            {schedule && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  disabled={exporting !== null}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
                >
                  {exporting === 'pdf' ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <FileDown className="size-3.5" aria-hidden />
                  )}
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('excel')}
                  disabled={exporting !== null}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                >
                  {exporting === 'excel' ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <FileSpreadsheet className="size-3.5" aria-hidden />
                  )}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Save className="size-3.5" aria-hidden />
                  {dirty ? '저장하기' : '저장됨'}
                </button>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          {loading && (
            <div className="mt-6 flex items-center justify-center gap-3 py-14 text-sm font-medium text-slate-500">
              <Loader2 className="size-5 animate-spin text-emerald-600" aria-hidden />
              계획안을 바탕으로 보육일지 초안을 생성하고 있습니다...
            </div>
          )}

          {!loading && !schedule && (
            <p className="mt-6 py-14 text-center text-sm text-slate-400">
              'AI 초안 생성' 버튼을 눌러 보육일지 초안을 만들어 보세요.
            </p>
          )}

          {!loading && schedule && (
            <>
              <ul className="mt-4 space-y-3">
                {schedule.map((entry, index) => (
                  <li key={`${entry.time}-${index}`}>
                    <div className="flex items-baseline gap-2">
                      <span className="w-24 shrink-0 text-xs font-semibold text-slate-500">
                        {entry.time}
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {entry.activity}
                      </span>
                    </div>
                    <textarea
                      value={entry.content}
                      onChange={(e) => {
                        setSchedule((prev) =>
                          prev
                            ? updateScheduleContent(prev, index, e.target.value)
                            : prev,
                        )
                        setDirty(true)
                      }}
                      rows={2}
                      aria-label={`${entry.activity} 실행 내용`}
                      className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </li>
                ))}
              </ul>

              <h3 className="mt-5 text-sm font-semibold text-slate-900">활동 평가</h3>
              <textarea
                value={evaluation}
                onChange={(e) => {
                  setEvaluation(e.target.value)
                  setDirty(true)
                }}
                rows={5}
                aria-label="활동 평가"
                className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </>
          )}
        </section>
      </div>

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

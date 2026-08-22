import {
  CircleAlert,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { generateDeliberationReport } from '../../api/deliberationGenerator'
import {
  budgetUsageRate,
  DELIBERATION_SECTIONS,
  deliberationTotal,
  updateItemQuantity,
  type DeliberationItem,
  type DeliberationReportResponse,
} from '../../lib/deliberation'
import { downloadBlob } from '../../lib/download'
import {
  confirmAction,
  EXPORT_DISABLED,
  EXPORT_DISABLED_MESSAGE,
} from '../../lib/exportGate'
import { formatKrw } from '../../lib/quotation'
import { useDeliberationStore } from '../../store/useDeliberationStore'

const INSTITUTION = '누리 어린이집'

export default function DeliberationPage() {
  const source = useDeliberationStore((s) => s.source)
  const [targetAge, setTargetAge] = useState(source?.targetAge ?? '만 3~5세')
  const [classSize, setClassSize] = useState(source?.classSize ?? 20)
  const [totalBudget, setTotalBudget] = useState(source?.totalBudget ?? 0)
  const [items, setItems] = useState<DeliberationItem[]>(source?.items ?? [])
  const [report, setReport] = useState<DeliberationReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const totalCost = deliberationTotal(items)
  const rate = budgetUsageRate(totalCost, totalBudget)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

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
    if (items.length === 0 || loading) return
    setLoading(true)
    setError(null)
    try {
      const generated = await generateDeliberationReport({
        targetAge,
        classSize,
        totalBudget,
        selectedItems: items,
      })
      setReport(generated)
      setDirty(true)
    } catch {
      setError('심의서 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!report || exporting) return
    if (EXPORT_DISABLED) {
      setError(EXPORT_DISABLED_MESSAGE)
      return
    }
    setExporting(format)
    try {
      const {
        generateDeliberationPdf,
        generateDeliberationExcel,
        deliberationFileName,
      } = await import('../../lib/exportDeliberation')
      const docData = {
        request: { targetAge, classSize, totalBudget, selectedItems: items },
        report,
        institution: INSTITUTION,
        issuedAt: new Date(),
      }
      if (format === 'pdf') {
        downloadBlob(
          await generateDeliberationPdf(docData),
          deliberationFileName(INSTITUTION, new Date(), 'pdf'),
        )
      } else {
        downloadBlob(
          await generateDeliberationExcel(docData),
          deliberationFileName(INSTITUTION, new Date(), 'xlsx'),
        )
      }
      setDirty(false)
      setToast('다운로드가 시작되었습니다.')
    } catch (err) {
      console.error('심의서 파일 생성 실패:', err)
      setError('파일 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setExporting(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">운영위원회 교구 심의서</h1>
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          심의 대상 교구가 없습니다. 견적 화면에서 [운영위원회 심의서 생성] 버튼으로
          진입해 주세요.
        </div>
        <Link
          to="/teacher/quotes"
          className="inline-block rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          견적 화면으로 이동
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">운영위원회 교구 심의서</h1>
        <p className="mt-1 text-sm text-slate-500">
          신규 교재 도입 목적과 예산 대비 타당성을 정리한 심의서를 자동 생성합니다.
          금액은 입력값에서 자동 계산됩니다.
        </p>
      </div>

      {/* 학급 정보 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">학급 정보</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="block text-xs font-medium text-slate-500">
            대상 연령
            <input
              value={targetAge}
              onChange={(e) => setTargetAge(e.target.value)}
              className="mt-1.5 block w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            학급 인원수 (명)
            <input
              type="number"
              min={1}
              value={classSize}
              onChange={(e) => setClassSize(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1.5 block w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            배정 예산 (원)
            <input
              type="number"
              min={0}
              step={10000}
              value={totalBudget}
              onChange={(e) => setTotalBudget(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1.5 block w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            AI 심의서 초안 생성
          </button>
        </div>
      </section>

      {/* 심의 대상 교구 */}
      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-130 text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-semibold">품명</th>
              <th className="px-4 py-3 text-center font-semibold">누리과정 영역</th>
              <th className="px-4 py-3 text-center font-semibold">수량</th>
              <th className="px-4 py-3 text-right font-semibold">단가</th>
              <th className="px-4 py-3 text-right font-semibold">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.itemId}>
                <td className="px-4 py-3 font-medium text-slate-800">{item.itemName}</td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {item.curriculumArea}
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      setItems((prev) =>
                        updateItemQuantity(prev, item.itemId, Number(e.target.value)),
                      )
                      setDirty(true)
                    }}
                    aria-label={`${item.itemName} 수량`}
                    className="w-16 rounded-lg border border-slate-200 py-1 text-center text-sm outline-none focus:border-emerald-500"
                  />
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {formatKrw(item.unitPrice)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatKrw(item.unitPrice * item.quantity)}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50">
              <td colSpan={4} className="px-4 py-3 text-sm font-semibold">
                총 소요 금액{rate !== null && ` (배정 예산 대비 ${rate}%)`}
              </td>
              <td className="px-4 py-3 text-right text-base font-bold text-slate-900">
                {formatKrw(totalCost)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-14 text-sm font-medium text-slate-500 shadow-sm">
          <Loader2 className="size-5 animate-spin text-emerald-600" aria-hidden />
          교구 정보를 바탕으로 심의서 초안을 생성하고 있습니다...
        </div>
      )}

      {report && !loading && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              심의서 초안 (검수 후 다운로드하세요)
            </h2>
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
                PDF 다운로드
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
                Excel 다운로드
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {DELIBERATION_SECTIONS.map((section) => (
              <div key={section.key}>
                <h3 className="text-sm font-semibold text-emerald-700">
                  {section.label}
                </h3>
                <textarea
                  value={report[section.key]}
                  onChange={(e) => {
                    setReport((prev) =>
                      prev ? { ...prev, [section.key]: e.target.value } : prev,
                    )
                    setDirty(true)
                  }}
                  rows={4}
                  aria-label={section.label}
                  className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            ))}
          </div>
        </section>
      )}

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

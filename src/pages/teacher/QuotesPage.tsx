import { FileDown, FileSpreadsheet, Loader2, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createOrder } from '../../api/orderStore'
import { listAvailableProducts } from '../../api/productStore'
import EstimateSummaryCard from '../../components/quotes/EstimateSummaryCard'
import QuoteTable from '../../components/quotes/QuoteTable'
import { useEstimate } from '../../hooks/useEstimate'
import { downloadBlob } from '../../lib/download'
import { computeItem, computeTotals, formatKrw } from '../../lib/quotation'
import {
  selectedProducts,
  useRecommendationStore,
} from '../../store/useRecommendationStore'

const RECIPIENT = '누리 어린이집'
const DEFAULT_HEADCOUNT = 1

type ExportFormat = 'pdf' | 'excel'

const dateStamp = () => {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}${mm}${dd}`
}

/** 숫자 이외의 문자를 제거하고 정수로 파싱 (빈 값은 0). */
const parseDigits = (raw: string) => {
  const digits = raw.replace(/\D/g, '')
  return digits === '' ? 0 : Number.parseInt(digits, 10)
}

export default function QuotesPage() {
  const [headcountInput, setHeadcountInput] = useState(String(DEFAULT_HEADCOUNT))
  const [budgetInput, setBudgetInput] = useState('')
  // AI 추천 단계에서 선택한 교재가 있으면 그 목록으로, 없으면 기본 추천으로 견적 구성
  const recommendationEntries = useRecommendationStore((s) => s.entries)
  const [quoteProducts] = useState(() => {
    const picked = selectedProducts(useRecommendationStore.getState().entries)
    return picked.length > 0 ? picked : listAvailableProducts().slice(0, 3)
  })
  const fromRecommendation =
    selectedProducts(recommendationEntries).length > 0
  const {
    headcount,
    totalBudget,
    items,
    summary,
    setHeadcount,
    setTotalBudget,
    updateQuantity,
  } = useEstimate(quoteProducts, DEFAULT_HEADCOUNT)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [exportError, setExportError] = useState(false)
  const [orderToast, setOrderToast] = useState<string | null>(null)

  useEffect(() => {
    if (!orderToast) return
    const timer = setTimeout(() => setOrderToast(null), 3000)
    return () => clearTimeout(timer)
  }, [orderToast])

  const handleHeadcountChange = (raw: string) => {
    const value = parseDigits(raw)
    setHeadcountInput(raw === '' ? '' : String(value))
    setHeadcount(value)
  }

  const handleBudgetChange = (raw: string) => {
    const value = parseDigits(raw)
    setBudgetInput(raw === '' ? '' : String(value))
    setTotalBudget(value)
  }

  const exportableItems = items.filter((item) => item.quantity > 0)

  // 발주 요청: 현재 견적을 공급업체 주문 목록으로 전송한다.
  // (실제 인증 도입 전까지 기관/담당자 정보는 Mock 세션 값 사용)
  const handleOrderRequest = () => {
    if (exportableItems.length === 0) return
    createOrder({
      institutionName: RECIPIENT,
      contactPerson: '김하늘 교사',
      phone: '010-1234-5678',
      studentCount: headcount,
      totalBudget,
      items: exportableItems.map((item) => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    })
    setOrderToast('발주 요청이 접수되었습니다. 공급업체가 곧 확인합니다.')
  }

  const handleExport = async (format: ExportFormat) => {
    if (exportableItems.length === 0 || exporting) return
    setExporting(format)
    setExportError(false)
    try {
      const quoteItems = exportableItems.map((item) => {
        const product = quoteProducts.find((p) => p.id === item.id)
        return computeItem(
          product ?? { ...item, taxRate: 0, isPerStudent: item.isPerStudent },
          item.quantity,
        )
      })
      const docData = {
        recipient: RECIPIENT,
        studentCount: headcount,
        totalBudget,
        items: quoteItems,
        totals: computeTotals(quoteItems),
        issuedAt: new Date(),
      }
      if (format === 'pdf') {
        const { generateQuotationPdf } = await import('../../lib/exportPdf')
        downloadBlob(await generateQuotationPdf(docData), `견적서_${dateStamp()}.pdf`)
      } else {
        const { generateQuotationExcel } = await import('../../lib/exportExcel')
        downloadBlob(
          await generateQuotationExcel(docData),
          `견적서_${dateStamp()}.xlsx`,
        )
      }
    } catch (error) {
      console.error('견적서 파일 생성 실패:', error)
      setExportError(true)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">교재 추천 및 견적서</h1>
        <p className="mt-1 text-sm text-slate-500">
          인원수와 예산을 입력하면 추천 교재 기준으로 견적 금액이 실시간 산출됩니다.
        </p>
        {fromRecommendation && (
          <p className="mt-2 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            AI 교육계획안에서 선택한 교재로 구성된 견적입니다
          </p>
        )}
      </div>

      {/* 인원수/예산 입력 (실시간 반영) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">견적 조건</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="block text-xs font-medium text-slate-500">
            학급 인원수 (명)
            <input
              type="text"
              inputMode="numeric"
              value={headcountInput}
              onChange={(e) => handleHeadcountChange(e.target.value)}
              className="mt-1.5 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            총 예산 (원)
            <input
              type="text"
              inputMode="numeric"
              value={budgetInput}
              onChange={(e) => handleBudgetChange(e.target.value)}
              placeholder="예: 250000"
              className="mt-1.5 block w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <p className="pb-2 text-xs text-slate-400">
            개인별 항목 수량은 인원수와 자동 동기화되며, 직접 수정한 항목은 유지됩니다.
          </p>
        </div>
      </section>

      <QuoteTable items={items} onQuantityChange={updateQuantity} />

      {items.length > 0 && (
        <>
          <EstimateSummaryCard summary={summary} totalBudget={totalBudget} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null || exportableItems.length === 0}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
            >
              {exporting === 'pdf' ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FileDown className="size-4" aria-hidden />
              )}
              PDF 다운로드
            </button>
            <button
              type="button"
              onClick={() => handleExport('excel')}
              disabled={exporting !== null || exportableItems.length === 0}
              className="flex items-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              {exporting === 'excel' ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet className="size-4" aria-hidden />
              )}
              Excel 다운로드
            </button>
            <button
              type="button"
              onClick={handleOrderRequest}
              disabled={exportableItems.length === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Send className="size-4" aria-hidden />
              견적 발주 요청
            </button>
            {exportError && (
              <p role="alert" className="text-sm font-medium text-red-600">
                파일 생성에 실패했습니다. 다시 시도해 주세요.
              </p>
            )}
          </div>
        </>
      )}

      {orderToast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {orderToast}
        </div>
      )}

      {/* 추천 근거 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">AI 추천 교재·교구 정보</h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quoteProducts.map((product) => (
            <li
              key={product.id}
              className="rounded-lg border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{product.name}</p>
                <p className="shrink-0 text-sm font-bold text-emerald-700">
                  {formatKrw(product.unitPrice)}
                </p>
              </div>
              {product.description && (
                <p className="mt-1 text-xs text-slate-500">{product.description}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

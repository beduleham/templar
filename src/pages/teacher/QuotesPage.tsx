import { FileDown, FileSpreadsheet, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { recommendedProducts } from '../../api/products'
import BudgetSummary from '../../components/quotes/BudgetSummary'
import QuoteTable from '../../components/quotes/QuoteTable'
import { downloadBlob } from '../../lib/download'
import {
  buildQuoteItems,
  computeTotals,
  formatKrw,
  sanitizeCount,
  updateItemQuantity,
  type QuoteItem,
} from '../../lib/quotation'

const RECIPIENT = '누리 어린이집'

type ExportFormat = 'pdf' | 'excel'

const dateStamp = () => {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}${mm}${dd}`
}

export default function QuotesPage() {
  const [studentCountInput, setStudentCountInput] = useState('20')
  const [budgetInput, setBudgetInput] = useState('')
  const [studentCount, setStudentCount] = useState(0)
  const [items, setItems] = useState<QuoteItem[] | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [exportError, setExportError] = useState(false)

  const totalBudget = Math.max(0, Number.parseInt(budgetInput, 10) || 0)
  const totals = items ? computeTotals(items) : null

  const handleGenerate = () => {
    const count = sanitizeCount(Number.parseInt(studentCountInput, 10))
    setStudentCount(count)
    setStudentCountInput(String(count))
    setItems(buildQuoteItems(recommendedProducts, count))
  }

  const handleQuantityChange = (productId: string, quantity: number) => {
    setItems((prev) =>
      prev ? updateItemQuantity(prev, recommendedProducts, productId, quantity) : prev,
    )
  }

  const handleExport = async (format: ExportFormat) => {
    if (!items || !totals || exporting) return
    setExporting(format)
    setExportError(false)
    try {
      const docData = {
        recipient: RECIPIENT,
        studentCount,
        totalBudget,
        items,
        totals,
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
          학급 인원수와 예산을 입력하면 추천 교재 기준으로 견적서를 자동 산출합니다.
        </p>
      </div>

      {/* 추천 교재 목록 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">AI 추천 교재·교구</h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {recommendedProducts.map((product) => (
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

      {/* 인원수/예산 입력 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">견적 조건 입력</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="block text-xs font-medium text-slate-500">
            학급 인원수 (명)
            <input
              type="number"
              min={1}
              step={1}
              value={studentCountInput}
              onChange={(e) => setStudentCountInput(e.target.value)}
              className="mt-1.5 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            가용 예산 (원)
            <input
              type="number"
              min={0}
              step={1000}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="예: 250000"
              className="mt-1.5 block w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Sparkles className="size-4" aria-hidden />
            견적서 생성
          </button>
        </div>
      </section>

      {/* 견적 테이블 + 합계 + 다운로드 */}
      {items && totals && (
        <>
          <QuoteTable items={items} onQuantityChange={handleQuantityChange} />
          <BudgetSummary totals={totals} totalBudget={totalBudget} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
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
              disabled={exporting !== null}
              className="flex items-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              {exporting === 'excel' ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet className="size-4" aria-hidden />
              )}
              Excel 다운로드
            </button>
            {exportError && (
              <p role="alert" className="text-sm font-medium text-red-600">
                파일 생성에 실패했습니다. 다시 시도해 주세요.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

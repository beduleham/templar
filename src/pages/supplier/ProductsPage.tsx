import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  bulkUpsertProducts,
  createProduct,
  deleteProduct,
  listSupplierProducts,
  updateProduct,
  type ProductInput,
} from '../../api/productStore'
import ExcelUploadModal from '../../components/supplier/ExcelUploadModal'
import ProductFormModal from '../../components/supplier/ProductFormModal'
import { downloadBlob } from '../../lib/download'
import { EXPORT_DISABLED, EXPORT_DISABLED_MESSAGE } from '../../lib/exportGate'
import { NURI_AREAS } from '../../lib/plan'
import { formatKrw } from '../../lib/quotation'
import type { RowError, SupplierProduct } from '../../lib/supplierProduct'

const PAGE_SIZE = 8

export default function ProductsPage() {
  const [products, setProducts] = useState<SupplierProduct[]>(() =>
    listSupplierProducts(),
  )
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('전체')
  const [syncFilter, setSyncFilter] = useState('전체')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierProduct | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<RowError[]>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const refresh = () => setProducts(listSupplierProducts())

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term) && !p.productCode.toLowerCase().includes(term))
        return false
      if (domainFilter !== '전체' && p.nuriDomain !== domainFilter) return false
      if (syncFilter === '동기화 대기' && p.ragSynced) return false
      if (syncFilter === '동기화 완료' && !p.ragSynced) return false
      return true
    })
  }, [products, search, domainFilter, syncFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const handleFormSubmit = (input: ProductInput) => {
    try {
      if (editing) {
        updateProduct(editing.id, input)
        setToast('상품이 수정되었습니다 (RAG 동기화 대기)')
      } else {
        createProduct(input)
        setToast('상품이 등록되었습니다 (RAG 동기화 대기)')
      }
      setFormOpen(false)
      setEditing(undefined)
      setFormError(null)
      refresh()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '저장에 실패했습니다')
    }
  }

  const handleDelete = (product: SupplierProduct) => {
    deleteProduct(product.id)
    setToast(`'${product.name}' 상품이 삭제되었습니다`)
    refresh()
  }

  const handleDownloadTemplate = async () => {
    if (EXPORT_DISABLED) {
      setToast(EXPORT_DISABLED_MESSAGE)
      return
    }
    const { generateProductTemplate } = await import('../../api/productExcel')
    downloadBlob(
      await generateProductTemplate(listSupplierProducts()),
      '교재교구_업로드_템플릿.xlsx',
    )
  }

  const handleUpload = async (file: File) => {
    setHeaderError(null)
    setRowErrors([])
    if (EXPORT_DISABLED) {
      setHeaderError(EXPORT_DISABLED_MESSAGE)
      return
    }
    const { parseProductUpload } = await import('../../api/productExcel')
    const result = await parseProductUpload(file)
    if (result.headerError) {
      setHeaderError(result.headerError)
      return
    }
    if (result.errors.length > 0) {
      // All-or-Nothing: 하나라도 오류가 있으면 전체 반영하지 않는다
      setRowErrors(result.errors)
      return
    }
    if (result.rows.length === 0) {
      setHeaderError('업로드할 데이터 행이 없습니다.')
      return
    }
    const { insertedCount, updatedCount } = bulkUpsertProducts(result.rows)
    setUploadOpen(false)
    setToast(
      `총 ${insertedCount + updatedCount}건의 상품이 성공적으로 등록/업데이트되었습니다 (신규 ${insertedCount} · 수정 ${updatedCount})`,
    )
    refresh()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">교재·교구 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            AI 추천의 지식 베이스가 되는 상품 메타데이터를 관리합니다. 변경된 상품은
            RAG 동기화 대기 상태로 표시됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-emerald-600 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            <FileSpreadsheet className="size-4" aria-hidden />
            엑셀 일괄 업로드
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(undefined)
              setFormError(null)
              setFormOpen(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="size-4" aria-hidden />
            상품 등록
          </button>
        </div>
      </div>

      {/* 검색 / 필터 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="상품명·코드 검색"
            aria-label="상품 검색"
            className="w-56 rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <select
          value={domainFilter}
          onChange={(e) => {
            setDomainFilter(e.target.value)
            setPage(1)
          }}
          aria-label="누리과정 영역 필터"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        >
          <option>전체</option>
          {NURI_AREAS.map((area) => (
            <option key={area}>{area}</option>
          ))}
        </select>
        <select
          value={syncFilter}
          onChange={(e) => {
            setSyncFilter(e.target.value)
            setPage(1)
          }}
          aria-label="동기화 상태 필터"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        >
          <option>전체</option>
          <option>동기화 대기</option>
          <option>동기화 완료</option>
        </select>
        <p className="ml-auto text-xs text-slate-400">
          총 {filtered.length}개 상품
        </p>
      </div>

      {/* 목록 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-180 text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-semibold">코드</th>
              <th className="px-4 py-3 font-semibold">상품명</th>
              <th className="px-4 py-3 font-semibold">카테고리</th>
              <th className="px-4 py-3 font-semibold">연령</th>
              <th className="px-4 py-3 font-semibold">누리영역</th>
              <th className="px-4 py-3 text-right font-semibold">단가</th>
              <th className="px-4 py-3 text-center font-semibold">상태</th>
              <th className="px-4 py-3 text-center font-semibold">RAG</th>
              <th className="px-4 py-3 text-center font-semibold">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                  조건에 맞는 상품이 없습니다.
                </td>
              </tr>
            ) : (
              pageItems.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {product.productCode}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {product.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{product.category}</td>
                  <td className="px-4 py-3 text-slate-600">{product.targetAge}</td>
                  <td className="px-4 py-3 text-slate-600">{product.nuriDomain}</td>
                  <td className="px-4 py-3 text-right text-slate-800">
                    {formatKrw(product.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        product.isAvailable
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {product.isAvailable ? '판매중' : '품절'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        product.ragSynced
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {product.ragSynced ? '동기화 완료' : '동기화 대기'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(product)
                          setFormError(null)
                          setFormOpen(true)
                        }}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`${product.name} 수정`}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`${product.name} 삭제`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            aria-label="이전 페이지"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm text-slate-600">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            aria-label="다음 페이지"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {formOpen && (
        <ProductFormModal
          product={editing}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setFormOpen(false)
            setEditing(undefined)
          }}
          errorMessage={formError}
        />
      )}

      {uploadOpen && (
        <ExcelUploadModal
          onUpload={handleUpload}
          onDownloadTemplate={handleDownloadTemplate}
          onClose={() => {
            setUploadOpen(false)
            setHeaderError(null)
            setRowErrors([])
          }}
          headerError={headerError}
          rowErrors={rowErrors}
        />
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

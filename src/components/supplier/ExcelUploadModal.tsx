import { FileUp, Loader2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { RowError } from '../../lib/supplierProduct'

interface ExcelUploadModalProps {
  onUpload: (file: File) => Promise<void>
  onDownloadTemplate: () => void
  onClose: () => void
  headerError: string | null
  rowErrors: RowError[]
}

export default function ExcelUploadModal({
  onUpload,
  onDownloadTemplate,
  onClose,
  headerError,
  rowErrors,
}: ExcelUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleFile = async (file: File | undefined | null) => {
    if (!file || uploading) return
    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="엑셀 일괄 업로드"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50"
        aria-label="닫기"
        tabIndex={-1}
      />
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">엑셀 일괄 업로드</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          표준 템플릿에 맞춰 작성한 .xlsx 파일을 업로드하세요. 동일한 상품코드는
          업데이트되고, 새 코드는 신규 등록됩니다.{' '}
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="font-semibold text-emerald-600 underline hover:text-emerald-700"
          >
            표준 템플릿 다운로드
          </button>
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          className={`mt-4 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="size-8 animate-spin text-emerald-600" aria-hidden />
              <p className="text-sm font-medium text-slate-600">
                파일을 검증하고 있습니다...
              </p>
            </>
          ) : (
            <>
              <FileUp className="size-8 text-slate-300" aria-hidden />
              <p className="text-sm text-slate-500">
                파일을 이곳에 끌어다 놓거나
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Upload className="size-4" aria-hidden />
                파일 선택 (.xlsx, 최대 10MB)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
                aria-label="엑셀 파일 선택"
              />
            </>
          )}
        </div>

        {headerError && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {headerError}
          </p>
        )}

        {rowErrors.length > 0 && (
          <div className="mt-4">
            <p role="alert" className="text-sm font-semibold text-red-700">
              유효성 검증 실패 — 아래 오류를 수정한 뒤 다시 업로드해 주세요. (전체
              반영되지 않았습니다)
            </p>
            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-red-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-red-50 text-left text-red-700">
                    <th className="px-3 py-2 font-semibold">행</th>
                    <th className="px-3 py-2 font-semibold">항목</th>
                    <th className="px-3 py-2 font-semibold">입력값</th>
                    <th className="px-3 py-2 font-semibold">사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {rowErrors.map((error, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-slate-600">{error.row}</td>
                      <td className="px-3 py-2 text-slate-600">{error.column}</td>
                      <td className="max-w-24 truncate px-3 py-2 text-slate-500">
                        {error.value || '(비어 있음)'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{error.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

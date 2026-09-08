import { FileSpreadsheet, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { downloadBlob } from '../../lib/download'
import { EXPORT_DISABLED, EXPORT_DISABLED_MESSAGE } from '../../lib/exportGate'
import {
  ORDER_STATUSES,
  orderStatusLabels,
  orderStatusStyles,
  type Order,
  type OrderStatus,
} from '../../lib/order'
import { formatKrw } from '../../lib/quotation'

interface OrderDetailModalProps {
  order: Order
  onSaveStatus: (status: OrderStatus, trackingNumber: string) => void
  onClose: () => void
}

export default function OrderDetailModal({
  order,
  onSaveStatus,
  onClose,
}: OrderDetailModalProps) {
  const [status, setStatus] = useState<OrderStatus>(order.status)
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? '')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const [exportNotice, setExportNotice] = useState<string | null>(null)

  const handleExcel = async () => {
    if (exporting) return
    if (EXPORT_DISABLED) {
      setExportNotice(EXPORT_DISABLED_MESSAGE)
      return
    }
    setExporting(true)
    try {
      const { generateOrderExcel } = await import('../../lib/exportOrderExcel')
      const stamp = new Date(order.createdAt)
      const dateStr = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}`
      downloadBlob(
        await generateOrderExcel({ ...order, status, trackingNumber }),
        `주문내역_${order.institutionName}_${dateStr}.xlsx`,
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="주문 상세"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50"
        aria-label="닫기"
        tabIndex={-1}
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {order.institutionName}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {order.contactPerson} · {order.phone} · 학급 인원 {order.studentCount}명
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              주문일시: {new Date(order.createdAt).toLocaleString('ko-KR')} · 예산{' '}
              {formatKrw(order.totalBudget)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusStyles[order.status]}`}
          >
            {orderStatusLabels[order.status]}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 품목 */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-semibold">상품명</th>
                <th className="px-4 py-2.5 text-center font-semibold">수량</th>
                <th className="px-4 py-2.5 text-right font-semibold">단가</th>
                <th className="px-4 py-2.5 text-right font-semibold">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <tr key={item.productId}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {item.productName}
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-600">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {formatKrw(item.unitPrice)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                    {formatKrw(item.unitPrice * item.quantity)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50">
                <td colSpan={3} className="px-4 py-2.5 text-sm font-semibold">
                  총 합계 금액
                </td>
                <td className="px-4 py-2.5 text-right text-base font-bold text-slate-900">
                  {formatKrw(order.totalPrice)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 상태 관리 */}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-xs font-medium text-slate-500">
            주문 상태
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="mt-1 block w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {orderStatusLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500">
            운송장 번호 (선택)
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="예: 1234-5678-9012"
              className="mt-1 block w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <button
            type="button"
            onClick={() => onSaveStatus(status, trackingNumber)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            상태 저장
          </button>
          <button
            type="button"
            onClick={handleExcel}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet className="size-4" aria-hidden />
            )}
            엑셀 다운로드
          </button>
        </div>

        {exportNotice && (
          <p role="alert" className="mt-2 text-xs font-medium text-amber-700">
            {exportNotice}
          </p>
        )}
      </div>
    </div>
  )
}

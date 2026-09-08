import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { listOrders, updateOrderStatus } from '../../api/orderStore'
import OrderDetailModal from '../../components/supplier/OrderDetailModal'
import {
  ORDER_STATUSES,
  orderStatusLabels,
  orderStatusStyles,
  type Order,
  type OrderStatus,
} from '../../lib/order'
import { formatKrw } from '../../lib/quotation'

const POLL_INTERVAL_MS = 5000

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(() => listOrders())
  const [statusFilter, setStatusFilter] = useState<'전체' | OrderStatus>('전체')
  const [selected, setSelected] = useState<Order | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const refresh = () => setOrders(listOrders())

  // 실시간성: 주기 폴링 + 같은 브라우저 다른 탭의 변경(storage 이벤트) 감지
  useEffect(() => {
    const timer = setInterval(refresh, POLL_INTERVAL_MS)
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('templar.orders')) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(timer)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const filtered = useMemo(
    () =>
      statusFilter === '전체'
        ? orders
        : orders.filter((o) => o.status === statusFilter),
    [orders, statusFilter],
  )

  const countByStatus = useMemo(() => {
    const counts = new Map<OrderStatus, number>()
    for (const order of orders) {
      counts.set(order.status, (counts.get(order.status) ?? 0) + 1)
    }
    return counts
  }, [orders])

  const handleSaveStatus = (status: OrderStatus, trackingNumber: string) => {
    if (!selected) return
    updateOrderStatus(selected.id, status, trackingNumber)
    setSelected(null)
    setToast(`주문 상태가 '${orderStatusLabels[status]}'(으)로 변경되었습니다`)
    refresh()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">주문 및 견적 확인</h1>
          <p className="mt-1 text-sm text-slate-500">
            어린이집·유치원에서 자동 발행된 견적과 주문을 실시간으로 확인하고
            처리합니다. ({POLL_INTERVAL_MS / 1000}초마다 자동 새로고침)
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="size-4" aria-hidden />
          새로고침
        </button>
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('전체')}
          aria-pressed={statusFilter === '전체'}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            statusFilter === '전체'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          전체 ({orders.length})
        </button>
        {ORDER_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            aria-pressed={statusFilter === status}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              statusFilter === status
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {orderStatusLabels[status]} ({countByStatus.get(status) ?? 0})
          </button>
        ))}
      </div>

      {/* 주문 목록 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-semibold">주문일시</th>
              <th className="px-4 py-3 font-semibold">기관명</th>
              <th className="px-4 py-3 font-semibold">담당자</th>
              <th className="px-4 py-3 text-center font-semibold">품목 수</th>
              <th className="px-4 py-3 text-right font-semibold">총액</th>
              <th className="px-4 py-3 text-center font-semibold">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                  해당 상태의 주문이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelected(order)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-500">
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {order.institutionName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{order.contactPerson}</td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {order.items.length}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatKrw(order.totalPrice)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${orderStatusStyles[order.status]}`}
                    >
                      {orderStatusLabels[order.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <OrderDetailModal
          order={selected}
          onSaveStatus={handleSaveStatus}
          onClose={() => setSelected(null)}
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

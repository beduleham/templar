import {
  ClipboardList,
  Inbox,
  Package,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOrders } from '../../api/orderStore'
import { listSupplierProducts } from '../../api/productStore'
import DashboardCard from '../../components/dashboard/DashboardCard'
import {
  isToday,
  isUnprocessed,
  orderStatusLabels,
  orderStatusStyles,
  type Order,
} from '../../lib/order'
import { formatKrw } from '../../lib/quotation'

const POLL_INTERVAL_MS = 5000

interface SummaryCardDef {
  label: string
  unit: string
  icon: LucideIcon
  accent: string
  value: number
}

export default function SupplierDashboardPage() {
  const [orders, setOrders] = useState<Order[]>(() => listOrders())
  const [productCount, setProductCount] = useState(() => listSupplierProducts().length)

  useEffect(() => {
    const refresh = () => {
      setOrders(listOrders())
      setProductCount(listSupplierProducts().length)
    }
    const timer = setInterval(refresh, POLL_INTERVAL_MS)
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('templar.')) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(timer)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const now = new Date()
  const cards: SummaryCardDef[] = [
    {
      label: '오늘 신규 견적·주문',
      unit: '건',
      icon: Inbox,
      accent: 'bg-emerald-50 text-emerald-700',
      value: orders.filter((o) => isToday(o.createdAt, now)).length,
    },
    {
      label: '미처리 주문 (대기·견적확인)',
      unit: '건',
      icon: ClipboardList,
      accent: 'bg-amber-50 text-amber-700',
      value: orders.filter(isUnprocessed).length,
    },
    {
      label: '등록된 교재·교구',
      unit: '개',
      icon: Package,
      accent: 'bg-sky-50 text-sky-700',
      value: productCount,
    },
  ]

  const recentOrders = orders.slice(0, 5)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">공급업체 대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          주문·견적 현황과 상품 지표를 한눈에 확인하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ label, unit, icon: Icon, accent, value }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className={`rounded-lg p-3 ${accent}`}>
              <Icon className="size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900">
                {value.toLocaleString('ko-KR')}
                <span className="ml-0.5 text-sm font-medium text-slate-400">
                  {unit}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <DashboardCard
        title="최근 견적·주문"
        action={
          <Link
            to="/supplier/orders"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            전체 보기
          </Link>
        }
      >
        {recentOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            아직 접수된 주문이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentOrders.map((order) => (
              <li key={order.id} className="flex items-center gap-3 px-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {order.institutionName}
                    <span className="ml-2 text-xs text-slate-400">
                      {order.contactPerson}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(order.createdAt).toLocaleString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · 품목 {order.items.length}종
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-900">
                  {formatKrw(order.totalPrice)}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${orderStatusStyles[order.status]}`}
                >
                  {orderStatusLabels[order.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/supplier/products"
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50"
        >
          교재·교구 관리 바로가기
          <p className="mt-1 text-xs font-normal text-slate-500">
            AI 추천 지식 베이스 등록·수정 및 엑셀 일괄 업로드
          </p>
        </Link>
        <Link
          to="/supplier/orders"
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50"
        >
          주문 및 견적 확인 바로가기
          <p className="mt-1 text-xs font-normal text-slate-500">
            자동 견적 실시간 모니터링 및 상태 처리
          </p>
        </Link>
      </div>
    </div>
  )
}

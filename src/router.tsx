import { createBrowserRouter, createHashRouter } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import RootRedirect from './components/RootRedirect'
import OrdersPage from './pages/supplier/OrdersPage'
import ProductsPage from './pages/supplier/ProductsPage'
import SupplierDashboardPage from './pages/supplier/SupplierDashboardPage'
import JournalPage from './pages/teacher/JournalPage'
import PlanPage from './pages/teacher/PlanPage'
import QuotesPage from './pages/teacher/QuotesPage'
import TeacherDashboardPage from './pages/teacher/TeacherDashboardPage'

// 정적 호스팅(리라이트 불가) 프리뷰 빌드에서는 해시 라우터를 사용한다.
// (vite.config.ts의 define으로 빌드 시 결정되는 상수)
declare const __USE_HASH_ROUTER__: boolean
const createRouter = __USE_HASH_ROUTER__ ? createHashRouter : createBrowserRouter

export const router = createRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <RootRedirect /> },
      { path: '/teacher/dashboard', element: <TeacherDashboardPage /> },
      { path: '/teacher/plan', element: <PlanPage /> },
      { path: '/teacher/quotes', element: <QuotesPage /> },
      { path: '/teacher/journal', element: <JournalPage /> },
      { path: '/supplier/dashboard', element: <SupplierDashboardPage /> },
      { path: '/supplier/products', element: <ProductsPage /> },
      { path: '/supplier/orders', element: <OrdersPage /> },
      // 정의되지 않은 경로는 역할별 대시보드로 보낸다.
      { path: '*', element: <RootRedirect /> },
    ],
  },
])

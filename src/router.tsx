import { createBrowserRouter } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import RootRedirect from './components/RootRedirect'
import OrdersPage from './pages/supplier/OrdersPage'
import ProductsPage from './pages/supplier/ProductsPage'
import SupplierDashboardPage from './pages/supplier/SupplierDashboardPage'
import PlanPage from './pages/teacher/PlanPage'
import QuotesPage from './pages/teacher/QuotesPage'
import TeacherDashboardPage from './pages/teacher/TeacherDashboardPage'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <RootRedirect /> },
      { path: '/teacher/dashboard', element: <TeacherDashboardPage /> },
      { path: '/teacher/plan', element: <PlanPage /> },
      { path: '/teacher/quotes', element: <QuotesPage /> },
      { path: '/supplier/dashboard', element: <SupplierDashboardPage /> },
      { path: '/supplier/products', element: <ProductsPage /> },
      { path: '/supplier/orders', element: <OrdersPage /> },
      // 정의되지 않은 경로는 역할별 대시보드로 보낸다.
      { path: '*', element: <RootRedirect /> },
    ],
  },
])

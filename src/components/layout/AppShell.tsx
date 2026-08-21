import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { roleHome, useRoleStore } from '../../store/useRoleStore'
import Header from './Header'
import MobileNav from './MobileNav'
import Sidebar from './Sidebar'

export default function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const role = useRoleStore((s) => s.role)
  const location = useLocation()
  const navigate = useNavigate()

  // 현재 역할이 접근할 수 없는 영역이면 해당 역할의 대시보드로 보낸다.
  // (역할 토글 전환과 URL 직접 접근 모두 이 경로를 탄다)
  useEffect(() => {
    const otherArea = role === 'TEACHER' ? '/supplier' : '/teacher'
    if (location.pathname.startsWith(otherArea)) {
      navigate(roleHome[role], { replace: true })
    }
  }, [role, location.pathname, navigate])

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 border-r border-slate-200 bg-white md:block">
          <Sidebar />
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { Bell, CircleUserRound, Menu, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { roleHome, useRoleStore, type UserRole } from '../../store/useRoleStore'

const roleLabels: Record<UserRole, string> = {
  TEACHER: '교사/원장',
  SUPPLIER: '공급업체',
}

interface HeaderProps {
  onOpenMobileNav: () => void
}

export default function Header({ onOpenMobileNav }: HeaderProps) {
  const role = useRoleStore((s) => s.role)
  const setRole = useRoleStore((s) => s.setRole)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
        aria-label="메뉴 열기"
      >
        <Menu className="size-5" />
      </button>

      <Link to={roleHome[role]} className="flex items-center gap-2">
        <Sparkles className="size-6 text-emerald-600" aria-hidden />
        <span className="text-lg font-bold tracking-tight text-slate-900">
          누리플랜
        </span>
        <span className="hidden text-xs font-medium text-slate-400 sm:inline">
          AI 교육계획·교재 추천
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <div
          role="group"
          aria-label="역할 전환"
          className="flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold"
        >
          {(Object.keys(roleLabels) as UserRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                role === r
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {roleLabels[r]}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
          aria-label="알림"
        >
          <Bell className="size-5" />
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md p-2 text-slate-600 hover:bg-slate-100"
          aria-label="사용자 프로필"
        >
          <CircleUserRound className="size-5" />
          <span className="hidden text-sm font-medium md:inline">
            {roleLabels[role]}
          </span>
        </button>
      </div>
    </header>
  )
}

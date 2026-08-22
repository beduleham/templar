import { NavLink } from 'react-router-dom'
import { navItemsForRole } from '../../config/navigation'
import { useRoleStore } from '../../store/useRoleStore'
import { navIcons } from './navIcons'

interface SidebarProps {
  /** 모바일 드로어 안에서 렌더링될 때 클릭 시 드로어를 닫기 위한 콜백 */
  onNavigate?: () => void
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const role = useRoleStore((s) => s.role)
  const items = navItemsForRole(role)

  return (
    <nav aria-label="주 메뉴" className="flex h-full flex-col gap-1 p-3">
      {items.map((item) => {
        const Icon = navIcons[item.icon]
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            {Icon && <Icon className="size-5 shrink-0" aria-hidden />}
            {item.title}
          </NavLink>
        )
      })}
    </nav>
  )
}

import type { UserRole } from '../store/useRoleStore'

export interface NavItem {
  title: string
  path: string
  /** Lucide 아이콘 컴포넌트 매핑용 키 (components/layout/navIcons.ts 참고) */
  icon: string
  roles: UserRole[]
}

export const navItems: NavItem[] = [
  {
    title: '대시보드',
    path: '/teacher/dashboard',
    icon: 'layout-dashboard',
    roles: ['TEACHER'],
  },
  {
    title: 'AI 교육계획안 수립',
    path: '/teacher/plan',
    icon: 'notebook-pen',
    roles: ['TEACHER'],
  },
  {
    title: '교재 추천 및 견적서',
    path: '/teacher/quotes',
    icon: 'file-spreadsheet',
    roles: ['TEACHER'],
  },
  {
    title: '보육일지 및 평가',
    path: '/teacher/journal',
    icon: 'clipboard-check',
    roles: ['TEACHER'],
  },
  {
    title: '공급업체 대시보드',
    path: '/supplier/dashboard',
    icon: 'store',
    roles: ['SUPPLIER'],
  },
  {
    title: '교재·교구 관리',
    path: '/supplier/products',
    icon: 'package',
    roles: ['SUPPLIER'],
  },
  {
    title: '주문 및 견적 확인',
    path: '/supplier/orders',
    icon: 'clipboard-list',
    roles: ['SUPPLIER'],
  },
]

export const navItemsForRole = (role: UserRole): NavItem[] =>
  navItems.filter((item) => item.roles.includes(role))

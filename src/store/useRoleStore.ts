import { create } from 'zustand'

export type UserRole = 'TEACHER' | 'SUPPLIER'

interface RoleState {
  /** 현재 사용자 역할. 실제 인증 도입 전까지는 헤더 토글로 전환하는 Mock 세션이다. */
  role: UserRole
  setRole: (role: UserRole) => void
  toggleRole: () => void
}

export const useRoleStore = create<RoleState>((set) => ({
  role: 'TEACHER',
  setRole: (role) => set({ role }),
  toggleRole: () =>
    set((state) => ({ role: state.role === 'TEACHER' ? 'SUPPLIER' : 'TEACHER' })),
}))

export const roleHome: Record<UserRole, string> = {
  TEACHER: '/teacher/dashboard',
  SUPPLIER: '/supplier/dashboard',
}

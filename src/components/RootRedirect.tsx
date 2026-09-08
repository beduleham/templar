import { Navigate } from 'react-router-dom'
import { roleHome, useRoleStore } from '../store/useRoleStore'

export default function RootRedirect() {
  const role = useRoleStore((s) => s.role)
  return <Navigate to={roleHome[role]} replace />
}

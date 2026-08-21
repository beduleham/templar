import type { ReactNode } from 'react'

interface DashboardCardProps {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export default function DashboardCard({
  title,
  action,
  children,
  className = '',
}: DashboardCardProps) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

import { X } from 'lucide-react'
import Sidebar from './Sidebar'

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

export default function MobileNav({ open, onClose }: MobileNavProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40"
        aria-label="메뉴 닫기"
        tabIndex={-1}
      />
      <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <span className="text-sm font-semibold text-slate-900">메뉴</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
            aria-label="메뉴 닫기"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar onNavigate={onClose} />
        </div>
      </div>
    </div>
  )
}

import { BookOpenCheck, FolderOpen, Sparkles, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

interface QuickAction {
  title: string
  description: string
  path: string
  icon: LucideIcon
  emphasized?: boolean
}

// 교재 카탈로그 전용 화면이 생기기 전까지는 견적서 화면으로 연결한다.
const actions: QuickAction[] = [
  {
    title: 'AI 교육계획안 생성',
    description: '누리과정 기반 주간/월간 계획안을 AI로 시작',
    path: '/teacher/plan',
    icon: Sparkles,
    emphasized: true,
  },
  {
    title: '내 견적서 보관함',
    description: '발행한 견적서를 확인하고 다운로드',
    path: '/teacher/quotes',
    icon: FolderOpen,
  },
  {
    title: '추천 교재 카탈로그',
    description: '공급업체의 추천 교재·교구 둘러보기',
    path: '/teacher/quotes',
    icon: BookOpenCheck,
  },
]

export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {actions.map(({ title, description, path, icon: Icon, emphasized }) => (
        <Link
          key={title}
          to={path}
          className={`group flex items-center gap-3 rounded-xl border p-4 shadow-sm transition-colors ${
            emphasized
              ? 'border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700'
              : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <Icon
            className={`size-6 shrink-0 ${
              emphasized ? 'text-emerald-100' : 'text-emerald-600'
            }`}
            aria-hidden
          />
          <div className="min-w-0">
            <p
              className={`text-sm font-semibold ${
                emphasized ? 'text-white' : 'text-slate-900'
              }`}
            >
              {title}
            </p>
            <p
              className={`truncate text-xs ${
                emphasized ? 'text-emerald-100' : 'text-slate-500'
              }`}
            >
              {description}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}

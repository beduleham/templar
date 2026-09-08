import {
  Activity,
  BookOpen,
  Boxes,
  Calculator,
  Drama,
  FlaskConical,
  Music,
  Package,
  Palette,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  미술: Palette,
  조작놀이: Boxes,
  교사자료: UserRoundCog,
  과학탐구: FlaskConical,
  음률: Music,
  언어: BookOpen,
  신체활동: Activity,
  역할놀이: Drama,
  '수·조작': Calculator,
}

interface CategoryIconProps {
  category: string
  className?: string
}

/** 카테고리별 대표 아이콘 (이미지 로딩 실패/부재 시 Fallback 썸네일 역할) */
export default function CategoryIcon({ category, className }: CategoryIconProps) {
  const Icon = icons[category] ?? Package
  return <Icon className={className} aria-hidden />
}

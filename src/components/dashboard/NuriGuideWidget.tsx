import { Lightbulb } from 'lucide-react'
import DashboardCard from './DashboardCard'

// 이달의 누리과정 중점 영역 안내. 백엔드/콘텐츠 관리 도입 전까지는 정적 콘텐츠.
const guide = {
  month: '8월',
  focusArea: '자연탐구',
  summary:
    '여름철 자연 현상과 생활 속 과학을 탐구하며 호기심을 키우는 시기입니다.',
  tips: [
    '물놀이와 얼음 관찰로 물질의 상태 변화 경험하기',
    '여름 곤충·식물 관찰 일지를 그림으로 표현하기',
    '그늘과 햇빛의 온도 차이를 몸으로 느끼고 비교하기',
  ],
}

export default function NuriGuideWidget() {
  return (
    <DashboardCard
      title={`${guide.month} 누리과정 중점 영역`}
      className="border-amber-100 bg-amber-50/60"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2.5 text-amber-700">
          <Lightbulb className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{guide.focusArea}</p>
          <p className="mt-1 text-sm text-slate-600">{guide.summary}</p>
          <ul className="mt-3 space-y-1.5">
            {guide.tips.map((tip) => (
              <li key={tip} className="flex gap-2 text-xs text-slate-600">
                <span className="text-amber-500" aria-hidden>
                  •
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DashboardCard>
  )
}

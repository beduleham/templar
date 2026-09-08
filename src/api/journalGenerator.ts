// 보육일지·활동 평가서 초안 생성 서비스.
//
// 백엔드(POST /api/v1/journals/generate)가 준비되면 이 함수를 fetch 호출로
// 교체한다. 서버는 Gemini(현행 안정 모델, 예: gemini-2.5-flash — 스펙의
// gemini-1.5-*는 단종)를 responseSchema와 함께 호출하며, 시스템 프롬프트에
// "제공된 계획안 외의 허구의 교구나 활동을 지어내지 마십시오" 제약을 포함한다.
// 본 Mock 역시 전달받은 계획안 활동·준비물만 사용해 환각 없이 생성한다.

import type { PlanActivity } from '../lib/plan'
import type { JournalEntry } from '../lib/journal'

const MOCK_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 900

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface JournalDraft {
  dailySchedule: JournalEntry[]
  activityEvaluation: string
}

export interface GenerateJournalParams {
  dateISO: string
  targetAge: string
  theme: string
  activities: PlanActivity[]
}

export async function generateJournalDraft(
  params: GenerateJournalParams,
): Promise<JournalDraft> {
  if (params.activities.length === 0) {
    throw new Error('해당 일자의 교육계획안이 존재하지 않습니다')
  }
  await delay(MOCK_DELAY_MS)

  const [first, second, third, fourth, fifth] = params.activities
  const materialsOf = (activity?: PlanActivity) =>
    activity?.materials?.length ? `(준비물: ${activity.materials.join(', ')})` : ''

  const dailySchedule: JournalEntry[] = [
    {
      time: '09:00 - 09:40',
      activity: '등원 및 자유놀이',
      content:
        '유아들이 반갑게 인사하며 등원함. 관심 영역에서 자유놀이를 하며 안정적으로 일과를 시작함.',
    },
    {
      time: '09:40 - 10:00',
      activity: '오전 간식 및 화장실 다녀오기',
      content: '손 씻기 등 기본 생활 습관을 지도하며 간식을 먹음.',
    },
    ...(first
      ? [
          {
            time: '10:00 - 10:50',
            activity: first.activity_name,
            content: `${first.area} 영역 활동으로 '${first.activity_name}'을 진행함. ${first.description} ${materialsOf(first)} 유아들이 활동에 집중하며 즐겁게 참여함.`,
          },
        ]
      : []),
    ...(second
      ? [
          {
            time: '11:00 - 11:40',
            activity: second.activity_name,
            content: `${second.area} 연계 활동 '${second.activity_name}'을 이어서 진행함. ${second.description} ${materialsOf(second)}`,
          },
        ]
      : []),
    {
      time: '11:40 - 13:00',
      activity: '점심 식사 및 양치',
      content: '골고루 먹는 습관을 지도함. 스스로 정리하는 유아를 격려함.',
    },
    {
      time: '13:00 - 14:30',
      activity: '낮잠 및 휴식',
      content: '조용한 음악과 함께 개별 이불에서 휴식을 취함.',
    },
    ...(third
      ? [
          {
            time: '14:30 - 15:20',
            activity: third.activity_name,
            content: `오후에는 ${third.area} 영역의 '${third.activity_name}'을 진행함. ${third.description} ${materialsOf(third)}`,
          },
        ]
      : []),
    {
      time: '15:20 - 16:00',
      activity: '오후 간식 및 평가 나누기',
      content:
        '오늘의 활동을 회상하며 이야기를 나눔. 유아들이 인상 깊었던 활동을 발표함.',
    },
    {
      time: '16:00 - ',
      activity: '자유놀이 및 순차 하원',
      content: '보호자 인계 시 오늘의 활동과 특이사항을 전달함.',
    },
  ]

  const areaList = [...new Set(params.activities.map((a) => a.area))].join(', ')
  const evalTargets = [fourth, fifth].filter(Boolean) as PlanActivity[]
  const extraEval =
    evalTargets.length > 0
      ? ` 계획된 '${evalTargets.map((a) => a.activity_name).join("', '")}' 활동은 유아들의 흥미와 진행 상황에 따라 다음 일과에 반영할 예정임.`
      : ''

  const activityEvaluation =
    `금일 '${params.theme}' 주제로 진행된 ${areaList} 영역 활동에서 ${params.targetAge} 유아들은 높은 흥미와 참여도를 보임. ` +
    `특히 '${first.activity_name}' 활동에서 누리과정 목표(${first.objective ?? first.area + ' 영역 목표'})에 부합하는 반응이 관찰됨. ` +
    `일부 유아는 개별적인 도움이 필요하여 교사가 상호작용을 지원함.${extraEval} ` +
    `다음 활동 시 유아 주도적 탐색 시간을 더 충분히 확보하는 방향으로 개선하고자 함.`

  return { dailySchedule, activityEvaluation }
}

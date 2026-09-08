// 교육계획안 생성 서비스.
//
// 백엔드(POST /api/education-plans/generate)가 준비되면 이 모듈의 generatePlan을
// fetch 호출로 교체한다. 서버는 @google/genai SDK로 Gemini를 호출하고
// responseMimeType: "application/json" + responseSchema로 구조를 강제한다.
// ※ 스펙에 명시된 gemini-1.5-flash는 단종된 모델이므로, 연동 시점의 현행
//   안정 모델(예: gemini-2.5-flash)을 서버 환경 변수로 관리할 것.
//   GEMINI_API_KEY는 반드시 서버 환경 변수로만 관리하고 클라이언트에 노출하지 않는다.

import { AGE_PROFILES } from '../lib/ageProfiles'
import {
  NURI_AREAS,
  periodsForPlanType,
  planTypeLabels,
  type GeneratePlanParams,
  type NuriArea,
  type PlanContent,
} from '../lib/plan'

const MOCK_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 1200

/** 생성 요청 타임아웃 (스펙: 최대 15초 초과 시 타임아웃 처리) */
export const GENERATION_TIMEOUT_MS = 15_000

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('generation timeout')), ms)
    }),
  ])
}

// 영역별 활동 템플릿 뱅크. {theme}/{sub} 자리에 주제를 삽입해 다양성을 흉내낸다.
const activityBank: Record<NuriArea, Array<{ name: string; desc: string }>> = {
  '신체운동·건강': [
    { name: '{sub} 몸으로 표현하기', desc: '{sub}의 모양과 움직임을 대근육 활동으로 표현하며 신체 조절력을 기른다.' },
    { name: '{theme} 장애물 놀이', desc: '{theme}를 주제로 한 장애물 코스를 통과하며 균형 감각을 기른다.' },
    { name: '{sub} 리듬 체조', desc: '음악에 맞춰 {sub}을 표현하는 체조로 기초 체력을 다진다.' },
    { name: '{theme} 바깥 놀이', desc: '바깥 놀이터에서 {theme}와 관련된 자연물을 찾으며 신체 활동을 즐긴다.' },
    { name: '{sub} 요가 놀이', desc: '{sub}을 떠올리며 천천히 몸을 늘이고 호흡을 조절한다.' },
  ],
  의사소통: [
    { name: "'{sub}' 이야기 나누기", desc: '{sub}에 대한 경험을 발표하고 친구의 이야기를 경청한다.' },
    { name: '{theme} 동화 듣기', desc: '{theme} 관련 그림책을 함께 읽고 느낀 점을 말로 표현한다.' },
    { name: '{sub} 수수께끼 놀이', desc: '{sub}의 특징을 설명하고 알아맞히며 어휘력을 확장한다.' },
    { name: '{theme} 낱말 카드 놀이', desc: '{theme} 관련 낱말 카드를 읽고 문장을 만들어 본다.' },
    { name: '{sub} 동시 짓기', desc: '{sub}을 주제로 짧은 동시를 짓고 낭송해 본다.' },
  ],
  사회관계: [
    { name: '{sub} 협동 놀이', desc: '모둠별로 역할을 나누어 {sub} 프로젝트를 완성하며 협력을 경험한다.' },
    { name: '{theme} 역할 놀이', desc: '{theme} 상황을 역할극으로 표현하며 배려와 규칙을 익힌다.' },
    { name: '{sub} 함께 나누기', desc: '{sub}과 관련한 자료를 친구들과 나누며 공동체 의식을 기른다.' },
    { name: '{theme} 우리 동네 탐방', desc: '{theme}와 관련된 우리 동네 장소를 알아보고 지역사회에 관심을 가진다.' },
    { name: '{sub} 감사 표현하기', desc: '{sub}을 도와주시는 분들께 감사의 마음을 표현한다.' },
  ],
  예술경험: [
    { name: '{sub} 그리기', desc: '{sub}을 관찰하고 다양한 재료로 표현하며 심미감을 기른다.' },
    { name: '{theme} 노래 부르기', desc: '{theme} 관련 새 노래를 배우고 리듬 악기로 연주한다.' },
    { name: '{sub} 만들기', desc: '재활용품과 자연물로 {sub}을 입체적으로 구성한다.' },
    { name: '{theme} 명화 감상', desc: '{theme}가 담긴 명화를 감상하고 느낌을 이야기한다.' },
    { name: '{sub} 콜라주', desc: '색종이와 자연물을 활용해 {sub} 콜라주 작품을 완성한다.' },
  ],
  자연탐구: [
    { name: '{sub} 관찰하기', desc: '{sub}을 오감으로 관찰하고 특징을 기록하며 탐구 태도를 기른다.' },
    { name: '{theme} 실험 놀이', desc: '{theme}와 관련된 간단한 과학 실험으로 변화를 예측하고 확인한다.' },
    { name: '{sub} 수 세기', desc: '{sub}을 세어 보고 크기·길이를 비교하며 수학적 탐구를 경험한다.' },
    { name: '{theme} 분류 놀이', desc: '{theme} 관련 자연물을 기준에 따라 분류하며 논리적 사고를 기른다.' },
    { name: '{sub} 패턴 찾기', desc: '{sub}에서 반복되는 무늬와 규칙을 찾아 표현한다.' },
  ],
}

// 영역별 활동 목표 및 기본 준비물 템플릿
const areaObjectives: Record<NuriArea, string> = {
  '신체운동·건강': '{sub}을 몸으로 표현하며 신체 조절력과 기초 체력을 기른다.',
  의사소통: '{sub}에 대한 생각을 말과 글로 표현하며 어휘력을 확장한다.',
  사회관계: '친구와 협력하며 {sub}에 대한 공동체 의식을 기른다.',
  예술경험: '{sub}을 다양한 예술 매체로 표현하며 심미감을 기른다.',
  자연탐구: '{sub}을 관찰·비교하며 탐구하는 태도를 기른다.',
}

const areaMaterials: Record<NuriArea, string[]> = {
  '신체운동·건강': ['활동 매트', '배경 음악'],
  의사소통: ['그림책', '낱말 카드'],
  사회관계: ['역할 소품', '모둠 이름표'],
  예술경험: ['미술 재료', '리듬 악기'],
  자연탐구: ['관찰 도구', '기록지'],
}

const fill = (template: string, theme: string, sub: string) =>
  template.replaceAll('{theme}', theme).replaceAll('{sub}', sub)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 계획안 초안 생성 (Mock).
 * 실제 연동 시 이 함수 본문만 백엔드 API 호출로 교체하면 된다.
 */
export async function generatePlan(params: GeneratePlanParams): Promise<PlanContent> {
  const theme = params.theme.trim()
  if (!theme) throw new Error('대주제를 입력해 주세요')
  const sub = params.subTheme?.trim() || theme

  await delay(MOCK_DELAY_MS)

  const periods = periodsForPlanType(params.planType)
  const typeLabel = planTypeLabels[params.planType]

  return {
    title: `${params.targetAge} '${theme}' ${typeLabel} 교육계획안`,
    target_age: params.targetAge,
    theme: params.subTheme?.trim() ? `${theme} - ${sub}` : theme,
    goals: [
      `${theme}에 관심을 가지고 주변 환경을 탐색한다.`,
      `${sub}과 관련된 경험을 다양한 방법으로 표현한다.`,
      '친구와 협력하며 즐겁게 활동에 참여한다.',
    ],
    schedule: periods.map((period, pi) => ({
      period,
      activities: NURI_AREAS.map((area) => {
        const bank = activityBank[area]
        const pick = bank[pi % bank.length]
        // 연령별 발달 특성에 맞춰 활동 난이도 서술을 조정한다
        const adaptation = AGE_PROFILES[params.targetAge].adaptationNote
        return {
          area,
          activity_name: fill(pick.name, theme, sub),
          description: `${fill(pick.desc, theme, sub)} ${adaptation}`,
          objective: fill(areaObjectives[area], theme, sub),
          materials: areaMaterials[area],
        }
      }),
    })),
  }
}

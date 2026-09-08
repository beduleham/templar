// 연령별 발달 특성 및 누리과정 매핑 메타데이터.
// AI 프롬프트(및 Mock 생성기)의 연령별 난이도 조절과 추천 대주제 노출에 사용한다.

import type { TargetAge } from './plan'

export interface AgeProfile {
  label: TargetAge
  /** 발달 특성 요약 (프롬프트 및 UI 안내용) */
  developmentalFocus: string
  /** 연령별 추천 누리과정 대주제 */
  recommendedThemes: string[]
  /** 활동 난이도를 표현하는 서술 문구 — 생성 활동 설명에 반영된다 */
  adaptationNote: string
}

export const AGE_PROFILES: Record<TargetAge, AgeProfile> = {
  '만 3세': {
    label: '만 3세',
    developmentalFocus: '감각적 탐색, 기본 생활 습관, 병행 놀이, 단순한 신체 조절',
    recommendedThemes: ['우리 원과 친구', '나를 소개해요', '느껴보아요 (감각)', '재미있는 놀이'],
    adaptationNote: '감각 탐색과 단순 모방 중심의 쉬운 활동으로 진행한다.',
  },
  '만 4세': {
    label: '만 4세',
    developmentalFocus: '또래 상호작용 증가, 상상 놀이, 정서 조절, 기초적인 인과관계 이해',
    recommendedThemes: ['봄의 변화', '우리 동네 이웃', '동식물과 자연', '건강한 나와 가족'],
    adaptationNote: '또래와의 상상 놀이와 간단한 규칙을 곁들여 진행한다.',
  },
  '만 5세': {
    label: '만 5세',
    developmentalFocus: '협동 놀이, 규칙 준수, 논리적 사고, 초등 연계 및 공동체 의식',
    recommendedThemes: ['우리나라와 세계', '환경과 생활', '도구와 기계', '초등학교에 가요'],
    adaptationNote: '협동과 토의를 포함해 초등 연계 수준으로 심화하여 진행한다.',
  },
  혼합반: {
    label: '혼합반',
    developmentalFocus: '연령 간 상호 배움, 역할 분담, 개별 수준 배려',
    recommendedThemes: ['함께하는 우리 반', '형님과 동생', '계절과 놀이'],
    adaptationNote: '연령별 수준을 나누어 단계적으로 진행한다.',
  },
}

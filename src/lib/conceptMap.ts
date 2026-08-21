// 유아교육 도메인 개념 시소러스.
// 어휘가 달라도 의미가 통하는 활동↔교구 매칭(시맨틱 매칭)을 위해
// 질의 토큰을 관련 개념으로 확장하는 데 사용한다.
// ※ 백엔드 도입 시 이 레이어는 Gemini text-embedding-004 + pgvector
//   코사인 검색으로 대체되며, 본 맵은 임베딩 장애 시 Fallback으로 유지한다.

export const CONCEPT_GROUPS: string[][] = [
  ['흙', '모래', '갯벌', '점토', '클레이', '원예', '흙놀이', '모래놀이'],
  ['그림', '미술', '물감', '색칠', '콜라주', '만들기', '조형', '꾸미기'],
  ['노래', '음악', '악기', '리듬', '동요', '연주', '소리'],
  ['책', '그림책', '동화', '이야기', '읽기', '독서', '글자', '낱말'],
  ['숫자', '수', '세기', '측정', '비교', '분류', '패턴', '수학'],
  ['몸', '신체', '운동', '체조', '균형', '달리기', '뜀뛰기', '대근육'],
  ['관찰', '탐구', '실험', '돋보기', '현미경', '과학', '자연'],
  ['곤충', '벌레', '나비', '개미', '동물', '식물', '꽃', '나무', '씨앗'],
  ['물', '얼음', '비', '눈', '바다', '강', '수영'],
  ['역할', '극놀이', '직업', '가게', '병원', '소꿉', '의상'],
  ['블록', '쌓기', '구성', '조립', '레고', '소근육'],
  ['친구', '협동', '모둠', '공동체', '배려', '나눔'],
]

const groupIndex = new Map<string, number[]>()
CONCEPT_GROUPS.forEach((group, gi) => {
  for (const term of group) {
    const list = groupIndex.get(term) ?? []
    list.push(gi)
    groupIndex.set(term, list)
  }
})

/**
 * 텍스트에 등장하는 개념 그룹의 인덱스 집합을 찾는다.
 * (어절 단위 포함 여부 — '흙 놀이', '흙놀이', '모래놀이 세트' 모두 감지)
 */
export function findConceptGroups(text: string): Set<number> {
  const found = new Set<number>()
  for (const [term, groups] of groupIndex) {
    if (text.includes(term)) {
      for (const gi of groups) found.add(gi)
    }
  }
  return found
}

/** 두 텍스트가 공유하는 개념 그룹 수 (0이면 의미적 연결 없음) */
export function sharedConceptCount(a: Set<number>, b: Set<number>): number {
  let count = 0
  for (const gi of a) if (b.has(gi)) count++
  return count
}

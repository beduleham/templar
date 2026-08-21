// 인메모리 RAG 매칭 엔진 (순수 함수).
//
// 소규모 카탈로그에 대해 문자 바이그램 + 어절 토큰 기반 코사인 유사도로
// 계획안 활동 텍스트와 상품 메타데이터를 매칭한다. 추천 결과는 반드시
// 카탈로그에 존재하는 상품만 반환하므로 환각이 원천 차단된다.
// 카탈로그가 커지면 이 모듈의 scoreProducts를 백엔드 벡터 검색
// (Gemini Embedding + pgvector 코사인 유사도)으로 교체한다.

import type { CatalogProduct } from '../api/products'

/** 한국어 텍스트를 어절 + 문자 바이그램 토큰으로 분해한다. */
export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
  const tokens: string[] = [...words]
  for (const word of words) {
    for (let i = 0; i + 2 <= word.length; i++) {
      tokens.push(word.slice(i, i + 2))
    }
  }
  return tokens
}

export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1)
  return tf
}

/** 두 단어-빈도 벡터의 코사인 유사도 (0~1). */
export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  if (a.size === 0 || b.size === 0) return 0
  let dot = 0
  for (const [token, freq] of a) {
    const other = b.get(token)
    if (other) dot += freq * other
  }
  if (dot === 0) return 0
  const norm = (v: Map<string, number>) =>
    Math.sqrt([...v.values()].reduce((sum, f) => sum + f * f, 0))
  return dot / (norm(a) * norm(b))
}

export interface ProductMatch {
  product: CatalogProduct
  /** 0~1 매칭 점수 */
  matchScore: number
}

/** 유사도 임계값: 이 미만이면 매칭으로 취급하지 않고 Fallback을 사용한다. */
export const MATCH_THRESHOLD = 0.08

const productDocument = (product: CatalogProduct) =>
  [
    product.name,
    product.category,
    product.description ?? '',
    product.keywords.join(' '),
  ].join(' ')

/**
 * 활동 텍스트와 카탈로그 상품의 유사도를 계산해 상위 topN개를 반환한다.
 * 임계값 이상 매칭이 없으면 카탈로그 앞쪽(베스트셀러 가정) 상품을 Fallback으로 반환한다.
 */
export function recommendForActivity(
  activityText: string,
  catalog: CatalogProduct[],
  topN = 3,
): ProductMatch[] {
  const queryVector = termFrequency(tokenize(activityText))
  const scored = catalog
    .map((product) => ({
      product,
      matchScore: cosineSimilarity(
        queryVector,
        termFrequency(tokenize(productDocument(product))),
      ),
    }))
    .sort((a, b) => b.matchScore - a.matchScore)

  const matched = scored.filter((m) => m.matchScore >= MATCH_THRESHOLD)
  if (matched.length > 0) return matched.slice(0, topN)
  // Fallback: 매칭 실패 시 기본 추천 (점수 0으로 표기)
  return catalog.slice(0, topN).map((product) => ({ product, matchScore: 0 }))
}

export interface PlanRecommendation extends ProductMatch {
  /** 이 상품이 매칭된 대표 활동명 */
  relatedActivity: string
  /** 같은 활동에 대한 차순위 대체 추천 */
  alternatives: ProductMatch[]
}

interface ActivityLike {
  activity_name: string
  description: string
}

/**
 * 계획안의 전체 활동에 대해 추천을 계산하고 상품 기준으로 중복을 제거한다.
 * 각 항목은 최고 점수 활동을 대표로 가지며, 해당 활동의 차순위 상품을
 * 대체 추천(alternatives)으로 포함한다.
 */
export function recommendForPlan(
  activities: ActivityLike[],
  catalog: CatalogProduct[],
  alternativesPerItem = 2,
): PlanRecommendation[] {
  const byProduct = new Map<string, PlanRecommendation>()

  for (const activity of activities) {
    const text = `${activity.activity_name} ${activity.description}`
    const matches = recommendForActivity(text, catalog, alternativesPerItem + 1)
    if (matches.length === 0) continue
    const [top, ...rest] = matches
    const existing = byProduct.get(top.product.id)
    if (!existing || top.matchScore > existing.matchScore) {
      byProduct.set(top.product.id, {
        ...top,
        relatedActivity: activity.activity_name,
        alternatives: rest.filter((m) => m.matchScore >= MATCH_THRESHOLD),
      })
    }
  }

  return [...byProduct.values()].sort((a, b) => b.matchScore - a.matchScore)
}

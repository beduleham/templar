// 인메모리 RAG 시맨틱 매칭 엔진 (순수 함수).
//
// 1) 문자 바이그램 + 어절 토큰 기반 코사인 유사도 (어휘 매칭)
// 2) 유아교육 개념 시소러스 확장 (어휘가 달라도 의미가 통하는 시맨틱 브리지)
// 를 결합해 계획안 활동 텍스트와 상품 메타데이터를 매칭한다.
// 추천 결과는 반드시 카탈로그에 존재하는 상품만 반환하므로 환각이 원천 차단된다.
// 카탈로그가 커지면 이 모듈을 백엔드 벡터 검색(Gemini text-embedding-004 768차원
// + pgvector `<=>` 코사인 거리)으로 교체하고, 본 엔진은 임베딩 장애 시
// Fallback 매칭으로 유지한다.

import type { CatalogProduct } from '../api/products'
import { findConceptGroups, sharedConceptCount } from './conceptMap'

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
    (product.keywords ?? []).join(' '),
  ].join(' ')

/** 시맨틱 브리지 매칭의 최소 보정 점수 (개념 그룹이 겹치면 이 이상을 보장) */
export const SEMANTIC_BRIDGE_SCORE = 0.7

/**
 * 상품의 대상 연령이 요청 연령을 포함하는지 판정한다.
 * '공통'·'교사용'은 전 연령 허용, '혼합반' 요청은 전 상품 허용.
 * (예: '만 3~5세'는 만 3세 요청에 매칭, '만 4~5세'는 매칭 안 됨)
 */
export function matchesTargetAge(productAge: string, targetAge?: string): boolean {
  if (!targetAge || targetAge === '혼합반') return true
  if (productAge.includes('공통') || productAge.includes('교사용')) return true
  const requested = Number(targetAge.match(/\d/)?.[0])
  if (!Number.isFinite(requested)) return true
  const nums = productAge.match(/\d/g)?.map(Number) ?? []
  if (nums.length === 0) return true
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  return requested >= min && requested <= max
}

export interface RecommendOptions {
  /** 지정 시 해당 연령에 맞는 상품만 매칭한다 */
  targetAge?: string
}

/**
 * 활동 텍스트와 카탈로그 상품의 시맨틱 유사도를 계산해 상위 topN개를 반환한다.
 * 어휘(코사인) 매칭에 더해, 개념 시소러스로 연결되는 상품은 어휘가 달라도
 * SEMANTIC_BRIDGE_SCORE 이상의 보정 점수로 매칭된다.
 * 임계값 이상 매칭이 없으면 카탈로그 앞쪽(베스트셀러 가정) 상품을 Fallback으로 반환한다.
 */
export function recommendForActivity(
  activityText: string,
  catalog: CatalogProduct[],
  topN = 3,
  options: RecommendOptions = {},
): ProductMatch[] {
  const eligible = catalog.filter((p) =>
    matchesTargetAge(p.targetAge, options.targetAge),
  )
  const queryVector = termFrequency(tokenize(activityText))
  const queryConcepts = findConceptGroups(activityText)

  const scored = eligible
    .map((product) => {
      const doc = productDocument(product)
      const lexical = cosineSimilarity(queryVector, termFrequency(tokenize(doc)))
      const bridges = sharedConceptCount(queryConcepts, findConceptGroups(doc))
      // 개념이 겹치면 최소 0.7을 보장하되, 어휘 일치가 강한(리터럴) 상품이
      // 일반적 개념 연결보다 우선하도록 어휘 유사도에 큰 가중치를 둔다
      const semantic =
        bridges > 0
          ? Math.min(
              0.99,
              SEMANTIC_BRIDGE_SCORE + Math.min(bridges - 1, 2) * 0.03 + lexical * 0.35,
            )
          : lexical
      return { product, matchScore: Math.max(lexical, semantic) }
    })
    .sort((a, b) => b.matchScore - a.matchScore)

  const matched = scored.filter((m) => m.matchScore >= MATCH_THRESHOLD)
  if (matched.length > 0) return matched.slice(0, topN)
  // Fallback: 매칭 실패 시 기본 추천 (점수 0으로 표기)
  return eligible.slice(0, topN).map((product) => ({ product, matchScore: 0 }))
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
  options: RecommendOptions = {},
): PlanRecommendation[] {
  const byProduct = new Map<string, PlanRecommendation>()

  for (const activity of activities) {
    const text = `${activity.activity_name} ${activity.description}`
    const matches = recommendForActivity(text, catalog, alternativesPerItem + 1, options)
    if (matches.length === 0) continue
    const [top, ...rest] = matches
    const freshAlternatives = rest.filter((m) => m.matchScore >= MATCH_THRESHOLD)
    const existing = byProduct.get(top.product.id)
    if (!existing) {
      byProduct.set(top.product.id, {
        ...top,
        relatedActivity: activity.activity_name,
        alternatives: freshAlternatives,
      })
      continue
    }
    // 여러 활동에서 같은 상품이 대표로 뽑히면 대체 추천을 병합해
    // 특정 활동의 차순위 상품이 묻히지 않도록 한다.
    const altByProduct = new Map(existing.alternatives.map((a) => [a.product.id, a]))
    for (const alt of freshAlternatives) {
      const known = altByProduct.get(alt.product.id)
      if (!known || alt.matchScore > known.matchScore) {
        altByProduct.set(alt.product.id, alt)
      }
    }
    const merged = [...altByProduct.values()]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, Math.max(alternativesPerItem, 3))
    if (top.matchScore > existing.matchScore) {
      byProduct.set(top.product.id, {
        ...top,
        relatedActivity: activity.activity_name,
        alternatives: merged,
      })
    } else {
      existing.alternatives = merged
    }
  }

  return [...byProduct.values()].sort((a, b) => b.matchScore - a.matchScore)
}

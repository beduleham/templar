import { describe, expect, it } from 'vitest'
import { productCatalog } from '../api/products'
import {
  cosineSimilarity,
  MATCH_THRESHOLD,
  recommendForActivity,
  recommendForPlan,
  termFrequency,
  tokenize,
} from './similarity'

describe('tokenize', () => {
  it('어절과 문자 바이그램을 함께 생성한다', () => {
    const tokens = tokenize('돋보기 관찰')
    expect(tokens).toContain('돋보기')
    expect(tokens).toContain('돋보')
    expect(tokens).toContain('보기')
    expect(tokens).toContain('관찰')
  })
  it('특수문자를 무시한다', () => {
    expect(tokenize("'봄'의 꽃!")).toContain('꽃')
  })
})

describe('cosineSimilarity', () => {
  it('동일 벡터는 1에 수렴한다', () => {
    const v = termFrequency(tokenize('봄의 꽃 관찰'))
    expect(cosineSimilarity(v, v)).toBeCloseTo(1)
  })
  it('공통 토큰이 없으면 0이다', () => {
    const a = termFrequency(tokenize('가나다'))
    const b = termFrequency(tokenize('마바사'))
    expect(cosineSimilarity(a, b)).toBe(0)
  })
  it('빈 벡터는 0이다', () => {
    expect(cosineSimilarity(new Map(), termFrequency(['a']))).toBe(0)
  })
})

describe('recommendForActivity', () => {
  it('관찰 활동에는 돋보기 세트가 최상위로 매칭된다', () => {
    const matches = recommendForActivity(
      '봄의 꽃들을 관찰하고 돋보기로 세밀하게 그려봅니다',
      productCatalog,
    )
    expect(matches[0].product.name).toBe('어린이 관찰 돋보기 세트')
    expect(matches[0].matchScore).toBeGreaterThanOrEqual(MATCH_THRESHOLD)
  })

  it('카탈로그에 존재하는 상품만 반환한다 (환각 차단)', () => {
    const ids = new Set(productCatalog.map((p) => p.id))
    const matches = recommendForActivity('우주 행성 클레이 만들기', productCatalog)
    for (const m of matches) expect(ids.has(m.product.id)).toBe(true)
  })

  it('점수 내림차순으로 정렬된다', () => {
    const matches = recommendForActivity('그림책 읽고 이야기 나누기', productCatalog)
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].matchScore).toBeGreaterThanOrEqual(matches[i].matchScore)
    }
  })

  it('매칭이 전혀 없으면 Fallback 상품을 점수 0으로 반환한다', () => {
    const matches = recommendForActivity('xyzw', productCatalog, 2)
    expect(matches).toHaveLength(2)
    expect(matches.every((m) => m.matchScore === 0)).toBe(true)
  })
})

describe('recommendForPlan', () => {
  it('활동별 추천을 상품 기준으로 중복 제거하고 대표 활동을 기록한다', () => {
    const recs = recommendForPlan(
      [
        { activity_name: '돋보기 관찰', description: '곤충과 식물을 관찰한다' },
        { activity_name: '클레이 행성 만들기', description: '점토로 입체 모형을 만든다' },
      ],
      productCatalog,
    )
    const ids = recs.map((r) => r.product.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(recs.some((r) => r.product.name === '어린이 관찰 돋보기 세트')).toBe(true)
    expect(recs.some((r) => r.product.name === '클레이 점토 12색 세트')).toBe(true)
    for (const rec of recs) expect(rec.relatedActivity).toBeTruthy()
  })
})

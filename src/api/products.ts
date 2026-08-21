import type { Product } from '../lib/quotation'

// AI 추천 교재·교구 목록.
// RAG 추천 기능이 붙기 전까지는 공급업체 등록 상품을 가정한 Mock 데이터.
// (교재·도서류는 면세 품목이므로 taxRate 0)
export const recommendedProducts: Product[] = [
  {
    id: 'prod-001',
    name: '누리과정 미술 놀이 세트',
    unitPrice: 10000,
    taxRate: 0,
    description: "만 3~5세 '여름과 자연' 주제 연계 미술 활동 재료 모음",
  },
  {
    id: 'prod-002',
    name: '창의 블록 교구',
    unitPrice: 5000,
    taxRate: 0,
    description: '소근육 발달과 공간 지각을 돕는 감각 블록 세트',
  },
]

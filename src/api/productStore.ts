// 공급업체 상품 저장소.
// 백엔드(GET/POST/PUT/DELETE /api/admin/products)가 준비되기 전까지
// localStorage에 보관하며, 교사용 AI 추천·견적의 카탈로그 원천으로 사용된다.

import {
  applyBulkUpsert,
  type BulkUpsertResult,
  type ParsedProductRow,
  type SupplierProduct,
} from '../lib/supplierProduct'
import { productCatalog } from './products'

const STORAGE_KEY = 'templar.supplierProducts.v1'

// 시드용: 카테고리 → 누리과정 대표 영역 매핑
const categoryToDomain: Record<string, string> = {
  미술: '예술경험',
  조작놀이: '자연탐구',
  교사자료: '사회관계',
  과학탐구: '자연탐구',
  음률: '예술경험',
  언어: '의사소통',
  신체활동: '신체운동·건강',
  역할놀이: '사회관계',
  '수·조작': '자연탐구',
}

function seedProducts(): SupplierProduct[] {
  return productCatalog.map((product, i) => ({
    ...product,
    productCode: `NURI-${String(i + 1).padStart(3, '0')}`,
    nuriDomain: categoryToDomain[product.category] ?? '자연탐구',
    isAvailable: true,
    ragSynced: true,
    updatedAt: new Date().toISOString(),
  }))
}

function readAll(): SupplierProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedProducts()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedProducts()
  } catch {
    return seedProducts()
  }
}

function writeAll(products: SupplierProduct[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
  } catch {
    throw new Error('로컬 저장소에 저장하지 못했습니다')
  }
}

export function listSupplierProducts(): SupplierProduct[] {
  return readAll()
}

/** 교사용 추천·견적에 노출되는 카탈로그: 판매 중인 상품만 */
export function listAvailableProducts(): SupplierProduct[] {
  return readAll().filter((p) => p.isAvailable)
}

export interface ProductInput {
  productCode: string
  name: string
  category: string
  targetAge: string
  nuriDomain: string
  unitPrice: number
  description: string
  isPerStudent: boolean
  isAvailable: boolean
}

export function createProduct(input: ProductInput): SupplierProduct {
  const products = readAll()
  if (products.some((p) => p.productCode === input.productCode)) {
    throw new Error(`이미 등록된 상품코드입니다: ${input.productCode}`)
  }
  const created: SupplierProduct = {
    id: `prod-${input.productCode.toLowerCase()}-${Date.now().toString(36)}`,
    taxRate: 0,
    keywords: [],
    ...input,
    ragSynced: false,
    updatedAt: new Date().toISOString(),
  }
  writeAll([...products, created])
  return created
}

export function updateProduct(id: string, input: ProductInput): SupplierProduct {
  const products = readAll()
  const target = products.find((p) => p.id === id)
  if (!target) throw new Error('상품을 찾을 수 없습니다')
  if (products.some((p) => p.id !== id && p.productCode === input.productCode)) {
    throw new Error(`이미 등록된 상품코드입니다: ${input.productCode}`)
  }
  const updated: SupplierProduct = {
    ...target,
    ...input,
    ragSynced: false,
    updatedAt: new Date().toISOString(),
  }
  writeAll(products.map((p) => (p.id === id ? updated : p)))
  return updated
}

export function deleteProduct(id: string) {
  writeAll(readAll().filter((p) => p.id !== id))
}

/** 엑셀 일괄 업로드 결과 반영 (전체 성공 시에만 호출 — All-or-Nothing) */
export function bulkUpsertProducts(rows: ParsedProductRow[]): BulkUpsertResult {
  const result = applyBulkUpsert(readAll(), rows, new Date().toISOString())
  writeAll(result.products)
  return result
}

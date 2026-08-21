// 공급업체 교재·교구 메타데이터 모델 및 검증 (순수 함수).
// 이 데이터는 AI 추천(RAG)의 지식 베이스이므로 스키마 검증을 엄격히 한다.
// 백엔드 도입 시 동일 검증 로직을 서버 사이드에서 재사용한다.

import type { CatalogProduct } from '../api/products'
import { NURI_AREAS } from './plan'

export interface SupplierProduct extends CatalogProduct {
  productCode: string
  /** 누리과정 5대 영역 중 하나 (CatalogProduct에서는 선택, 공급업체 상품에는 필수) */
  nuriDomain: string
  /** 품절/공급 중단 시 false — 추천·견적 대상에서 제외 */
  isAvailable: boolean
  /** RAG 벡터 동기화 여부. 등록/수정 시 false로 마킹되어 백그라운드 파이프라인이 감지 */
  ragSynced: boolean
  updatedAt: string
}

export const PRODUCT_TARGET_AGES = ['만 3세', '만 4세', '만 5세', '만 3~5세', '공통', '교사용']

/** 엑셀 일괄 업로드 표준 템플릿 헤더 (순서 고정) */
export const EXCEL_HEADERS = [
  '상품코드',
  '상품명',
  '카테고리',
  '대상연령',
  '누리과정영역',
  '단가',
  '설명',
  '이미지URL',
  '판매여부',
] as const

export interface ExcelRow {
  /** 엑셀 파일 상의 행 번호 (헤더 제외 데이터는 2부터) */
  rowNumber: number
  values: (string | number | boolean | null | undefined)[]
}

export interface RowError {
  row: number
  column: string
  value: string
  reason: string
}

export interface ParsedProductRow {
  productCode: string
  name: string
  category: string
  targetAge: string
  nuriDomain: string
  unitPrice: number
  description: string
  imageUrl: string
  isAvailable: boolean
}

/** 템플릿 헤더가 표준과 정확히 일치하는지 검증한다. */
export function validateHeaders(headers: (string | null | undefined)[]): string | null {
  for (let i = 0; i < EXCEL_HEADERS.length; i++) {
    const actual = String(headers[i] ?? '').trim()
    if (actual !== EXCEL_HEADERS[i]) {
      return `헤더가 표준 템플릿과 다릅니다. ${i + 1}번째 열은 '${EXCEL_HEADERS[i]}'이어야 합니다 (현재: '${actual || '없음'}'). 템플릿을 다시 다운로드해 주세요.`
    }
  }
  return null
}

const asText = (v: ExcelRow['values'][number]) =>
  v === null || v === undefined ? '' : String(v).trim()

/** 한 행을 검증하고 파싱한다. 에러가 있으면 errors에 추가하고 null을 반환한다. */
export function validateRow(
  row: ExcelRow,
  errors: RowError[],
): ParsedProductRow | null {
  const [code, name, category, targetAge, nuriDomain, price, description, imageUrl, available] =
    row.values
  const rowErrors: RowError[] = []

  const require = (column: string, value: string) => {
    if (value === '') {
      rowErrors.push({
        row: row.rowNumber,
        column,
        value: '',
        reason: `'${column}'은(는) 필수 입력값입니다.`,
      })
    }
    return value
  }

  const codeText = require('상품코드', asText(code))
  const nameText = require('상품명', asText(name))
  const categoryText = require('카테고리', asText(category))
  const ageText = require('대상연령', asText(targetAge))
  const domainText = require('누리과정영역', asText(nuriDomain))
  const priceText = require('단가', asText(price))

  if (domainText !== '' && !NURI_AREAS.includes(domainText as (typeof NURI_AREAS)[number])) {
    rowErrors.push({
      row: row.rowNumber,
      column: '누리과정영역',
      value: domainText,
      reason: `정의되지 않은 누리과정 영역입니다. (허용 값: ${NURI_AREAS.join(', ')})`,
    })
  }

  let priceValue = 0
  if (priceText !== '') {
    const parsed = Number(priceText.replace(/,/g, ''))
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      rowErrors.push({
        row: row.rowNumber,
        column: '단가',
        value: priceText,
        reason: '단가는 숫자(정수) 형식이어야 합니다.',
      })
    } else if (parsed < 0) {
      rowErrors.push({
        row: row.rowNumber,
        column: '단가',
        value: priceText,
        reason: '단가는 0 이상이어야 합니다.',
      })
    } else {
      priceValue = parsed
    }
  }

  const availableText = asText(available)
  let isAvailable = true
  if (availableText !== '') {
    if (['Y', 'y', '판매', 'TRUE', 'true', 'O'].includes(availableText)) isAvailable = true
    else if (['N', 'n', '품절', 'FALSE', 'false', 'X'].includes(availableText))
      isAvailable = false
    else {
      rowErrors.push({
        row: row.rowNumber,
        column: '판매여부',
        value: availableText,
        reason: "판매여부는 'Y' 또는 'N'으로 입력해 주세요.",
      })
    }
  }

  if (rowErrors.length > 0) {
    errors.push(...rowErrors)
    return null
  }
  return {
    productCode: codeText,
    name: nameText,
    category: categoryText,
    targetAge: ageText,
    nuriDomain: domainText,
    unitPrice: priceValue,
    description: asText(description),
    imageUrl: asText(imageUrl),
    isAvailable,
  }
}

export interface BulkUpsertResult {
  products: SupplierProduct[]
  insertedCount: number
  updatedCount: number
}

/**
 * 검증 통과한 행들을 기존 목록에 Upsert한다 (동일 상품코드 → 업데이트).
 * 변경된 모든 레코드는 ragSynced=false로 마킹된다.
 */
export function applyBulkUpsert(
  existing: SupplierProduct[],
  rows: ParsedProductRow[],
  now: string,
): BulkUpsertResult {
  const byCode = new Map(existing.map((p) => [p.productCode, p]))
  let insertedCount = 0
  let updatedCount = 0

  for (const row of rows) {
    const current = byCode.get(row.productCode)
    if (current) {
      updatedCount++
      byCode.set(row.productCode, {
        ...current,
        name: row.name,
        category: row.category,
        targetAge: row.targetAge,
        nuriDomain: row.nuriDomain,
        unitPrice: row.unitPrice,
        description: row.description,
        imageUrl: row.imageUrl || current.imageUrl,
        isAvailable: row.isAvailable,
        ragSynced: false,
        updatedAt: now,
      })
    } else {
      insertedCount++
      byCode.set(row.productCode, {
        id: `prod-${row.productCode.toLowerCase()}`,
        productCode: row.productCode,
        name: row.name,
        category: row.category,
        targetAge: row.targetAge,
        nuriDomain: row.nuriDomain,
        unitPrice: row.unitPrice,
        taxRate: 0,
        isPerStudent: true,
        description: row.description,
        imageUrl: row.imageUrl || undefined,
        keywords: [],
        isAvailable: row.isAvailable,
        ragSynced: false,
        updatedAt: now,
      })
    }
  }

  return {
    products: [...byCode.values()],
    insertedCount,
    updatedCount,
  }
}

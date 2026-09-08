// 엑셀 템플릿 생성 및 업로드 파일 파싱 (exceljs, 브라우저에서 실행).
// 파싱 결과는 lib/supplierProduct.ts의 순수 검증 함수로 넘긴다.

import ExcelJS from 'exceljs'
import {
  EXCEL_HEADERS,
  validateHeaders,
  validateRow,
  type ExcelRow,
  type ParsedProductRow,
  type RowError,
} from '../lib/supplierProduct'
import type { SupplierProduct } from '../lib/supplierProduct'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10MB

/** 표준 업로드 템플릿(.xlsx) 생성. 현재 등록 상품을 예시 데이터로 포함한다. */
export async function generateProductTemplate(
  products: SupplierProduct[],
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('상품목록')
  sheet.columns = EXCEL_HEADERS.map((header) => ({
    header,
    width: header === '설명' ? 40 : header === '상품명' ? 28 : 14,
  }))
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  }
  for (const p of products) {
    sheet.addRow([
      p.productCode,
      p.name,
      p.category,
      p.targetAge,
      p.nuriDomain,
      p.unitPrice,
      p.description ?? '',
      '',
      p.isAvailable ? 'Y' : 'N',
    ])
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export interface UploadParseResult {
  rows: ParsedProductRow[]
  errors: RowError[]
  headerError: string | null
}

/** 업로드된 엑셀 파일을 파싱·검증한다. (저장은 호출부에서 전체 통과 시에만) */
export async function parseProductUpload(file: File): Promise<UploadParseResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      rows: [],
      errors: [],
      headerError: '파일 용량이 10MB를 초과합니다.',
    }
  }
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(await file.arrayBuffer())
  } catch {
    return {
      rows: [],
      errors: [],
      headerError: '엑셀 파일을 읽을 수 없습니다. .xlsx 형식인지 확인해 주세요.',
    }
  }
  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return { rows: [], errors: [], headerError: '시트를 찾을 수 없습니다.' }
  }

  const headerValues: (string | null)[] = []
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    if (col <= EXCEL_HEADERS.length) headerValues[col - 1] = cell.text
  })
  const headerError = validateHeaders(headerValues)
  if (headerError) return { rows: [], errors: [], headerError }

  const rows: ParsedProductRow[] = []
  const errors: RowError[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values: ExcelRow['values'] = []
    for (let col = 1; col <= EXCEL_HEADERS.length; col++) {
      const cell = row.getCell(col)
      values.push(cell.value === null || cell.value === undefined ? '' : cell.text)
    }
    if (values.every((v) => String(v ?? '').trim() === '')) return // 빈 행 무시
    const parsed = validateRow({ rowNumber, values }, errors)
    if (parsed) rows.push(parsed)
  })

  return { rows, errors, headerError: null }
}

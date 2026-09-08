// 교구 도입 심의서 PDF/Excel 내보내기 (표준 공문서 스타일, 한글 폰트 임베드).

import ExcelJS from 'exceljs'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import {
  budgetUsageRate,
  DELIBERATION_SECTIONS,
  deliberationTotal,
  type DeliberationReportRequest,
  type DeliberationReportResponse,
} from './deliberation'
import { loadFontBytes } from './exportPdf'
import { formatKrw } from './quotation'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const INK = rgb(0.12, 0.16, 0.22)
const MUTED = rgb(0.45, 0.5, 0.57)
const LINE = rgb(0.8, 0.84, 0.88)
const HEAD_BG = rgb(0.953, 0.957, 0.965)
const ACCENT = rgb(0.02, 0.47, 0.34)

export interface DeliberationDoc {
  request: DeliberationReportRequest
  report: DeliberationReportResponse
  institution: string
  issuedAt: Date
}

export async function generateDeliberationPdf(docData: DeliberationDoc): Promise<Blob> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(await loadFontBytes(), { subset: true })

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - 70

  const wrap = (text: string, size: number, maxWidth: number): string[] => {
    const lines: string[] = []
    let current = ''
    for (const char of text) {
      if (font.widthOfTextAtSize(current + char, size) > maxWidth) {
        lines.push(current)
        current = char
      } else {
        current += char
      }
    }
    if (current) lines.push(current)
    return lines.length ? lines : ['']
  }

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN + 24) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - 60
    }
  }

  const text = (
    value: string,
    size: number,
    opts: { color?: ReturnType<typeof rgb> } = {},
  ) => {
    for (const line of wrap(value, size, CONTENT_WIDTH)) {
      newPageIfNeeded(size + 4)
      page.drawText(line, { x: MARGIN, y, size, font, color: opts.color ?? INK })
      y -= size + 4
    }
  }

  const { request, report } = docData
  const totalCost = deliberationTotal(request.selectedItems)
  const rate = budgetUsageRate(totalCost, request.totalBudget)

  // 제목
  const title = '교 구  도 입  심 의 서'
  const titleWidth = font.widthOfTextAtSize(title, 20)
  page.drawText(title, {
    x: MARGIN + (CONTENT_WIDTH - titleWidth) / 2,
    y,
    size: 20,
    font,
    color: INK,
  })
  y -= 30
  const dateText = docData.issuedAt.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  text(
    `${docData.institution} · 작성일: ${dateText} · 대상: ${request.targetAge} ${request.classSize}명 · 배정 예산: ${formatKrw(request.totalBudget)}`,
    9.5,
    { color: MUTED },
  )
  y -= 4
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1.2,
    color: INK,
  })
  y -= 16

  // 품목 표 (품명 / 영역 / 수량 / 단가 / 금액)
  const cols = [
    { title: '품명', width: 170, align: 'left' as const },
    { title: '누리과정 영역', width: 100, align: 'center' as const },
    { title: '수량', width: 45, align: 'center' as const },
    { title: '단가', width: 90, align: 'right' as const },
    { title: '금액', width: CONTENT_WIDTH - 405, align: 'right' as const },
  ]
  const rowHeight = 22
  const drawRow = (cells: string[], head = false) => {
    newPageIfNeeded(rowHeight)
    const top = y
    if (head) {
      page.drawRectangle({
        x: MARGIN, y: top - rowHeight, width: CONTENT_WIDTH, height: rowHeight,
        color: HEAD_BG,
      })
    }
    page.drawRectangle({
      x: MARGIN, y: top - rowHeight, width: CONTENT_WIDTH, height: rowHeight,
      borderColor: LINE, borderWidth: 0.6,
    })
    let cx = MARGIN
    cells.forEach((cell, i) => {
      const col = cols[i]
      const size = 9
      let tx = cx + 6
      if (col.align !== 'left') {
        const w = font.widthOfTextAtSize(cell, size)
        tx = col.align === 'right' ? cx + col.width - 6 - w : cx + (col.width - w) / 2
      }
      page.drawText(cell, { x: tx, y: top - 15, size, font, color: INK })
      cx += col.width
    })
    y = top - rowHeight
  }
  drawRow(cols.map((c) => c.title), true)
  for (const item of request.selectedItems) {
    drawRow([
      item.itemName,
      item.curriculumArea,
      String(item.quantity),
      formatKrw(item.unitPrice),
      formatKrw(item.unitPrice * item.quantity),
    ])
  }
  drawRow([
    '총 소요 금액',
    '',
    '',
    rate !== null ? `예산 대비 ${rate}%` : '',
    formatKrw(totalCost),
  ], true)
  y -= 14

  // 4개 심의 항목
  for (const section of DELIBERATION_SECTIONS) {
    newPageIfNeeded(40)
    text(`■ ${section.label}`, 11.5, { color: ACCENT })
    text(report[section.key], 9.5)
    y -= 8
  }

  // 결재란
  y -= 10
  newPageIfNeeded(46)
  const signWidth = 120
  const labels = ['담당', '원감', '원장']
  labels.forEach((label, i) => {
    const x = PAGE_WIDTH - MARGIN - signWidth * (labels.length - i)
    page.drawRectangle({
      x, y: y - 34, width: signWidth, height: 34,
      borderColor: LINE, borderWidth: 0.75,
    })
    page.drawText(label, { x: x + 6, y: y - 14, size: 8.5, font, color: MUTED })
  })

  const pages = doc.getPages()
  if (pages.length > 1) {
    pages.forEach((p, i) => {
      const label = `${i + 1} / ${pages.length}`
      const width = font.widthOfTextAtSize(label, 9)
      p.drawText(label, { x: (PAGE_WIDTH - width) / 2, y: 26, size: 9, font, color: MUTED })
    })
  }

  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export async function generateDeliberationExcel(
  docData: DeliberationDoc,
): Promise<Blob> {
  const { request, report } = docData
  const totalCost = deliberationTotal(request.selectedItems)
  const rate = budgetUsageRate(totalCost, request.totalBudget)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = docData.institution
  const sheet = workbook.addWorksheet('교구도입심의서')
  sheet.columns = [{ width: 32 }, { width: 18 }, { width: 8 }, { width: 14 }, { width: 16 }]

  const thin = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' },
  } as Partial<ExcelJS.Borders>
  const headFill: ExcelJS.Fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' },
  }
  const KRW = '#,##0"원"'

  sheet.mergeCells('A1:E1')
  const title = sheet.getCell('A1')
  title.value = '교구 도입 심의서'
  title.font = { size: 18, bold: true }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 30

  sheet.getCell('A3').value = `기관명: ${docData.institution}`
  sheet.getCell('C3').value = `대상: ${request.targetAge} ${request.classSize}명`
  sheet.getCell('E3').value = `배정 예산: ${request.totalBudget.toLocaleString('ko-KR')}원`

  const headRow = sheet.getRow(5)
  headRow.values = ['품명', '누리과정 영역', '수량', '단가', '금액']
  headRow.eachCell((cell) => {
    cell.fill = headFill
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center' }
    cell.border = thin
  })

  request.selectedItems.forEach((item, i) => {
    const row = sheet.getRow(6 + i)
    row.values = [
      item.itemName,
      item.curriculumArea,
      item.quantity,
      item.unitPrice,
      item.unitPrice * item.quantity,
    ]
    row.getCell(3).alignment = { horizontal: 'center' }
    row.getCell(4).numFmt = KRW
    row.getCell(5).numFmt = KRW
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col <= 5) cell.border = thin
    })
  })

  const totalRowIndex = 6 + request.selectedItems.length
  sheet.mergeCells(`A${totalRowIndex}:D${totalRowIndex}`)
  const totalRow = sheet.getRow(totalRowIndex)
  totalRow.getCell(1).value =
    `총 소요 금액${rate !== null ? ` (예산 대비 ${rate}%)` : ''}`
  totalRow.getCell(1).alignment = { horizontal: 'center' }
  totalRow.getCell(5).value = totalCost
  totalRow.getCell(5).numFmt = KRW
  totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col <= 5) {
      cell.fill = headFill
      cell.font = { bold: true }
      cell.border = thin
    }
  })

  let rowIndex = totalRowIndex + 2
  for (const section of DELIBERATION_SECTIONS) {
    sheet.mergeCells(`A${rowIndex}:E${rowIndex}`)
    const head = sheet.getCell(`A${rowIndex}`)
    head.value = section.label
    head.font = { bold: true }
    head.fill = headFill
    head.border = thin
    sheet.mergeCells(`A${rowIndex + 1}:E${rowIndex + 1}`)
    const body = sheet.getCell(`A${rowIndex + 1}`)
    body.value = report[section.key]
    body.alignment = { wrapText: true, vertical: 'top' }
    body.border = thin
    sheet.getRow(rowIndex + 1).height = 64
    rowIndex += 2
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** 파일명 규칙: {YYYYMMDD}_{기관명}_교구도입심의서.{ext} */
export function deliberationFileName(
  institution: string,
  date: Date,
  ext: 'pdf' | 'xlsx',
): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}${mm}${dd}_${institution.replaceAll(' ', '')}_교구도입심의서.${ext}`
}

// 보육일지·활동 평가서 PDF/Excel 내보내기 (한글 폰트 임베드).

import ExcelJS from 'exceljs'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import { loadFontBytes } from './exportPdf'
import { formatJournalDate, type DailyJournal } from './journal'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const INK = rgb(0.12, 0.16, 0.22)
const MUTED = rgb(0.45, 0.5, 0.57)
const LINE = rgb(0.8, 0.84, 0.88)
const HEAD_BG = rgb(0.953, 0.957, 0.965)
const ACCENT = rgb(0.02, 0.47, 0.34)

export interface JournalDocMeta {
  institution: string
  targetAge: string
  theme: string
}

export async function generateJournalPdf(
  journal: DailyJournal,
  meta: JournalDocMeta,
): Promise<Blob> {
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
    opts: { color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number } = {},
  ) => {
    for (const line of wrap(value, size, opts.maxWidth ?? CONTENT_WIDTH)) {
      newPageIfNeeded(size + 4)
      page.drawText(line, {
        x: opts.x ?? MARGIN,
        y,
        size,
        font,
        color: opts.color ?? INK,
      })
      y -= size + 4
    }
  }

  // 제목
  const title = '일 일  보 육 일 지'
  const titleWidth = font.widthOfTextAtSize(title, 20)
  page.drawText(title, {
    x: MARGIN + (CONTENT_WIDTH - titleWidth) / 2,
    y,
    size: 20,
    font,
    color: INK,
  })
  y -= 32
  text(
    `${meta.institution} · ${formatJournalDate(journal.journalDate)} · 대상: ${meta.targetAge} · 주제: ${meta.theme}`,
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
  y -= 18

  // 일과 기록 테이블 (시간 / 일과 / 실행 내용)
  const col1 = 78
  const col2 = 130
  const col3 = CONTENT_WIDTH - col1 - col2
  for (const entry of journal.dailySchedule) {
    const contentLines = wrap(entry.content, 8.5, col3 - 12)
    const activityLines = wrap(entry.activity, 9, col2 - 12)
    const rowHeight = Math.max(contentLines.length * 11, activityLines.length * 12, 16) + 12
    newPageIfNeeded(rowHeight)
    const top = y
    page.drawRectangle({
      x: MARGIN, y: top - rowHeight, width: col1, height: rowHeight,
      color: HEAD_BG, borderColor: LINE, borderWidth: 0.5,
    })
    page.drawRectangle({
      x: MARGIN + col1, y: top - rowHeight, width: col2, height: rowHeight,
      borderColor: LINE, borderWidth: 0.5,
    })
    page.drawRectangle({
      x: MARGIN + col1 + col2, y: top - rowHeight, width: col3, height: rowHeight,
      borderColor: LINE, borderWidth: 0.5,
    })
    page.drawText(entry.time, { x: MARGIN + 6, y: top - 14, size: 8, font, color: INK })
    let ay = top - 14
    for (const line of activityLines) {
      page.drawText(line, { x: MARGIN + col1 + 6, y: ay, size: 9, font, color: INK })
      ay -= 12
    }
    let cy = top - 14
    for (const line of contentLines) {
      page.drawText(line, { x: MARGIN + col1 + col2 + 6, y: cy, size: 8.5, font, color: MUTED })
      cy -= 11
    }
    y = top - rowHeight
  }

  // 활동 평가
  y -= 16
  newPageIfNeeded(48)
  text('활동 평가', 12, { color: ACCENT })
  y -= 2
  text(journal.activityEvaluation, 9.5)

  // 결재란
  y -= 20
  newPageIfNeeded(46)
  const signWidth = 120
  const labels = ['담임', '원감', '원장']
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

export async function generateJournalExcel(
  journal: DailyJournal,
  meta: JournalDocMeta,
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = meta.institution
  const sheet = workbook.addWorksheet('보육일지')
  sheet.columns = [{ width: 16 }, { width: 26 }, { width: 64 }]

  sheet.mergeCells('A1:C1')
  const title = sheet.getCell('A1')
  title.value = '일일 보육일지'
  title.font = { size: 18, bold: true }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 30

  sheet.getCell('A3').value = `기관명: ${meta.institution}`
  sheet.getCell('B3').value = `일자: ${formatJournalDate(journal.journalDate)}`
  sheet.getCell('C3').value = `대상: ${meta.targetAge} · 주제: ${meta.theme}`

  const headRow = sheet.getRow(5)
  headRow.values = ['시간', '일과', '실행 내용']
  const thin = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' },
  } as Partial<ExcelJS.Borders>
  headRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center' }
    cell.border = thin
  })

  journal.dailySchedule.forEach((entry, i) => {
    const row = sheet.getRow(6 + i)
    row.values = [entry.time, entry.activity, entry.content]
    row.getCell(3).alignment = { wrapText: true, vertical: 'top' }
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col <= 3) cell.border = thin
    })
  })

  const evalRowIndex = 6 + journal.dailySchedule.length + 1
  sheet.mergeCells(`A${evalRowIndex}:C${evalRowIndex}`)
  const evalHead = sheet.getCell(`A${evalRowIndex}`)
  evalHead.value = '활동 평가'
  evalHead.font = { bold: true }
  evalHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
  evalHead.border = thin
  sheet.mergeCells(`A${evalRowIndex + 1}:C${evalRowIndex + 1}`)
  const evalCell = sheet.getCell(`A${evalRowIndex + 1}`)
  evalCell.value = journal.activityEvaluation
  evalCell.alignment = { wrapText: true, vertical: 'top' }
  evalCell.border = thin
  sheet.getRow(evalRowIndex + 1).height = 90

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** 파일명 규칙: {YYYYMMDD}_{기관명}_보육일지.{ext} */
export function journalFileName(
  institution: string,
  dateISO: string,
  ext: 'pdf' | 'xlsx',
): string {
  return `${dateISO.replaceAll('-', '')}_${institution.replaceAll(' ', '')}_보육일지.${ext}`
}

import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import { loadFontBytes } from './exportPdf'
import type { PlanContent } from './plan'
import { formatKrw } from './quotation'

// A4 (pt)
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const INK = rgb(0.12, 0.16, 0.22)
const MUTED = rgb(0.45, 0.5, 0.57)
const LINE = rgb(0.8, 0.84, 0.88)
const HEAD_BG = rgb(0.953, 0.957, 0.965)
const ACCENT = rgb(0.02, 0.47, 0.34)

export interface PlanPdfRecommendation {
  name: string
  unitPrice: number
  matchScore: number
  relatedActivity: string
}

export interface PlanPdfData {
  content: PlanContent
  planTypeLabel: string
  institution: string
  recommendations: PlanPdfRecommendation[]
  issuedAt: Date
}

/** 긴 텍스트를 폭에 맞게 줄바꿈한다 */
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const char of text) {
    const candidate = current + char
    if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current)
      current = char
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

export async function generatePlanPdf(data: PlanPdfData): Promise<Blob> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(await loadFontBytes(), { subset: true })

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - 70

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN + 24) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - 60
    }
  }

  const drawLine = (thickness = 0.75, color = LINE) => {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness,
      color,
    })
  }

  const text = (
    value: string,
    size: number,
    opts: { color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number; lineGap?: number } = {},
  ) => {
    const lines = wrapText(font, value, size, opts.maxWidth ?? CONTENT_WIDTH)
    for (const line of lines) {
      newPageIfNeeded(size + 4)
      page.drawText(line, {
        x: opts.x ?? MARGIN,
        y,
        size,
        font,
        color: opts.color ?? INK,
      })
      y -= size + (opts.lineGap ?? 4)
    }
  }

  // 제목 및 메타
  const { content } = data
  const centered = (value: string, size: number) => {
    const width = font.widthOfTextAtSize(value, size)
    page.drawText(value, {
      x: MARGIN + (CONTENT_WIDTH - width) / 2,
      y,
      size,
      font,
      color: INK,
    })
    y -= size + 10
  }
  centered(content.title, 20)
  const dateText = data.issuedAt.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  text(
    `${data.institution} · 대상 연령: ${content.target_age} · 주제: ${content.theme} · 발행일: ${dateText}`,
    9.5,
    { color: MUTED },
  )
  y -= 4
  drawLine(1.2, INK)
  y -= 16

  // 교육 목표
  text('교육 목표', 12, { color: ACCENT })
  for (const goal of content.goals) {
    text(`· ${goal}`, 10, { color: INK })
  }
  y -= 8

  // 기간별 활동 테이블 (영역 / 활동명·목표 / 활동 내용)
  const col1 = 86
  const col2 = 170
  const col3 = CONTENT_WIDTH - col1 - col2

  for (const periodEntry of content.schedule) {
    newPageIfNeeded(70)
    text(`■ ${periodEntry.period}`, 12, { color: ACCENT })
    y -= 2

    for (const activity of periodEntry.activities) {
      const nameLines = wrapText(font, activity.activity_name, 9.5, col2 - 12)
      const objLines = activity.objective
        ? wrapText(font, `목표: ${activity.objective}`, 8, col2 - 12)
        : []
      const descLines = wrapText(font, activity.description, 8.5, col3 - 12)
      const rowHeight =
        Math.max(
          nameLines.length * 12 + objLines.length * 10,
          descLines.length * 11,
          16,
        ) + 12

      newPageIfNeeded(rowHeight)
      const top = y

      // 셀 배경/테두리
      page.drawRectangle({
        x: MARGIN,
        y: top - rowHeight,
        width: col1,
        height: rowHeight,
        color: HEAD_BG,
        borderColor: LINE,
        borderWidth: 0.5,
      })
      page.drawRectangle({
        x: MARGIN + col1,
        y: top - rowHeight,
        width: col2,
        height: rowHeight,
        borderColor: LINE,
        borderWidth: 0.5,
      })
      page.drawRectangle({
        x: MARGIN + col1 + col2,
        y: top - rowHeight,
        width: col3,
        height: rowHeight,
        borderColor: LINE,
        borderWidth: 0.5,
      })

      page.drawText(activity.area, {
        x: MARGIN + 6,
        y: top - 14,
        size: 8.5,
        font,
        color: INK,
      })
      let cy = top - 14
      for (const line of nameLines) {
        page.drawText(line, { x: MARGIN + col1 + 6, y: cy, size: 9.5, font, color: INK })
        cy -= 12
      }
      for (const line of objLines) {
        page.drawText(line, { x: MARGIN + col1 + 6, y: cy, size: 8, font, color: MUTED })
        cy -= 10
      }
      let dy = top - 14
      for (const line of descLines) {
        page.drawText(line, {
          x: MARGIN + col1 + col2 + 6,
          y: dy,
          size: 8.5,
          font,
          color: MUTED,
        })
        dy -= 11
      }
      y = top - rowHeight
    }
    y -= 12
  }

  // 추천 교재·교구
  if (data.recommendations.length > 0) {
    newPageIfNeeded(60)
    text('AI 추천 교재·교구 (검수 완료)', 12, { color: ACCENT })
    for (const rec of data.recommendations) {
      const scoreText = rec.matchScore > 0 ? ` · ${Math.round(rec.matchScore * 100)}% 일치` : ''
      text(
        `· ${rec.name} — ${formatKrw(rec.unitPrice)}${scoreText} (관련 활동: ${rec.relatedActivity})`,
        9.5,
      )
    }
  }

  // 페이지 번호 (2페이지 이상일 때만): 하단 중앙 "X / Y"
  const pages = doc.getPages()
  if (pages.length > 1) {
    pages.forEach((p, i) => {
      const label = `${i + 1} / ${pages.length}`
      const width = font.widthOfTextAtSize(label, 9)
      p.drawText(label, {
        x: (PAGE_WIDTH - width) / 2,
        y: 26,
        size: 9,
        font,
        color: MUTED,
      })
    })
  }

  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** 파일명 규칙: {YYYYMMDD}_{기관명}_교육계획안_견적서.pdf */
export function planPdfFileName(institution: string, date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const name = institution.replaceAll(' ', '')
  return `${date.getFullYear()}${mm}${dd}_${name}_교육계획안_견적서.pdf`
}

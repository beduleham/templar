import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import nanumGothicUrl from '../assets/fonts/NanumGothic-Regular.ttf?url'
import { formatKrw, type QuoteItem, type QuoteTotals } from './quotation'

// A4 (pt)
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 48

const INK = rgb(0.12, 0.16, 0.22)
const MUTED = rgb(0.45, 0.5, 0.57)
const LINE = rgb(0.8, 0.84, 0.88)
const HEAD_BG = rgb(0.953, 0.957, 0.965) // #F3F4F6
const STAMP_RED = rgb(0.86, 0.15, 0.15)

const supplier = {
  registrationNumber: '123-45-67890',
  name: '누리에듀',
  ceo: '전대근',
  address: '서울특별시 어딘가로 123, 4층',
  phone: '02-1234-5678',
}

let cachedFontBytes: ArrayBuffer | null = null

async function loadFontBytes(): Promise<ArrayBuffer> {
  if (!cachedFontBytes) {
    const res = await fetch(nanumGothicUrl)
    if (!res.ok) throw new Error('한글 폰트를 불러오지 못했습니다')
    cachedFontBytes = await res.arrayBuffer()
  }
  return cachedFontBytes
}

interface TextOpts {
  size?: number
  color?: ReturnType<typeof rgb>
  align?: 'left' | 'center' | 'right'
  /** align 기준이 되는 x. right면 오른쪽 끝, center면 중앙. */
  width?: number
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  { size = 10, color = INK, align = 'left', width = 0 }: TextOpts = {},
) {
  let tx = x
  if (align !== 'left') {
    const textWidth = font.widthOfTextAtSize(text, size)
    tx = align === 'right' ? x + width - textWidth : x + (width - textWidth) / 2
  }
  page.drawText(text, { x: tx, y, size, font, color })
}

export interface QuotationDocData {
  recipient: string
  studentCount: number
  totalBudget: number
  items: QuoteItem[]
  totals: QuoteTotals
  issuedAt: Date
}

export async function generateQuotationPdf(data: QuotationDocData): Promise<Blob> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(await loadFontBytes(), { subset: true })
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const contentWidth = PAGE_WIDTH - MARGIN * 2

  // 제목
  drawText(page, font, '견  적  서', MARGIN, PAGE_HEIGHT - 90, {
    size: 26,
    align: 'center',
    width: contentWidth,
  })
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 104 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 104 },
    thickness: 1.5,
    color: INK,
  })

  // 좌측: 수신자/발행 정보
  const infoTop = PAGE_HEIGHT - 136
  const dateText = data.issuedAt.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  drawText(page, font, `수신: ${data.recipient} 귀중`, MARGIN, infoTop, { size: 12 })
  drawText(page, font, `발행일: ${dateText}`, MARGIN, infoTop - 20, { color: MUTED })
  drawText(page, font, `학급 인원수: ${data.studentCount}명`, MARGIN, infoTop - 36, {
    color: MUTED,
  })
  drawText(
    page,
    font,
    `가용 예산: ${formatKrw(data.totalBudget)}`,
    MARGIN,
    infoTop - 52,
    { color: MUTED },
  )
  drawText(page, font, '아래와 같이 견적합니다.', MARGIN, infoTop - 76, { size: 11 })

  // 우측: 공급자 정보 박스
  const boxWidth = 240
  const boxHeight = 92
  const boxX = PAGE_WIDTH - MARGIN - boxWidth
  const boxY = infoTop - boxHeight + 12
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    borderColor: LINE,
    borderWidth: 1,
  })
  drawText(page, font, '공 급 자', boxX + 10, boxY + boxHeight - 18, {
    size: 9,
    color: MUTED,
  })
  const supplierLines = [
    `등록번호  ${supplier.registrationNumber}`,
    `상호  ${supplier.name}    대표자  ${supplier.ceo}`,
    `주소  ${supplier.address}`,
    `연락처  ${supplier.phone}`,
  ]
  supplierLines.forEach((line, i) => {
    drawText(page, font, line, boxX + 10, boxY + boxHeight - 36 - i * 16, { size: 9 })
  })
  // 직인
  const stampCx = boxX + boxWidth - 26
  const stampCy = boxY + boxHeight - 34
  page.drawEllipse({
    x: stampCx,
    y: stampCy,
    xScale: 17,
    yScale: 17,
    borderColor: STAMP_RED,
    borderWidth: 1.5,
  })
  drawText(page, font, supplier.name, stampCx - 17, stampCy - 4, {
    size: 8,
    color: STAMP_RED,
    align: 'center',
    width: 34,
  })

  // 품목 테이블
  const tableTop = infoTop - 100
  const rowHeight = 24
  const cols = [
    { title: 'No', width: 30, align: 'center' as const },
    { title: '품목명', width: 205, align: 'left' as const },
    { title: '단가', width: 75, align: 'right' as const },
    { title: '수량', width: 44, align: 'center' as const },
    { title: '공급가액', width: 80, align: 'right' as const },
    { title: '부가세', width: 65, align: 'right' as const },
  ]

  const drawRow = (
    cells: string[],
    y: number,
    opts: { headBg?: boolean; bold?: boolean } = {},
  ) => {
    if (opts.headBg) {
      page.drawRectangle({
        x: MARGIN,
        y,
        width: contentWidth,
        height: rowHeight,
        color: HEAD_BG,
      })
    }
    page.drawRectangle({
      x: MARGIN,
      y,
      width: contentWidth,
      height: rowHeight,
      borderColor: LINE,
      borderWidth: 0.75,
    })
    let cx = MARGIN
    cells.forEach((cell, i) => {
      const col = cols[i]
      drawText(page, font, cell, cx + 6, y + 8, {
        size: 9.5,
        align: col.align,
        width: col.width - 12,
        color: opts.bold ? INK : INK,
      })
      cx += col.width
    })
  }

  let y = tableTop - rowHeight
  drawRow(cols.map((c) => c.title), y, { headBg: true })
  data.items.forEach((item, i) => {
    y -= rowHeight
    drawRow(
      [
        String(i + 1),
        item.productName,
        item.unitPrice.toLocaleString('ko-KR'),
        String(item.quantity),
        item.supplyValue.toLocaleString('ko-KR'),
        item.tax.toLocaleString('ko-KR'),
      ],
      y,
    )
  })

  // 합계
  y -= rowHeight
  page.drawRectangle({
    x: MARGIN,
    y,
    width: contentWidth,
    height: rowHeight,
    color: HEAD_BG,
    borderColor: LINE,
    borderWidth: 0.75,
  })
  drawText(page, font, '합계 금액', MARGIN + 6, y + 8, { size: 10 })
  drawText(page, font, formatKrw(data.totals.totalAmount), MARGIN, y + 8, {
    size: 11,
    align: 'right',
    width: contentWidth - 8,
  })

  // 하단 안내
  drawText(
    page,
    font,
    '· 본 견적서는 AI 추천 결과를 바탕으로 자동 생성되었으며, 최종 확정 전 검수를 거쳤습니다.',
    MARGIN,
    y - 28,
    { size: 8.5, color: MUTED },
  )
  drawText(page, font, '· 견적 유효기간: 발행일로부터 30일', MARGIN, y - 42, {
    size: 8.5,
    color: MUTED,
  })

  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

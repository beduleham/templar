import ExcelJS from 'exceljs'
import type { QuotationDocData } from './exportPdf'

const HEAD_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3F4F6' },
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

const KRW_FORMAT = '#,##0"원"'

export async function generateQuotationExcel(data: QuotationDocData): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '누리에듀'
  const sheet = workbook.addWorksheet('견적서', {
    pageSetup: { paperSize: 9, orientation: 'portrait' },
  })

  sheet.columns = [
    { key: 'no', width: 6 },
    { key: 'name', width: 36 },
    { key: 'unitPrice', width: 14 },
    { key: 'quantity', width: 10 },
    { key: 'supplyValue', width: 16 },
    { key: 'tax', width: 12 },
    { key: 'total', width: 16 },
  ]

  // 제목
  sheet.mergeCells('A1:G1')
  const title = sheet.getCell('A1')
  title.value = '견  적  서'
  title.font = { size: 20, bold: true }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 34

  // 발행 정보
  const dateText = data.issuedAt.toLocaleDateString('ko-KR')
  sheet.getCell('A3').value = `수신: ${data.recipient} 귀중`
  sheet.getCell('E3').value = `발행일: ${dateText}`
  sheet.getCell('A4').value = `학급 인원수: ${data.studentCount}명`
  sheet.getCell('E4').value = '공급자: 누리에듀 (123-45-67890)'
  sheet.getCell('A5').value = '가용 예산:'
  const budgetCell = sheet.getCell('B5')
  budgetCell.value = data.totalBudget
  budgetCell.numFmt = KRW_FORMAT

  // 품목 테이블 헤더
  const headRowIndex = 7
  const headRow = sheet.getRow(headRowIndex)
  headRow.values = ['No', '품목명', '단가', '수량', '공급가액', '부가세', '합계']
  headRow.eachCell((cell) => {
    cell.fill = HEAD_FILL
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder
  })

  // 품목 행: 공급가액/합계는 다운로드 후 수정해도 재계산되도록 수식으로 넣는다.
  data.items.forEach((item, i) => {
    const rowIndex = headRowIndex + 1 + i
    const row = sheet.getRow(rowIndex)
    row.getCell(1).value = i + 1
    row.getCell(2).value = item.productName
    row.getCell(3).value = item.unitPrice
    row.getCell(4).value = item.quantity
    row.getCell(5).value = {
      formula: `C${rowIndex}*D${rowIndex}`,
      result: item.supplyValue,
    }
    row.getCell(6).value = item.tax
    row.getCell(7).value = {
      formula: `E${rowIndex}+F${rowIndex}`,
      result: item.totalItemAmount,
    }
    row.getCell(1).alignment = { horizontal: 'center' }
    row.getCell(4).alignment = { horizontal: 'center' }
    ;[3, 5, 6, 7].forEach((c) => {
      row.getCell(c).numFmt = KRW_FORMAT
    })
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col >= 1 && col <= 7) cell.border = thinBorder
    })
  })

  // 합계 행
  const firstDataRow = headRowIndex + 1
  const lastDataRow = headRowIndex + data.items.length
  const totalRowIndex = lastDataRow + 1
  const totalRow = sheet.getRow(totalRowIndex)
  sheet.mergeCells(`A${totalRowIndex}:D${totalRowIndex}`)
  totalRow.getCell(1).value = '합계 금액'
  totalRow.getCell(1).alignment = { horizontal: 'center' }
  totalRow.getCell(5).value = {
    formula: `SUM(E${firstDataRow}:E${lastDataRow})`,
    result: data.totals.supplyTotal,
  }
  totalRow.getCell(6).value = {
    formula: `SUM(F${firstDataRow}:F${lastDataRow})`,
    result: data.totals.taxTotal,
  }
  totalRow.getCell(7).value = {
    formula: `SUM(G${firstDataRow}:G${lastDataRow})`,
    result: data.totals.totalAmount,
  }
  ;[5, 6, 7].forEach((c) => {
    totalRow.getCell(c).numFmt = KRW_FORMAT
  })
  totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col >= 1 && col <= 7) {
      cell.fill = HEAD_FILL
      cell.font = { bold: true }
      cell.border = thinBorder
    }
  })

  const note = sheet.getCell(`A${totalRowIndex + 2}`)
  note.value =
    '· 본 견적서는 AI 추천 결과를 바탕으로 자동 생성되었으며, 최종 확정 전 검수를 거쳤습니다. (견적 유효기간: 발행일로부터 30일)'
  note.font = { size: 9, color: { argb: 'FF6B7280' } }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

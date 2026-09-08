import ExcelJS from 'exceljs'
import { orderStatusLabels, type Order } from './order'

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

/** 주문 상세 내역서(.xlsx) 생성 — 오프라인 물류/회계 처리용 */
export async function generateOrderExcel(order: Order): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '누리에듀'
  const sheet = workbook.addWorksheet('주문내역')

  sheet.columns = [
    { width: 6 },
    { width: 34 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
  ]

  sheet.mergeCells('A1:E1')
  const title = sheet.getCell('A1')
  title.value = '주 문 내 역 서'
  title.font = { size: 18, bold: true }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 30

  const orderDate = new Date(order.createdAt).toLocaleDateString('ko-KR')
  sheet.getCell('A3').value = `기관명: ${order.institutionName}`
  sheet.getCell('D3').value = `주문일자: ${orderDate}`
  sheet.getCell('A4').value = `담당자: ${order.contactPerson} (${order.phone})`
  sheet.getCell('D4').value = `상태: ${orderStatusLabels[order.status]}`
  sheet.getCell('A5').value = `학급 인원수: ${order.studentCount}명`
  if (order.trackingNumber) {
    sheet.getCell('D5').value = `운송장번호: ${order.trackingNumber}`
  }

  const headRowIndex = 7
  const headRow = sheet.getRow(headRowIndex)
  headRow.values = ['No', '상품명', '수량', '단가', '합계']
  headRow.eachCell((cell) => {
    cell.fill = HEAD_FILL
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center' }
    cell.border = thinBorder
  })

  order.items.forEach((item, i) => {
    const rowIndex = headRowIndex + 1 + i
    const row = sheet.getRow(rowIndex)
    row.getCell(1).value = i + 1
    row.getCell(2).value = item.productName
    row.getCell(3).value = item.quantity
    row.getCell(4).value = item.unitPrice
    row.getCell(5).value = {
      formula: `C${rowIndex}*D${rowIndex}`,
      result: item.unitPrice * item.quantity,
    }
    row.getCell(1).alignment = { horizontal: 'center' }
    row.getCell(3).alignment = { horizontal: 'center' }
    row.getCell(4).numFmt = KRW_FORMAT
    row.getCell(5).numFmt = KRW_FORMAT
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col <= 5) cell.border = thinBorder
    })
  })

  const totalRowIndex = headRowIndex + order.items.length + 1
  const totalRow = sheet.getRow(totalRowIndex)
  sheet.mergeCells(`A${totalRowIndex}:D${totalRowIndex}`)
  totalRow.getCell(1).value = '총 합계 금액'
  totalRow.getCell(1).alignment = { horizontal: 'center' }
  totalRow.getCell(5).value = {
    formula: `SUM(E${headRowIndex + 1}:E${totalRowIndex - 1})`,
    result: order.totalPrice,
  }
  totalRow.getCell(5).numFmt = KRW_FORMAT
  totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col <= 5) {
      cell.fill = HEAD_FILL
      cell.font = { bold: true }
      cell.border = thinBorder
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

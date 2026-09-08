export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  // 즉시 revoke하면 브라우저가 다운로드 파일명을 잃거나 저장에 실패할 수 있어
  // 다운로드가 시작될 시간을 준 뒤 정리한다.
  setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

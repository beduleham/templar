// 파일 내보내기 게이트.
// 라이브 프리뷰(아티팩트) 빌드에서는 뷰어 샌드박스가 다운로드를 차단하므로
// PDF/Excel 엔진(한글 폰트 포함, 수 MB)을 번들에서 제외하고 안내만 표시한다.
// 일반 빌드에서는 상수가 false로 치환되어 게이트 분기가 제거된다.

declare const __ARTIFACT_PREVIEW__: boolean

export const EXPORT_DISABLED = __ARTIFACT_PREVIEW__

export const EXPORT_DISABLED_MESSAGE =
  '라이브 프리뷰에서는 파일 다운로드가 제한됩니다. 실제 배포 환경에서 이용해 주세요.'

// 프리뷰 샌드박스(iframe, allow-modals 미설정)에서는 window.confirm이 호출조차
// 되지 않고 항상 false를 반환해, 확인이 필요한 동작(이탈 확인·견적 확정)이
// 영구히 막힌다. 프리뷰 빌드에서는 확인 없이 진행한다.
export const confirmAction = (message: string): boolean =>
  __ARTIFACT_PREVIEW__ ? true : window.confirm(message)

// 오류 복구용 홈 이동. 프리뷰(단일 HTML + 해시 라우터)에서 '/'로 이동하면
// 앱 문서 밖으로 벗어나므로 해시를 초기화한 뒤 같은 문서를 새로고침한다.
export const goHome = () => {
  if (__ARTIFACT_PREVIEW__) {
    window.location.hash = '#/'
    window.location.reload()
  } else {
    window.location.assign('/')
  }
}

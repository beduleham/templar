// 파일 내보내기 게이트.
// 라이브 프리뷰(아티팩트) 빌드에서는 뷰어 샌드박스가 다운로드를 차단하므로
// PDF/Excel 엔진(한글 폰트 포함, 수 MB)을 번들에서 제외하고 안내만 표시한다.
// 일반 빌드에서는 상수가 false로 치환되어 게이트 분기가 제거된다.

declare const __ARTIFACT_PREVIEW__: boolean

export const EXPORT_DISABLED = __ARTIFACT_PREVIEW__

export const EXPORT_DISABLED_MESSAGE =
  '라이브 프리뷰에서는 파일 다운로드가 제한됩니다. 실제 배포 환경에서 이용해 주세요.'

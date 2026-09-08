// 전역 에러 로깅 훅.
// 프로덕션 모니터링 도구(Sentry 등) 도입 시 reportError 내부만 교체하면 되도록
// 수집 지점을 한 곳으로 모은다. 외부 전송은 아직 하지 않는다(백엔드/DSN 미정).

interface ErrorContext {
  [key: string]: unknown
}

export function reportError(source: string, error: unknown, context?: ErrorContext) {
  // TODO(백엔드 도입 시): Sentry.captureException(error, { tags: { source }, extra: context })
  console.error(`[monitor:${source}]`, error, context ?? '')
}

let initialized = false

/** window 전역 에러/미처리 Promise 거부를 수집한다. 앱 부트 시 1회 호출. */
export function initMonitoring() {
  if (initialized) return
  initialized = true
  window.addEventListener('error', (event) => {
    reportError('window-error', event.error ?? event.message, {
      filename: event.filename,
      lineno: event.lineno,
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportError('unhandled-rejection', event.reason)
  })
}

/** 에러 바운더리 검증용: 렌더링 시 의도적으로 예외를 던진다 (어디에도 링크되지 않음) */
export default function CrashProbe(): never {
  throw new Error('CrashProbe: error boundary verification')
}

import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { goHome } from '../../lib/exportGate'
import { reportError } from '../../lib/monitoring'
import ErrorFallbackCard from './ErrorFallbackCard'

/** 라우트 렌더링 중 발생한 에러를 잡아 복구 UI를 보여준다 (router errorElement) */
export default function RouteErrorFallback() {
  const error = useRouteError()

  useEffect(() => {
    reportError('route-error', error)
  }, [error])

  return <ErrorFallbackCard onRetry={goHome} />
}

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../../lib/monitoring'
import ErrorFallbackCard from './ErrorFallbackCard'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * 전역 에러 바운더리 — 렌더링 크래시(White Screen)를 방지하고
 * 사용자에게 복구 가능한 안내 UI를 제공한다.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError('react-boundary', error, { componentStack: info.componentStack })
  }

  handleRetry = () => {
    // 세션 데이터(localStorage)는 유지된 채 홈에서 앱을 다시 시작한다
    // (크래시를 유발한 URL을 그대로 리로드하지 않는다)
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return <ErrorFallbackCard onRetry={this.handleRetry} />
  }
}

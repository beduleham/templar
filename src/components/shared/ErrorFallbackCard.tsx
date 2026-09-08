interface ErrorFallbackCardProps {
  onRetry: () => void
}

/** 복구 안내 카드 (전역 ErrorBoundary와 라우터 errorElement가 공용) */
export default function ErrorFallbackCard({ onRetry }: ErrorFallbackCardProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>
          ⚠️
        </p>
        <h1 className="mt-4 text-lg font-bold text-slate-900">
          서비스가 일시적으로 원활하지 않습니다
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          현재 요청이 많아 처리가 지연되고 있습니다. 잠시 후 다시 시도해주세요.
          작성 중이던 계획안·견적 데이터는 안전하게 보관되어 있습니다.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}

/**
 * 관측성(Observability) 추상화.
 *
 * - 에러 트래킹: Sentry
 * - LLM 트레이싱: Langfuse
 *
 * DSN/API 키가 설정되지 않은 환경(현재 정적 데모 배포)에서는 no-op으로 동작하며,
 * 키가 주입되면 각 SDK 어댑터로 교체된다. 키는 절대 하드코딩하지 않고
 * NEXT_PUBLIC_SENTRY_DSN / NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY 환경 변수로만 읽는다.
 */

export interface ErrorContext {
  /** 어디에서 발생했는지 — 화면·기능 단위 태그 */
  scope: string;
  /** 추가 정보 (민감 정보 금지) */
  extra?: Record<string, string | number | boolean>;
}

export interface LlmTrace {
  name: string;
  model: string;
  /** 프롬프트 원문이 아닌 요약·길이만 전달해 민감 정보 노출을 막는다 */
  inputSummary: string;
  outputSummary: string;
  latencyMs: number;
  tokenCount?: number;
}

export interface ObservabilityClient {
  readonly enabled: boolean;
  captureError(error: unknown, context: ErrorContext): void;
  traceLlm(trace: LlmTrace): void;
}

/** 민감 정보가 로그로 새는 것을 막는 마스킹 */
const SENSITIVE_PATTERN =
  /(ign8t_pk_[A-Za-z0-9_-]+|bkey_[A-Za-z0-9_-]+|\b\d{4}-?\d{4}-?\d{4}-?\d{4}\b)/g;

export function scrub(value: string): string {
  return value.replace(SENSITIVE_PATTERN, "[redacted]");
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return scrub(error.message);
  return scrub(String(error));
}

export const OBSERVABILITY_CONFIGURED =
  (process.env.NEXT_PUBLIC_SENTRY_DSN ?? "") !== "" ||
  (process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY ?? "") !== "";

/**
 * 키가 없을 때 쓰는 기본 구현.
 * 개발 환경에서는 콘솔로만 남겨 동작을 확인할 수 있게 한다.
 */
const noopClient: ObservabilityClient = {
  enabled: false,
  captureError(error, context) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[observability:${context.scope}]`, messageOf(error));
    }
  },
  traceLlm(trace) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[llm-trace] ${trace.name} · ${trace.model} · ${trace.latencyMs}ms`
      );
    }
  },
};

let client: ObservabilityClient = noopClient;

/**
 * 실제 SDK 어댑터 등록 지점.
 * Sentry/Langfuse 키가 준비되면 앱 부팅 시 이 함수로 어댑터를 주입한다
 * (예: `registerObservability(createSentryAdapter())`).
 * 앱 코드는 항상 `observability`만 호출하므로 호출부 변경이 필요 없다.
 */
export function registerObservability(adapter: ObservabilityClient): void {
  client = adapter;
}

export const observability: ObservabilityClient = {
  get enabled() {
    return client.enabled;
  },
  captureError(error, context) {
    client.captureError(error, context);
  },
  traceLlm(trace) {
    client.traceLlm(trace);
  },
};

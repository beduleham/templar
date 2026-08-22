"use client";

import * as React from "react";

import { observability } from "@/services/observability";

/**
 * 최상위 에러 Fallback.
 * 렌더 트리 전체가 실패해도 흰 화면 대신 복구 경로를 보여주고,
 * 관측성 클라이언트로 에러를 보고한다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    observability.captureError(error, {
      scope: "global",
      extra: error.digest !== undefined ? { digest: error.digest } : undefined,
    });
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f2f4f8",
          color: "#191f28",
          fontFamily:
            '"Pretendard Variable", Pretendard, system-ui, sans-serif',
          padding: "24px",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 28,
            padding: 40,
            maxWidth: 420,
            textAlign: "center",
            boxShadow: "0 8px 40px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: "#ff6b6b",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto",
            }}
          >
            !
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginTop: 20,
            }}
          >
            예기치 못한 문제가 발생했어요
          </h1>
          <p
            style={{
              color: "#6b7684",
              fontSize: 14,
              fontWeight: 500,
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            잠시 후 다시 시도해주세요. 문제가 계속되면 아래 코드와 함께 운영팀에
            문의해주세요.
          </p>
          {error.digest !== undefined && (
            <p
              style={{
                color: "#8b95a1",
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
                marginTop: 12,
              }}
            >
              {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              width: "100%",
              height: 44,
              borderRadius: 16,
              border: "none",
              background: "#3182f6",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            다시 시도하기
          </button>
        </div>
      </body>
    </html>
  );
}

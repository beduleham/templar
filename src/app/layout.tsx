import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "아칸 (Archon)",
    template: "%s | 아칸 (Archon)",
  },
  description:
    "AI 기반 SI 플랫폼 아칸 — 대화형 AI 스펙 생성부터 입찰, 에스크로 정산, 실시간 공정관리까지 하나의 신뢰 인프라로.",
};

/**
 * 정적 호스팅은 커스텀 응답 헤더를 지원하지 않아 문서 수준에서 적용 가능한
 * 보안 정책만 meta로 선언한다. frame-ancestors는 meta로 전달하면 브라우저가
 * 무시하고 콘솔 경고만 남기므로 제외했다(응답 헤더로만 유효). 서버 호스팅으로 옮기면 next.config의 headers()로
 * HSTS·X-Frame-Options까지 확장한다. (docs/deployment.md 참고)
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'"
        />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

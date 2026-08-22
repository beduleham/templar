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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

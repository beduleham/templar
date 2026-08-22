import type { ReactNode } from "react";

/** 로그인/회원가입 전용 레이아웃 — 사이드바와 헤더 없이 중앙 정렬만 제공 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center px-4 py-12">
      {children}
    </div>
  );
}

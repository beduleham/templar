"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";

/**
 * 비인증 사용자를 /auth로 돌려보내는 클라이언트 가드.
 * Supabase Auth 연동 시 서버 컴포넌트/미들웨어 세션 체크로 대체된다.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/auth");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-muted-foreground animate-pulse text-sm">
          로그인 페이지로 이동 중…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

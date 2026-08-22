import type { ReactNode } from "react";

import { Header } from "@/components/navigation/header";
import { Sidebar } from "@/components/navigation/sidebar";
import { AuthGuard } from "@/components/providers/auth-guard";

/**
 * 인증 사용자용 App Shell 레이아웃.
 * 데스크톱(lg 이상): 좌측 고정 사이드바 + 상단 헤더.
 * 모바일: 헤더의 햄버거 버튼으로 여는 드로워 네비게이션.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-svh flex-col">
        <Sidebar />
        <div className="flex flex-1 flex-col lg:pl-64">
          <Header />
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}

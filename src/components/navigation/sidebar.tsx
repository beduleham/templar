"use client";

import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/providers/auth-provider";
import { ROLE_LABELS } from "@/lib/navigation";
import { NavLinks } from "@/components/navigation/nav-links";

/** 데스크톱(1024px 이상) 전용 좌측 고정 사이드바 */
export function Sidebar() {
  const { user } = useAuth();
  const role = user?.role ?? "guest";

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="bg-vivid-blue flex size-8 items-center justify-center rounded-xl text-[15px] font-extrabold text-white shadow-sm">
            아
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold tracking-tight">아칸</span>
            <span className="text-muted-foreground text-xs font-medium">
              Archon
            </span>
          </span>
        </Link>
      </div>
      <Separator className="bg-sidebar-border" />
      <div className="flex-1 overflow-y-auto py-4">
        <NavLinks role={role} />
      </div>
      <Separator className="bg-sidebar-border" />
      <div className="text-muted-foreground px-6 py-4 text-xs">
        {user !== null
          ? `${ROLE_LABELS[user.role]} 모드`
          : "로그인이 필요합니다"}
      </div>
    </aside>
  );
}

"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/components/providers/auth-provider";
import { ROLE_LABELS } from "@/lib/navigation";
import { NavLinks } from "@/components/navigation/nav-links";

/** 모바일(1024px 미만) 전용 슬라이드 아웃 드로워 네비게이션 */
export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const { user } = useAuth();
  const role = user?.role ?? "guest";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="메뉴 열기"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="flex items-baseline gap-2 text-left">
            <span className="text-lg font-bold tracking-tight">아칸</span>
            <span className="text-muted-foreground text-xs font-medium">
              Archon
            </span>
          </SheetTitle>
          <SheetDescription className="text-left">
            {user !== null
              ? `${ROLE_LABELS[user.role]} 모드`
              : "로그인이 필요합니다"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-2">
          <NavLinks role={role} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

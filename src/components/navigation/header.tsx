"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { getPageTitle, ROLE_LABELS, type UserRole } from "@/lib/navigation";
import { MobileNav } from "@/components/navigation/mobile-nav";

const SWITCHABLE_ROLES: UserRole[] = ["client", "partner", "admin"];

/** 상단 헤더: 페이지 타이틀, 알림, 사용자 프로필 드롭다운 */
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, setRole } = useAuth();

  const handleSignOut = () => {
    signOut();
    toast.success("로그아웃되었습니다.");
    router.push("/auth");
  };

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur lg:px-8">
      <MobileNav />
      <h1 className="truncate text-base font-semibold lg:text-lg">
        {getPageTitle(pathname)}
      </h1>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="알림"
          onClick={() => toast.info("알림 기능은 준비 중입니다.")}
        >
          <Bell className="size-5" />
        </Button>
        {user !== null ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2"
                aria-label="사용자 메뉴 열기"
              >
                <Avatar>
                  <AvatarFallback>
                    <UserRound className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="hidden flex-col items-start md:flex">
                  <span className="text-sm leading-tight font-medium">
                    {user.name}
                  </span>
                  <span className="text-muted-foreground text-xs leading-tight">
                    {ROLE_LABELS[user.role]}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{user.name}</span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {user.email}
                  </span>
                  <span className="text-muted-foreground text-xs font-normal">
                    역할: {ROLE_LABELS[user.role]}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                역할 전환 (개발용 Mock)
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={user.role}
                onValueChange={(value) => setRole(value as UserRole)}
              >
                {SWITCHABLE_ROLES.map((role) => (
                  <DropdownMenuRadioItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
                <LogOut className="size-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" size="sm" onClick={() => router.push("/auth")}>
            로그인
          </Button>
        )}
      </div>
    </header>
  );
}

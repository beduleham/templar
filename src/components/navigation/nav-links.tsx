"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  filterNavigationByRole,
  type UserRole,
  type VividTone,
} from "@/lib/navigation";

const TONE_STYLES: Record<VividTone, string> = {
  blue: "bg-vivid-blue",
  purple: "bg-vivid-purple",
  mint: "bg-vivid-mint",
  coral: "bg-vivid-coral",
  slate: "bg-muted-foreground",
};

interface NavLinksProps {
  role: UserRole;
  onNavigate?: () => void;
}

export function NavLinks({ role, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const items = filterNavigationByRole(role);

  return (
    <nav className="flex flex-col gap-1.5 px-3" aria-label="주요 메뉴">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.97]",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-200",
                TONE_STYLES[item.tone],
                !isActive && "opacity-85 saturate-[0.9]"
              )}
            >
              <Icon className="size-4" />
            </span>
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

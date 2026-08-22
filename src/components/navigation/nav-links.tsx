"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { filterNavigationByRole, type UserRole } from "@/lib/navigation";

interface NavLinksProps {
  role: UserRole;
  onNavigate?: () => void;
}

export function NavLinks({ role, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const items = filterNavigationByRole(role);

  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="주요 메뉴">
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
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground font-semibold"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

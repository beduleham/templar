import type { ComponentType } from "react";
import {
  Gavel,
  KanbanSquare,
  LayoutDashboard,
  Sparkles,
  Wrench,
} from "lucide-react";

export type UserRole = "client" | "partner" | "admin" | "guest";

export interface NavigationItem {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** 해당 메뉴를 볼 수 있는 권한 역할 */
  roles: UserRole[];
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    title: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["client", "partner", "admin", "guest"],
  },
  {
    title: "AI 스펙 생성",
    href: "/spec-generator",
    icon: Sparkles,
    roles: ["client", "admin"],
  },
  {
    title: "입찰 및 계약",
    href: "/bids",
    icon: Gavel,
    roles: ["client", "partner", "admin"],
  },
  {
    title: "프로젝트 공정판",
    href: "/projects",
    icon: KanbanSquare,
    roles: ["client", "partner", "admin"],
  },
  {
    title: "AS 및 구독 관리",
    href: "/subscriptions",
    icon: Wrench,
    roles: ["client", "partner", "admin"],
  },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  client: "의뢰자",
  partner: "개발 파트너",
  admin: "운영 관리자",
  guest: "게스트",
};

export function filterNavigationByRole(role: UserRole): NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => item.roles.includes(role));
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "대시보드",
  "/spec-generator": "AI 스펙 생성",
  "/bids": "입찰 및 계약",
  "/projects": "프로젝트 공정판",
  "/subscriptions": "AS 및 구독 관리",
};

export function getPageTitle(pathname: string): string {
  const match = Object.entries(PAGE_TITLES).find(
    ([href]) => pathname === href || pathname.startsWith(`${href}/`)
  );
  return match ? match[1] : "아칸";
}

import Link from "next/link";
import { ArrowRight, Compass, FilePlus2, Gavel, Sparkles } from "lucide-react";

import type { UserRole } from "@/lib/navigation";

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  gradientClass: string;
}

const CLIENT_ACTIONS: QuickAction[] = [
  {
    title: "AI 기반 스펙 생성하기",
    description: "10분 대화로 개발 명세와 설계도 만들기",
    href: "/spec-generator",
    icon: Sparkles,
    gradientClass: "from-vivid-blue to-[#6aa8ff]",
  },
  {
    title: "새 프로젝트 등록",
    description: "만든 스펙으로 입찰 시작하기",
    href: "/bids",
    icon: FilePlus2,
    gradientClass: "from-vivid-purple to-[#a78bfa]",
  },
];

const PARTNER_ACTIONS: QuickAction[] = [
  {
    title: "새로운 프로젝트 탐색",
    description: "스펙이 확정된 프로젝트 둘러보기",
    href: "/bids",
    icon: Compass,
    gradientClass: "from-vivid-purple to-[#a78bfa]",
  },
  {
    title: "내 입찰 현황",
    description: "제출한 견적과 선정 결과 확인",
    href: "/bids",
    icon: Gavel,
    gradientClass: "from-vivid-mint to-[#4ddbc6]",
  },
];

/** 역할별 빠른 작업 바로가기 — 그라데이션 벤토 타일 */
export function QuickActions({ role }: { role: UserRole }) {
  const actions = role === "partner" ? PARTNER_ACTIONS : CLIENT_ACTIONS;

  return (
    <div className="flex flex-col gap-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.title}
            href={action.href}
            className={`group relative overflow-hidden rounded-[28px] bg-gradient-to-br ${action.gradientClass} p-6 text-white shadow-sm transition-transform duration-200 active:scale-[0.98]`}
          >
            <Icon className="size-7 opacity-90" />
            <p className="mt-4 text-lg font-extrabold tracking-tight">
              {action.title}
            </p>
            <p className="mt-1 text-[13px] font-medium text-white/80">
              {action.description}
            </p>
            <ArrowRight className="absolute top-6 right-6 size-5 opacity-70 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        );
      })}
    </div>
  );
}

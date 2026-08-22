import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "아칸 (Archon) — AI 기반 SI 플랫폼" };

const FEATURES: { title: string; description: string }[] = [
  {
    title: "AI 스펙 생성",
    description:
      "10~15분 대화만으로 아이디어가 상세 개발 명세와 시스템 설계도로 완성됩니다.",
  },
  {
    title: "투명한 입찰과 계약",
    description:
      "항목별 견적 비교로 어떤 기능에 얼마가 드는지 명확하게 확인하고 계약합니다.",
  },
  {
    title: "실시간 공정 관리",
    description:
      "개발 진행 상황이 설계도 위 색상 변화로 실시간 반영되어 불안함이 사라집니다.",
  },
  {
    title: "안전한 대금 보호",
    description:
      "50/30/20 마일스톤 에스크로로 검수 완료 전까지 대금이 안전하게 보관됩니다.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6 lg:px-12">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">아칸</span>
          <span className="text-muted-foreground text-xs font-medium">
            Archon
          </span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/auth">로그인</Link>
        </Button>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-balance lg:text-5xl">
          외주 개발, 이제 불안 없이 시작하세요
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-base text-balance lg:text-lg">
          아칸은 AI가 만든 정밀한 개발 명세를 계약부터 검수까지 하나의 기준으로
          삼아, 의뢰자와 개발팀 모두를 지키는 신뢰 인프라입니다.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/auth">
              지금 시작하기
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">대시보드 둘러보기</Link>
          </Button>
        </div>
        <div className="mt-16 grid w-full max-w-4xl grid-cols-1 gap-4 text-left sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-card text-card-foreground rounded-xl border p-6 shadow-sm"
            >
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="text-muted-foreground mt-1.5 text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>
      <footer className="text-muted-foreground border-t px-6 py-6 text-center text-xs">
        © 2026 템플러아카이브 — 아칸 (Archon)
      </footer>
    </div>
  );
}

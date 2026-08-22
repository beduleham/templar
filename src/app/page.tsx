import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "아칸 (Archon) — AI 기반 SI 플랫폼" };

const FEATURES: { title: string; description: string; wide?: boolean }[] = [
  {
    title: "말하면, 설계가 됩니다.",
    description:
      "10~15분의 대화만으로 아이디어가 상세 개발 명세와 시스템 설계도로 완성됩니다.",
    wide: true,
  },
  {
    title: "견적이 투명해집니다.",
    description:
      "항목별 견적 비교로 어떤 기능에 얼마가 드는지 정확히 확인하고 계약합니다.",
  },
  {
    title: "진행이 눈에 보입니다.",
    description:
      "개발 상황이 설계도 위 색상 변화로 실시간 반영되어 불안함이 사라집니다.",
  },
  {
    title: "대금은 안전하게.",
    description:
      "50/30/20 마일스톤 에스크로로 검수 완료 전까지 대금이 안전하게 보관됩니다.",
    wide: true,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/70 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold tracking-tight">
              아칸
            </span>
            <span className="text-muted-foreground text-xs font-medium">
              Archon
            </span>
          </div>
          <Button asChild size="sm">
            <Link href="/auth">로그인</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-24 pb-20 text-center lg:pt-36 lg:pb-28">
          <p className="text-primary text-sm font-semibold tracking-tight lg:text-base">
            AI 기반 SI 플랫폼
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance lg:text-6xl">
            외주 개발,
            <br />
            이제 불안 없이.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg text-balance lg:text-xl">
            AI가 만든 정밀한 개발 명세를 계약부터 검수까지 하나의 기준으로.
            의뢰자와 개발팀 모두를 지키는 신뢰 인프라입니다.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/auth">
                지금 시작하기
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="link" size="lg">
              <Link href="/dashboard">대시보드 둘러보기</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 pb-28 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={
                "bg-muted flex flex-col justify-end rounded-3xl p-8 lg:p-10 " +
                (feature.wide ? "sm:col-span-2 min-h-56" : "min-h-56")
              }
            >
              <h2 className="text-2xl font-semibold tracking-tight lg:text-3xl">
                {feature.title}
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md text-[15px] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto w-full max-w-5xl px-6 py-8 text-xs">
          © 2026 템플러아카이브 — 아칸 (Archon)
        </div>
      </footer>
    </div>
  );
}

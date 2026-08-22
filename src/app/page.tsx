import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Gavel,
  KanbanSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "아칸 (Archon) — AI 기반 SI 플랫폼" };

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-30 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="bg-vivid-blue flex size-8 items-center justify-center rounded-xl text-[15px] font-extrabold text-white shadow-sm">
              아
            </span>
            <span className="text-lg font-extrabold tracking-tight">아칸</span>
          </div>
          <Button asChild size="sm">
            <Link href="/auth">로그인</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-16 text-center lg:pt-28">
          <span className="bg-accent text-accent-foreground rounded-full px-4 py-1.5 text-sm font-bold">
            AI 기반 SI 플랫폼
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-balance lg:text-6xl">
            외주 개발,
            <br />
            이제{" "}
            <span className="from-vivid-blue to-vivid-purple bg-gradient-to-r bg-clip-text text-transparent">
              불안 없이.
            </span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg font-medium text-balance">
            AI가 만든 정밀한 개발 명세를 계약부터 검수까지 하나의 기준으로.
            의뢰자와 개발팀 모두를 지키는 신뢰 인프라입니다.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-vivid-blue/30 shadow-lg">
              <Link href="/auth">
                지금 시작하기
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/dashboard">대시보드 둘러보기</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-6 pb-28 sm:grid-cols-2">
          {/* 타일 1 — 비비드 블루 그라데이션 (와이드) */}
          <div className="from-vivid-blue relative overflow-hidden rounded-[28px] bg-gradient-to-br to-[#6aa8ff] p-8 text-white sm:col-span-2 lg:p-10">
            <Sparkles className="size-9 opacity-90" />
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight lg:text-3xl">
              말하면, 설계가 됩니다.
            </h2>
            <p className="mt-2.5 max-w-md text-[15px] leading-relaxed font-medium text-white/85">
              10~15분의 대화만으로 아이디어가 상세 개발 명세와 시스템 설계도로
              완성됩니다.
            </p>
            <div className="mt-6 flex max-w-sm flex-col gap-2">
              <div className="w-fit rounded-2xl rounded-bl-md bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur">
                회원 관리랑 결제가 되는 예약 서비스를 만들고 싶어요
              </div>
              <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-sm font-bold text-[#3182f6]">
                설계도와 개발 명세 34개를 만들었어요 ✓
              </div>
            </div>
          </div>

          {/* 타일 2 — 화이트, 견적 비교 바 */}
          <div className="bg-card rounded-[28px] p-8 shadow-sm lg:p-10">
            <Gavel className="text-vivid-mint size-9" />
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
              견적이 투명해집니다.
            </h2>
            <p className="text-muted-foreground mt-2.5 text-[15px] leading-relaxed font-medium">
              항목별 견적 비교로 어떤 기능에 얼마가 드는지 정확히 확인합니다.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <div className="bg-vivid-mint/90 h-3.5 w-full rounded-full" />
              <div className="bg-vivid-mint/50 h-3.5 w-3/4 rounded-full" />
              <div className="bg-vivid-mint/25 h-3.5 w-1/2 rounded-full" />
            </div>
          </div>

          {/* 타일 3 — 화이트, 공정률 */}
          <div className="bg-card rounded-[28px] p-8 shadow-sm lg:p-10">
            <KanbanSquare className="text-vivid-coral size-9" />
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
              진행이 눈에 보입니다.
            </h2>
            <p className="text-muted-foreground mt-2.5 text-[15px] leading-relaxed font-medium">
              개발 상황이 설계도 위 색상 변화로 실시간 반영됩니다.
            </p>
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <span className="text-vivid-coral text-3xl font-extrabold tabular-nums">
                  72%
                </span>
                <span className="text-muted-foreground text-xs font-semibold">
                  실시간 공정률
                </span>
              </div>
              <div className="bg-muted mt-3 h-3.5 w-full overflow-hidden rounded-full">
                <div className="from-vivid-coral bg-gradient-to-r to-[#ffa06b] h-full w-[72%] rounded-full" />
              </div>
            </div>
          </div>

          {/* 타일 4 — 퍼플 그라데이션 (와이드), 에스크로 */}
          <div className="from-vivid-purple relative overflow-hidden rounded-[28px] bg-gradient-to-br to-[#a78bfa] p-8 text-white sm:col-span-2 lg:p-10">
            <ShieldCheck className="size-9 opacity-90" />
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight lg:text-3xl">
              대금은 안전하게.
            </h2>
            <p className="mt-2.5 max-w-md text-[15px] leading-relaxed font-medium text-white/85">
              50/30/20 마일스톤 에스크로로 검수 완료 전까지 대금이 안전하게
              보관됩니다.
            </p>
            <div className="mt-6 flex gap-2.5">
              {[
                ["선금", "50%"],
                ["중도금", "30%"],
                ["잔금", "20%"],
              ].map(([label, pct]) => (
                <div
                  key={label}
                  className="rounded-2xl bg-white/15 px-5 py-3 text-center backdrop-blur"
                >
                  <div className="text-lg font-extrabold tabular-nums">
                    {pct}
                  </div>
                  <div className="text-xs font-semibold text-white/80">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto w-full max-w-5xl px-6 py-8 text-xs font-medium">
          © 2026 템플러아카이브 — 아칸 (Archon)
        </div>
      </footer>
    </div>
  );
}

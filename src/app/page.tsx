import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  Gavel,
  KanbanSquare,
  MessagesSquare,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import { HeroPreview } from "@/components/landing/hero-preview";
import { Reveal } from "@/components/landing/reveal";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "아칸 (Archon) — AI 기반 SI 플랫폼" };

const NAV = [
  { href: "#journey", label: "진행 방식" },
  { href: "#features", label: "핵심 기능" },
  { href: "#trust", label: "안전장치" },
] as const;

const STATS = [
  { value: "8개", label: "질문이면 명세가 나옵니다", tone: "text-vivid-blue" },
  { value: "10분", label: "대화로 설계도까지 완성", tone: "text-vivid-purple" },
  { value: "50·30·20", label: "단계별 에스크로 분할", tone: "text-vivid-mint" },
  { value: "0건", label: "수정·삭제가 가능한 감사 로그", tone: "text-vivid-coral" },
] as const;

const JOURNEY = [
  {
    step: "01",
    icon: MessagesSquare,
    title: "AI와 대화합니다",
    body: "8개의 질문에 답하면 상세 개발 명세와 시스템 설계도가 자동으로 만들어집니다. 기획 초안 파일을 올려도 됩니다.",
    accent: "bg-vivid-blue",
  },
  {
    step: "02",
    icon: Gavel,
    title: "견적을 비교합니다",
    body: "개발사들이 같은 명세 위에서 항목별로 견적을 냅니다. 평균 대비 편차와 산정 근거까지 나란히 확인합니다.",
    accent: "bg-vivid-purple",
  },
  {
    step: "03",
    icon: KanbanSquare,
    title: "진행을 지켜봅니다",
    body: "개발사가 옮긴 칸반 카드가 설계도 노드 색으로 즉시 반영됩니다. 어디까지 됐는지 물어볼 필요가 없습니다.",
    accent: "bg-vivid-mint",
  },
  {
    step: "04",
    icon: Wallet,
    title: "검수 후 정산합니다",
    body: "단계별 검수를 승인해야 에스크로에 잠긴 대금이 풀립니다. 모든 승인·반려는 되돌릴 수 없는 로그로 남습니다.",
    accent: "bg-vivid-coral",
  },
] as const;

const TRUST = [
  {
    icon: ScrollText,
    title: "NDA 전자서명",
    body: "서명 전에는 상세 명세가 열리지 않습니다. 아이디어가 먼저 새어 나가지 않습니다.",
  },
  {
    icon: FileSearch,
    title: "불변 감사 로그",
    body: "계약·검수·정산의 모든 순간이 추가만 가능한 기록으로 남아 분쟁 시 그대로 근거가 됩니다.",
  },
  {
    icon: ShieldCheck,
    title: "운영사 분쟁 조정",
    body: "합의가 깨져도 로그를 근거로 운영사가 정산·환불을 강제 조정합니다.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/70 sticky top-0 z-30 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="bg-vivid-blue shadow-vivid-blue/30 flex size-8 items-center justify-center rounded-xl text-[15px] font-extrabold text-white shadow-lg">
              아
            </span>
            <span className="text-lg font-extrabold tracking-tight">아칸</span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
              <Link href="/dashboard">둘러보기</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth">로그인</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── 히어로 ───────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* 오로라 + 그리드 배경 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="archon-grid absolute inset-0" />
            <div className="bg-vivid-blue/22 archon-blob absolute -top-32 left-1/2 size-[520px] -translate-x-[75%] rounded-full blur-[130px]" />
            <div
              className="bg-vivid-purple/20 archon-blob absolute -top-20 left-1/2 size-[460px] translate-x-[-10%] rounded-full blur-[130px]"
              style={{ animationDelay: "-6s" }}
            />
            <div
              className="bg-vivid-mint/16 archon-blob absolute top-24 left-1/2 size-[380px] translate-x-[35%] rounded-full blur-[120px]"
              style={{ animationDelay: "-12s" }}
            />
          </div>

          <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-20 pb-16 text-center lg:pt-28">
            <span
              className="archon-rise bg-card/80 ring-vivid-blue/15 flex items-center gap-2 rounded-full py-1.5 pr-4 pl-2 text-sm font-bold shadow-sm ring-1 backdrop-blur"
              style={{ animationDelay: "0ms" }}
            >
              <span className="bg-vivid-blue rounded-full px-2 py-0.5 text-[11px] text-white">
                NEW
              </span>
              <span className="text-accent-foreground">
                항목별 견적 비교 대시보드 공개
              </span>
            </span>

            <h1
              className="archon-rise mt-6 text-[2.6rem] leading-[1.1] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-[4.25rem]"
              style={{ animationDelay: "90ms" }}
            >
              외주 개발,
              <br />
              이제{" "}
              <span className="from-vivid-blue via-vivid-purple to-vivid-mint bg-gradient-to-r bg-clip-text text-transparent">
                불안 없이.
              </span>
            </h1>

            <p
              className="archon-rise text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed font-medium text-balance"
              style={{ animationDelay: "180ms" }}
            >
              AI가 만든 정밀한 개발 명세를 계약부터 검수까지 하나의 기준으로.
              의뢰자와 개발팀 모두를 지키는 신뢰 인프라입니다.
            </p>

            <div
              className="archon-rise mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
              style={{ animationDelay: "270ms" }}
            >
              <Button
                asChild
                size="lg"
                className="shadow-vivid-blue/35 h-13 w-full px-7 text-base shadow-xl transition-transform hover:-translate-y-0.5 sm:w-auto"
              >
                <Link href="/auth">
                  지금 시작하기
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="h-13 w-full px-7 text-base sm:w-auto"
              >
                <Link href="/dashboard">대시보드 둘러보기</Link>
              </Button>
            </div>

            <p
              className="archon-rise text-muted-foreground mt-5 text-[13px] font-semibold"
              style={{ animationDelay: "330ms" }}
            >
              카드 등록 없이 바로 체험 · 데모 데이터가 미리 채워져 있어요
            </p>

            <div
              className="archon-rise mt-14 w-full max-w-4xl"
              style={{ animationDelay: "420ms" }}
            >
              <HeroPreview />
            </div>
          </div>
        </section>

        {/* ── 숫자 스트립 ──────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-6">
          <Reveal className="bg-card grid grid-cols-2 gap-6 rounded-[28px] px-8 py-8 shadow-sm lg:grid-cols-4 lg:px-12">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center lg:text-left">
                <div
                  className={`text-3xl font-extrabold tracking-tight tabular-nums lg:text-4xl ${stat.tone}`}
                >
                  {stat.value}
                </div>
                <div className="text-muted-foreground mt-1.5 text-[13px] leading-snug font-semibold text-balance">
                  {stat.label}
                </div>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ── 진행 방식 ────────────────────────────────────────── */}
        <section id="journey" className="mx-auto w-full max-w-6xl px-6 pt-28">
          <Reveal className="max-w-2xl">
            <span className="text-vivid-blue text-sm font-extrabold">
              진행 방식
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance lg:text-[2.75rem]">
              말 한마디에서 정산까지,
              <br />
              끊기는 구간이 없습니다.
            </h2>
          </Reveal>

          <ol className="relative mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map((item, index) => (
              <Reveal
                as="li"
                key={item.step}
                delay={index * 90}
                className="bg-card group relative rounded-[26px] p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-20px_rgba(25,31,40,0.25)]"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex size-11 items-center justify-center rounded-2xl text-white ${item.accent}`}
                  >
                    <item.icon className="size-5" />
                  </span>
                  <span className="text-muted-foreground/40 text-2xl font-extrabold tabular-nums">
                    {item.step}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-extrabold tracking-tight">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-[14px] leading-relaxed font-medium">
                  {item.body}
                </p>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* ── 핵심 기능 벤토 ───────────────────────────────────── */}
        <section id="features" className="mx-auto w-full max-w-6xl px-6 pt-28">
          <Reveal className="max-w-2xl">
            <span className="text-vivid-purple text-sm font-extrabold">
              핵심 기능
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance lg:text-[2.75rem]">
              불안했던 네 가지를
              <br />
              전부 눈에 보이게.
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* 타일 1 — 비비드 블루 그라데이션 (와이드) */}
            <Reveal className="from-vivid-blue relative overflow-hidden rounded-[28px] bg-gradient-to-br to-[#6aa8ff] p-8 text-white shadow-[0_20px_50px_-24px_rgba(49,130,246,0.65)] sm:col-span-2 lg:p-10">
              <div
                aria-hidden
                className="absolute -top-16 -right-10 size-56 rounded-full bg-white/12 blur-2xl"
              />
              <Sparkles className="size-9 opacity-90" />
              <h3 className="mt-5 text-2xl font-extrabold tracking-tight lg:text-3xl">
                말하면, 설계가 됩니다.
              </h3>
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
            </Reveal>

            {/* 타일 2 — 화이트, 견적 비교 */}
            <Reveal
              delay={80}
              className="bg-card rounded-[28px] p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-20px_rgba(25,31,40,0.22)] lg:p-10"
            >
              <Gavel className="text-vivid-mint size-9" />
              <h3 className="mt-5 text-2xl font-extrabold tracking-tight">
                견적이 투명해집니다.
              </h3>
              <p className="text-muted-foreground mt-2.5 text-[15px] leading-relaxed font-medium">
                항목별 견적 비교로 어떤 기능에 얼마가 드는지 정확히 확인합니다.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                {[
                  ["A사", "w-full", "bg-vivid-mint/90"],
                  ["B사", "w-3/4", "bg-vivid-mint/50"],
                  ["C사", "w-1/2", "bg-vivid-mint/25"],
                ].map(([name, width, tone]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-muted-foreground w-6 text-[11px] font-bold">
                      {name}
                    </span>
                    <div className="bg-muted h-3.5 flex-1 rounded-full">
                      <div className={`h-3.5 rounded-full ${width} ${tone}`} />
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* 타일 3 — 화이트, 공정률 */}
            <Reveal
              delay={160}
              className="bg-card rounded-[28px] p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-20px_rgba(25,31,40,0.22)] lg:p-10"
            >
              <KanbanSquare className="text-vivid-coral size-9" />
              <h3 className="mt-5 text-2xl font-extrabold tracking-tight">
                진행이 눈에 보입니다.
              </h3>
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
                  <div className="from-vivid-coral h-full w-[72%] rounded-full bg-gradient-to-r to-[#ffa06b]" />
                </div>
              </div>
            </Reveal>

            {/* 타일 4 — 퍼플 그라데이션 (와이드), 에스크로 */}
            <Reveal
              delay={80}
              className="from-vivid-purple relative overflow-hidden rounded-[28px] bg-gradient-to-br to-[#a78bfa] p-8 text-white shadow-[0_20px_50px_-24px_rgba(124,92,252,0.6)] sm:col-span-2 lg:p-10"
            >
              <div
                aria-hidden
                className="absolute -bottom-20 -left-10 size-56 rounded-full bg-white/12 blur-2xl"
              />
              <ShieldCheck className="size-9 opacity-90" />
              <h3 className="mt-5 text-2xl font-extrabold tracking-tight lg:text-3xl">
                대금은 안전하게.
              </h3>
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
            </Reveal>
          </div>
        </section>

        {/* ── 안전장치 ─────────────────────────────────────────── */}
        <section id="trust" className="mx-auto w-full max-w-6xl px-6 pt-28">
          <Reveal className="max-w-2xl">
            <span className="text-vivid-mint text-sm font-extrabold">
              안전장치
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance lg:text-[2.75rem]">
              믿음은 약속이 아니라
              <br />
              구조로 만듭니다.
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {TRUST.map((item, index) => (
              <Reveal
                key={item.title}
                delay={index * 90}
                className="bg-card rounded-[26px] p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-20px_rgba(25,31,40,0.22)]"
              >
                <span className="bg-accent text-accent-foreground flex size-11 items-center justify-center rounded-2xl">
                  <item.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-extrabold tracking-tight">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-[14px] leading-relaxed font-medium">
                  {item.body}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── 마무리 CTA ───────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-28 pb-28">
          <Reveal className="relative overflow-hidden rounded-[36px] bg-[#191f28] px-8 py-16 text-center text-white lg:px-16 lg:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0"
            >
              <div className="bg-vivid-blue/50 archon-blob absolute -top-28 left-1/5 size-96 rounded-full blur-[100px]" />
              <div
                className="bg-vivid-purple/50 archon-blob absolute -right-16 -bottom-28 size-96 rounded-full blur-[100px]"
                style={{ animationDelay: "-8s" }}
              />
            </div>
            <div className="relative">
              <h2 className="text-3xl font-extrabold tracking-tight text-balance lg:text-[2.75rem]">
                오늘 떠올린 아이디어를
                <br />
                지금 명세로 바꿔보세요.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed font-medium text-balance text-white/70">
                가입 없이도 데모 데이터로 전 과정을 그대로 체험할 수 있습니다.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-13 w-full px-7 text-base transition-transform hover:-translate-y-0.5 sm:w-auto"
                >
                  <Link href="/spec-generator">
                    AI로 명세 만들기
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="h-13 w-full px-7 text-base text-white hover:bg-white/10 hover:text-white sm:w-auto"
                >
                  <Link href="/dashboard">대시보드 둘러보기</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-6xl px-6 py-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="bg-vivid-blue flex size-8 items-center justify-center rounded-xl text-[15px] font-extrabold text-white">
                  아
                </span>
                <span className="text-lg font-extrabold tracking-tight">
                  아칸
                </span>
              </div>
              <p className="text-muted-foreground mt-3 max-w-xs text-[13px] leading-relaxed font-medium">
                AI 기반 SI 플랫폼. 명세·입찰·에스크로·검수를 하나의 기준으로
                잇습니다.
              </p>
            </div>
            <nav className="flex flex-col gap-2.5 sm:items-end">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground text-[13px] font-semibold transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/subscriptions"
                className="text-muted-foreground hover:text-foreground text-[13px] font-semibold transition-colors"
              >
                AS 구독 요금제
              </Link>
            </nav>
          </div>
          <p className="text-muted-foreground mt-10 text-xs font-medium">
            © 2026 템플러아카이브 — 아칸 (Archon)
          </p>
        </div>
      </footer>
    </div>
  );
}

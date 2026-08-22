"use client";

import Link from "next/link";
import { ArrowRight, Gavel, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { useDomainState } from "@/lib/domain/hooks";
import { calcMatchScore } from "@/lib/domain/store";
import { formatKrw, type Project } from "@/lib/domain/types";

function statusBadge(project: Project) {
  switch (project.status) {
    case "bidding":
      return <Badge variant="purple">입찰 진행 중</Badge>;
    case "active":
      return <Badge>개발 진행 중</Badge>;
    case "completed":
      return <Badge variant="mint">완료</Badge>;
    default:
      return <Badge variant="secondary">스펙 작성 중</Badge>;
  }
}

/** 입찰 및 계약 허브 — 의뢰자: 내 프로젝트 입찰 현황 / 파트너: 프로젝트 탐색 */
export default function BidsPage() {
  const { user } = useAuth();
  const role = user?.role ?? "client";
  const { projects } = useDomainState();

  if (role === "partner") {
    const open = projects.filter((p) => p.status === "bidding");
    // 파트너 자신의 프로필 — Supabase 연동 시 profiles 테이블에서 로드
    const myProfile = {
      id: user?.id ?? "",
      name: user?.name ?? "",
      specialties: ["웹", "결제", "어드민"],
      completedProjects: 12,
    };
    return (
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl font-extrabold tracking-tight">
          새로운 프로젝트 탐색
        </h2>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          AI가 스펙을 확정한 프로젝트에 태스크 단위로 정밀하게 입찰하세요.
        </p>
        <div className="mt-6 flex flex-col gap-4">
          {open.length === 0 && (
            <Card>
              <CardContent className="py-4 text-center">
                <p className="font-bold">지금 입찰 가능한 프로젝트가 없어요</p>
              </CardContent>
            </Card>
          )}
          {open.map((project) => {
            const score = calcMatchScore(project, myProfile);
            return (
              <Card key={project.id} className="py-5">
                <CardContent className="flex flex-wrap items-center gap-4 px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[17px] font-extrabold">{project.title}</p>
                      {statusBadge(project)}
                      <Badge variant="purple">매칭 적합도 {score}%</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm font-medium">
                      {project.summary}
                    </p>
                    <p className="text-muted-foreground mt-1.5 text-xs font-semibold">
                      입찰 {project.bids.filter((b) => b.status !== "rejected").length}건 ·{" "}
                      {project.techTags.join(" · ")}
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/bids/view?id=${project.id}`} data-testid={`explore-${project.id}`}>
                      상세 스펙 보기
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // 의뢰자/관리자 뷰
  const mine = projects.filter(
    (p) => role === "admin" || p.clientId === (user?.id ?? "")
  );
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            입찰 및 계약
          </h2>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            도착한 입찰을 태스크 단위로 비교하고 최적의 파트너를 선정하세요.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/spec-generator">
            <Sparkles className="size-4" />새 스펙 만들기
          </Link>
        </Button>
      </div>
      <div className="mt-6 flex flex-col gap-4">
        {mine.length === 0 && (
          <Card>
            <CardContent className="py-4 text-center">
              <p className="font-bold">아직 프로젝트가 없어요</p>
              <p className="text-muted-foreground mt-1 text-sm">
                AI 스펙 생성기로 첫 프로젝트를 만들어보세요.
              </p>
            </CardContent>
          </Card>
        )}
        {mine.map((project) => (
          <Card key={project.id} className="py-5">
            <CardContent className="flex flex-wrap items-center gap-4 px-6">
              <span className="bg-vivid-mint flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
                <Gavel className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[17px] font-extrabold">{project.title}</p>
                  {statusBadge(project)}
                </div>
                <p className="text-muted-foreground mt-1 text-sm font-semibold">
                  {project.status === "bidding"
                    ? `도착한 입찰 ${project.bids.filter((b) => b.status !== "rejected").length}건`
                    : project.contract !== null
                      ? `${project.contract.partnerName} · ${formatKrw(project.contract.totalAmount)} 계약`
                      : "입찰 대기"}
                </p>
              </div>
              <Button asChild variant={project.status === "bidding" ? "default" : "secondary"}>
                <Link href={`/bids/view?id=${project.id}`} data-testid={`compare-${project.id}`}>
                  {project.status === "bidding" ? "입찰 비교" : "계약 보기"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

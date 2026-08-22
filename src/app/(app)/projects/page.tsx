"use client";

import Link from "next/link";
import { ArrowRight, KanbanSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { useDomainState } from "@/lib/domain/hooks";
import {
  calcProgressRate,
  formatKrw,
  MILESTONE_STATUS_LABELS,
  type Project,
} from "@/lib/domain/types";

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

/** 프로젝트 공정판 목록 */
export default function ProjectsPage() {
  const { user } = useAuth();
  const role = user?.role ?? "client";
  const { projects } = useDomainState();

  const visible = projects.filter((p) => {
    if (role === "admin") return true;
    if (role === "partner")
      return (
        p.contract?.partnerId === user?.id ||
        p.bids.some((b) => b.partnerId === user?.id)
      );
    return p.clientId === user?.id;
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-2xl font-extrabold tracking-tight">프로젝트 공정판</h2>
      <p className="text-muted-foreground mt-1 text-sm font-medium">
        칸반과 시스템 설계도가 연동된 실시간 공정 현황입니다.
      </p>
      <div className="mt-6 flex flex-col gap-4">
        {visible.length === 0 && (
          <Card>
            <CardContent className="py-4 text-center">
              <p className="font-bold">참여 중인 프로젝트가 없어요</p>
            </CardContent>
          </Card>
        )}
        {visible.map((project) => {
          const progress = calcProgressRate(project);
          const currentMilestone = project.milestones.find(
            (m) => m.status !== "released"
          );
          return (
            <Card key={project.id} className="py-5">
              <CardContent className="px-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-vivid-coral flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
                    <KanbanSquare className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[17px] font-extrabold">
                        {project.title}
                      </p>
                      {statusBadge(project)}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-sm font-semibold">
                      {project.contract !== null
                        ? `${formatKrw(project.contract.totalAmount)} · ${
                            currentMilestone !== undefined
                              ? MILESTONE_STATUS_LABELS[currentMilestone.status]
                              : "전체 정산 완료"
                          }`
                        : "계약 전"}
                    </p>
                  </div>
                  <Button asChild>
                    <Link
                      href={`/projects/view?id=${project.id}`}
                      data-testid={`open-project-${project.id}`}
                    >
                      공정판 열기
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Progress value={progress} />
                  <span className="text-muted-foreground w-14 shrink-0 text-right text-sm font-bold tabular-nums">
                    {progress}%
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

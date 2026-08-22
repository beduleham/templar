"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ArchitectureMap } from "@/components/architecture-map";
import { NdaGate } from "@/components/nda/nda-gate";
import { AuditLogList } from "@/components/project/audit-log-list";
import { KanbanBoard } from "@/components/project/kanban-board";
import { MilestoneTracker } from "@/components/project/milestone-tracker";
import { MarkdownView } from "@/components/spec/markdown-view";
import { TaskTree } from "@/components/spec/task-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { useProject } from "@/lib/domain/hooks";
import { canViewSpecDetail, type ActorInfo } from "@/lib/domain/store";
import {
  calcProgressRate,
  flattenTasks,
  formatKrw,
} from "@/lib/domain/types";

/**
 * SSOT 프로젝트 상세 — 스펙·계약·마일스톤·공정판·감사 로그를
 * 하나의 화면에서 통합 관리한다.
 */
export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const project = useProject(params.projectId);

  if (project === null) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="py-4 text-center">
          <p className="font-bold">프로젝트를 찾을 수 없어요</p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/projects">
              <ArrowLeft className="size-4" />
              프로젝트 목록으로
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (user === null) return null;

  const actor: ActorInfo = { id: user.id, name: user.name, role: user.role };
  const canView = canViewSpecDetail(actor, project);
  const progress = calcProgressRate(project);
  const nodeStates = flattenTasks(project)
    .filter((t): t is typeof t & { nodeId: string } => t.nodeId !== null)
    .map((t) => ({ nodeId: t.nodeId, status: t.status }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight">
              {project.title}
            </h2>
            {project.status === "active" && <Badge>개발 진행 중</Badge>}
            {project.status === "completed" && (
              <Badge variant="mint">완료</Badge>
            )}
            {project.status === "bidding" && (
              <Badge variant="purple">입찰 진행 중</Badge>
            )}
          </div>
          {project.contract !== null && (
            <p className="text-muted-foreground mt-1 text-sm font-semibold">
              {project.contract.partnerName} ·{" "}
              {formatKrw(project.contract.totalAmount)} 계약 · SSOT 기준 공정
              관리 중
            </p>
          )}
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/projects">
            <ArrowLeft className="size-4" />
            목록
          </Link>
        </Button>
      </div>

      {!canView ? (
        <div className="mt-6">
          <NdaGate project={project} />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          {/* 실시간 공정률 */}
          <Card className="py-5">
            <CardContent className="px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-bold">전체 공정률</p>
                <p
                  className="text-2xl font-extrabold tabular-nums"
                  data-testid="progress-rate"
                >
                  {progress}%
                </p>
              </div>
              <Progress value={progress} className="mt-3 h-3" />
            </CardContent>
          </Card>

          {/* 공정판: 칸반 + 아키텍처 맵 동기화 */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-lg">칸반 보드</CardTitle>
                <p className="text-muted-foreground text-sm font-medium">
                  카드를 옮기면 설계도의 노드 색상과 공정률이 즉시 반영돼요.
                </p>
              </CardHeader>
              <CardContent>
                <KanbanBoard project={project} actor={actor} />
              </CardContent>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">아키텍처 공정 맵</CardTitle>
                <div className="text-muted-foreground flex gap-3 text-xs font-semibold">
                  <span className="flex items-center gap-1">
                    <i className="size-2.5 rounded-full bg-[#f3f4f6] ring-1 ring-[#9ca3af]" />
                    할 일
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="size-2.5 rounded-full bg-[#f97316]" />
                    진행 중
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="size-2.5 rounded-full bg-[#22c55e]" />
                    완료
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ArchitectureMap
                  mermaidCode={project.mermaidCode}
                  nodeStates={nodeStates}
                />
              </CardContent>
            </Card>
          </div>

          {/* 마일스톤 에스크로 */}
          <MilestoneTracker project={project} actor={actor} />

          {/* 스펙(SSOT 원본) + 감사 로그 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <details className="bg-card rounded-[28px] p-6 shadow-sm lg:p-7">
              <summary className="cursor-pointer list-none text-lg font-bold [&::-webkit-details-marker]:hidden">
                확정 스펙 문서 (SSOT)
                <span className="text-muted-foreground ml-2 text-xs font-semibold">
                  펼쳐 보기
                </span>
              </summary>
              <div className="mt-4 flex flex-col gap-5">
                <MarkdownView markdown={project.specMarkdown} />
                <TaskTree epics={project.epics} showStatus />
              </div>
            </details>
            <AuditLogList project={project} />
          </div>
        </div>
      )}
    </div>
  );
}

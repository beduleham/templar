"use client";

import { KpiCards } from "@/components/dashboard/kpi-cards";
import { ProjectList } from "@/components/dashboard/project-list";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { useAuth } from "@/components/providers/auth-provider";
import { useDomainState } from "@/lib/domain/hooks";
import type {
  ActivityEntry,
  ActivityType,
  DashboardMetrics,
  ProjectSummary,
} from "@/lib/dashboard";
import {
  calcProgressRate,
  flattenTasks,
  type AuditActionType,
  type Project,
} from "@/lib/domain/types";
import { ROLE_LABELS } from "@/lib/navigation";

const ACTIVITY_TYPE_MAP: Record<AuditActionType, ActivityType> = {
  PROJECT_CREATED: "spec_generated",
  NDA_SIGNED: "spec_generated",
  BID_SUBMITTED: "bid_submitted",
  BID_ACCEPTED: "bid_submitted",
  CONTRACT_CREATED: "payment_deposited",
  ESCROW_DEPOSITED: "payment_deposited",
  TASK_STATUS_UPDATE: "task_completed",
  MILESTONE_INSPECTION_REQUESTED: "milestone_review_requested",
  MILESTONE_INSPECTION_REJECTED: "milestone_review_requested",
  MILESTONE_RELEASED: "payment_deposited",
};

const AUDIT_MESSAGES: Record<AuditActionType, string> = {
  PROJECT_CREATED: "새 프로젝트가 생성됐어요",
  NDA_SIGNED: "NDA 서명이 완료됐어요",
  BID_SUBMITTED: "새 입찰이 제출됐어요",
  BID_ACCEPTED: "입찰이 선정됐어요",
  CONTRACT_CREATED: "계약이 체결되고 마일스톤이 생성됐어요",
  ESCROW_DEPOSITED: "대금이 에스크로에 예치됐어요",
  TASK_STATUS_UPDATE: "태스크 상태가 변경됐어요",
  MILESTONE_INSPECTION_REQUESTED: "마일스톤 검수가 요청됐어요",
  MILESTONE_INSPECTION_REJECTED: "마일스톤 검수가 반려됐어요",
  MILESTONE_RELEASED: "마일스톤 대금이 정산됐어요",
};

function toSummary(project: Project): ProjectSummary {
  const milestone =
    project.milestones.find((m) => m.status !== "released") ??
    project.milestones[project.milestones.length - 1];
  return {
    id: project.id,
    title: project.title,
    status:
      project.status === "bidding"
        ? "bidding"
        : project.status === "active"
          ? "active"
          : project.status === "completed"
            ? "completed"
            : "draft",
    milestone:
      milestone === undefined
        ? "advance"
        : milestone.phase === 1
          ? "advance"
          : milestone.phase === 2
            ? "interim"
            : "final",
    budget: project.contract?.totalAmount ?? 0,
    progressRate: Math.round(calcProgressRate(project)),
    updatedAt: new Date(project.createdAt).toLocaleDateString("ko-KR"),
  };
}

/** 메인 대시보드 — 도메인 스토어(SSOT)에서 역할별 지표를 실시간 집계 */
export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role ?? "client";
  const { projects, auditLogs } = useDomainState();

  const isPartner = role === "partner";
  const mine = projects.filter((p) => {
    if (role === "admin") return true;
    if (isPartner)
      return (
        p.contract?.partnerId === user?.id ||
        p.bids.some((b) => b.partnerId === user?.id)
      );
    return p.clientId === user?.id;
  });

  const activeProjects = mine.filter((p) => p.status === "active");
  const metrics: DashboardMetrics = isPartner
    ? {
        activeProjects: activeProjects.length,
        totalAmount: activeProjects
          .flatMap((p) => p.milestones)
          .filter((m) => m.status !== "released")
          .reduce((s, m) => s + m.amount, 0),
        progressOrTasks: mine
          .flatMap((p) => flattenTasks(p))
          .filter((t) => t.status === "done").length,
      }
    : {
        activeProjects: activeProjects.length,
        totalAmount: mine
          .flatMap((p) => p.milestones)
          .filter((m) => m.status === "escrow_deposited")
          .reduce((s, m) => s + m.amount, 0),
        progressOrTasks:
          activeProjects.length === 0
            ? 0
            : Math.round(
                activeProjects.reduce((s, p) => s + calcProgressRate(p), 0) /
                  activeProjects.length
              ),
      };

  const projectSummaries = mine.slice(0, 5).map(toSummary);
  const activities: ActivityEntry[] = auditLogs.slice(0, 5).map((log) => ({
    id: log.id,
    type: ACTIVITY_TYPE_MAP[log.actionType],
    message: AUDIT_MESSAGES[log.actionType],
    projectTitle:
      projects.find((p) => p.id === log.projectId)?.title ?? "프로젝트",
    createdAt: new Date(log.createdAt).toLocaleDateString("ko-KR"),
  }));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold tracking-tight">
          안녕하세요, {user?.name ?? "게스트"}님 👋
        </h2>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          {ROLE_LABELS[role]} 모드로 보고 있어요. 오늘의 프로젝트 현황입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <KpiCards role={role} metrics={metrics} />
          <ProjectList projects={projectSummaries} />
        </div>
        <div className="flex flex-col gap-5">
          <QuickActions role={role} />
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}

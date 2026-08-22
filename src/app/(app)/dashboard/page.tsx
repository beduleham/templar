"use client";

import * as React from "react";

import { useAuth } from "@/components/providers/auth-provider";
import {
  KpiCards,
  KpiCardsSkeleton,
} from "@/components/dashboard/kpi-cards";
import {
  ProjectList,
  ProjectListSkeleton,
} from "@/components/dashboard/project-list";
import {
  ActivityFeed,
  ActivityFeedSkeleton,
} from "@/components/dashboard/activity-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";
import {
  fetchDashboardMetrics,
  fetchRecentActivities,
  fetchRecentProjects,
  type ActivityEntry,
  type DashboardMetrics,
  type ProjectSummary,
} from "@/lib/dashboard";
import { ROLE_LABELS } from "@/lib/navigation";

interface DashboardData {
  role: string;
  metrics: DashboardMetrics;
  projects: ProjectSummary[];
  activities: ActivityEntry[];
}

/**
 * 메인 대시보드 — 역할 기반 KPI·프로젝트·활동 피드.
 * 현재는 Mock 데이터 레이어(@/lib/dashboard)를 클라이언트에서 로드하며,
 * Supabase 연동 태스크에서 Server Component 페칭 + Realtime 구독으로 교체된다.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role ?? "client";
  const [loaded, setLoaded] = React.useState<DashboardData | null>(null);
  // 역할이 바뀌면 이전 데이터는 stale로 간주하고 스켈레톤을 다시 노출
  const data = loaded !== null && loaded.role === role ? loaded : null;

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchDashboardMetrics(role),
      fetchRecentProjects(),
      fetchRecentActivities(),
    ]).then(([metrics, projects, activities]) => {
      if (!cancelled) {
        setLoaded({ role, metrics, projects, activities });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [role]);

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
          {data !== null ? (
            <KpiCards role={role} metrics={data.metrics} />
          ) : (
            <KpiCardsSkeleton />
          )}
          {data !== null ? (
            <ProjectList projects={data.projects} />
          ) : (
            <ProjectListSkeleton />
          )}
        </div>
        <div className="flex flex-col gap-5">
          <QuickActions role={role} />
          {data !== null ? (
            <ActivityFeed activities={data.activities} />
          ) : (
            <ActivityFeedSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}

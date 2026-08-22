import { Briefcase, CheckCircle2, PiggyBank, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatKrw, type DashboardMetrics } from "@/lib/dashboard";
import type { UserRole } from "@/lib/navigation";

interface KpiCardsProps {
  role: UserRole;
  metrics: DashboardMetrics;
}

interface KpiItem {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  toneClass: string;
}

export function buildKpiItems(role: UserRole, metrics: DashboardMetrics): KpiItem[] {
  const isPartner = role === "partner";
  return [
    {
      label: "진행 중인 프로젝트",
      value: `${metrics.activeProjects}건`,
      icon: Briefcase,
      toneClass: "bg-vivid-blue",
    },
    {
      label: isPartner ? "정산 예정 금액" : "총 예치 금액",
      value: formatKrw(metrics.totalAmount),
      icon: PiggyBank,
      toneClass: isPartner ? "bg-vivid-purple" : "bg-vivid-mint",
    },
    isPartner
      ? {
          label: "완료된 태스크",
          value: `${metrics.progressOrTasks}개`,
          icon: CheckCircle2,
          toneClass: "bg-vivid-mint",
        }
      : {
          label: "평균 공정률",
          value: `${metrics.progressOrTasks}%`,
          icon: TrendingUp,
          toneClass: "bg-vivid-coral",
        },
  ];
}

/** 역할별 핵심 지표 카드 3종 */
export function KpiCards({ role, metrics }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {buildKpiItems(role, metrics).map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="gap-0 py-5">
            <CardContent className="px-5">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-2xl text-white shadow-sm",
                  item.toneClass
                )}
              >
                <Icon className="size-5" />
              </span>
              <p className="text-muted-foreground mt-4 text-[13px] font-semibold">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
                {item.value}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="gap-0 py-5">
          <CardContent className="px-5">
            <Skeleton className="size-10" />
            <Skeleton className="mt-4 h-3.5 w-24" />
            <Skeleton className="mt-2 h-7 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

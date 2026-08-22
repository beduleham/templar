import {
  FileCheck2,
  Gavel,
  ListChecks,
  PiggyBank,
  Sparkles,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ActivityEntry, ActivityType } from "@/lib/dashboard";

const ACTIVITY_ICONS: Record<
  ActivityType,
  { icon: React.ComponentType<{ className?: string }>; toneClass: string }
> = {
  spec_generated: { icon: Sparkles, toneClass: "bg-vivid-purple" },
  bid_submitted: { icon: Gavel, toneClass: "bg-vivid-mint" },
  milestone_review_requested: { icon: FileCheck2, toneClass: "bg-vivid-coral" },
  task_completed: { icon: ListChecks, toneClass: "bg-vivid-blue" },
  payment_deposited: { icon: PiggyBank, toneClass: "bg-vivid-mint" },
};

/** 감사 로그 기반 최근 활동 타임라인 (Supabase 연동 시 실시간 구독으로 교체) */
export function ActivityFeed({ activities }: { activities: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">최근 활동</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-4">
          {activities.map((activity) => {
            const { icon: Icon, toneClass } = ACTIVITY_ICONS[activity.type];
            return (
              <li key={activity.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                    toneClass
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug font-semibold">
                    {activity.message}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs font-medium">
                    {activity.projectTitle} · {activity.createdAt}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-24" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-1.5 h-3 w-2/3" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

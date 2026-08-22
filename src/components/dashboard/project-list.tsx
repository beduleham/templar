import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MILESTONE_LABELS,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
  type ProjectSummary,
} from "@/lib/dashboard";

const STATUS_BADGE_VARIANTS: Record<
  ProjectStatus,
  "default" | "secondary" | "mint" | "purple" | "coral"
> = {
  draft: "secondary",
  bidding: "purple",
  active: "default",
  completed: "mint",
};

/** 최근 프로젝트 목록 — 상태·마일스톤·실시간 공정률 */
export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">최근 프로젝트</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {projects.map((project) => (
          <div key={project.id} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold">
                {project.title}
              </span>
              <Badge variant={STATUS_BADGE_VARIANTS[project.status]}>
                {PROJECT_STATUS_LABELS[project.status]}
              </Badge>
              <Badge variant="secondary">
                {MILESTONE_LABELS[project.milestone]}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Progress
                value={project.progressRate}
                aria-label={`${project.title} 공정률`}
              />
              <span className="text-muted-foreground w-12 shrink-0 text-right text-sm font-bold tabular-nums">
                {project.progressRate}%
              </span>
            </div>
            <p className="text-muted-foreground text-xs font-medium">
              마지막 업데이트 {project.updatedAt}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ProjectListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

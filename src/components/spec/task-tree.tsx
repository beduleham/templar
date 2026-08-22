import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MILESTONE_PHASE_LABELS,
  type SpecEpic,
  type SpecTaskStatus,
} from "@/lib/domain/types";

const STATUS_DOTS: Record<SpecTaskStatus, string> = {
  todo: "bg-muted-foreground/40",
  in_progress: "bg-vivid-coral",
  done: "bg-vivid-mint",
};

const STATUS_LABELS: Record<SpecTaskStatus, string> = {
  todo: "할 일",
  in_progress: "진행 중",
  done: "완료",
};

/** Epic > Feature > Task 3단계 계층 아코디언 */
export function TaskTree({
  epics,
  showStatus = false,
}: {
  epics: SpecEpic[];
  showStatus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {epics.map((epic) => (
        <details
          key={epic.id}
          open
          className="group bg-muted/60 rounded-2xl px-4 py-3"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 -rotate-90 transition-transform group-open:rotate-0" />
            {epic.title}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {epic.features.map((feature) => (
              <div key={feature.id} className="bg-card rounded-xl p-3.5">
                <p className="text-sm font-bold">{feature.title}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {feature.tasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-2.5">
                      {showStatus && (
                        <span
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            STATUS_DOTS[task.status]
                          )}
                          title={STATUS_LABELS[task.status]}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{task.title}</p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {task.description}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {MILESTONE_PHASE_LABELS[task.milestonePhase]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

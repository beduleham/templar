"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  DomainError,
  updateTaskStatus,
  type ActorInfo,
} from "@/lib/domain/store";
import {
  flattenTasks,
  MILESTONE_PHASE_LABELS,
  type Project,
  type SpecTask,
  type SpecTaskStatus,
} from "@/lib/domain/types";

const COLUMNS: { status: SpecTaskStatus; title: string; accent: string }[] = [
  { status: "todo", title: "할 일", accent: "bg-muted-foreground/50" },
  { status: "in_progress", title: "진행 중", accent: "bg-vivid-coral" },
  { status: "done", title: "완료", accent: "bg-vivid-mint" },
];

/**
 * 실시간 칸반 보드.
 * 드래그 앤 드롭 또는 카드 메뉴로 상태를 바꾸면 스토어가 갱신되고,
 * 같은 화면의 아키텍처 맵 노드 색상과 공정률이 즉시(<3초) 반영된다.
 * Supabase 연동 시 tasks Realtime 구독으로 다른 세션에도 동기화된다.
 */
export function KanbanBoard({
  project,
  actor,
}: {
  project: Project;
  actor: ActorInfo;
}) {
  const [dragTaskId, setDragTaskId] = React.useState<string | null>(null);
  const [overColumn, setOverColumn] = React.useState<SpecTaskStatus | null>(null);
  const tasks = flattenTasks(project);

  const moveTask = (taskId: string, status: SpecTaskStatus) => {
    try {
      updateTaskStatus(actor, project.id, taskId, status);
    } catch (e) {
      toast.error(e instanceof DomainError ? e.message : "변경에 실패했습니다.");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="kanban">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.status);
        return (
          <div
            key={column.status}
            onDragOver={(e) => {
              e.preventDefault();
              setOverColumn(column.status);
            }}
            onDragLeave={() => setOverColumn(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOverColumn(null);
              if (dragTaskId !== null) moveTask(dragTaskId, column.status);
              setDragTaskId(null);
            }}
            className={cn(
              "bg-muted/60 flex min-h-40 flex-col gap-2.5 rounded-2xl p-3 transition-colors",
              overColumn === column.status && "bg-accent"
            )}
            data-testid={`kanban-col-${column.status}`}
          >
            <div className="flex items-center gap-2 px-1">
              <span className={cn("size-2.5 rounded-full", column.accent)} />
              <p className="text-sm font-bold">{column.title}</p>
              <span className="text-muted-foreground ml-auto text-xs font-bold tabular-nums">
                {columnTasks.length}
              </span>
            </div>
            {columnTasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onDragStart={() => setDragTaskId(task.id)}
                onMove={(status) => moveTask(task.id, status)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  task,
  onDragStart,
  onMove,
}: {
  task: SpecTask;
  onDragStart: () => void;
  onMove: (status: SpecTaskStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          draggable
          onDragStart={onDragStart}
          className="bg-card cursor-grab rounded-xl p-3 text-left shadow-sm transition-transform duration-150 active:scale-[0.98]"
          data-testid={`kanban-card-${task.id}`}
        >
          <p className="text-sm font-semibold">{task.title}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary">
              {MILESTONE_PHASE_LABELS[task.milestonePhase]}
            </Badge>
            {task.nodeId !== null && (
              <span className="text-muted-foreground text-[11px] font-semibold">
                노드 {task.nodeId}
              </span>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {COLUMNS.filter((c) => c.status !== task.status).map((c) => (
          <DropdownMenuItem
            key={c.status}
            onSelect={() => onMove(c.status)}
            data-testid={`move-${task.id}-${c.status}`}
          >
            <span className={cn("size-2 rounded-full", c.accent)} />
            {c.title}(으)로 이동
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

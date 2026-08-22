"use client";

import { ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDomainState } from "@/lib/domain/hooks";
import {
  AUDIT_ACTION_LABELS,
  type AuditLog,
  type Project,
} from "@/lib/domain/types";

function stateSummary(state: Record<string, unknown> | null): string {
  if (state === null) return "—";
  return Object.entries(state)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

/**
 * 수정 불가능한 감사 로그 뷰어.
 * 스토어가 append 외의 변경 API를 제공하지 않아 UI에서도 수정·삭제가 불가능하다 —
 * Supabase 연동 시 UPDATE/DELETE 차단 트리거 + INSERT 전용 RLS로 동일하게 강제된다.
 */
export function AuditLogList({ project }: { project: Project }) {
  const { auditLogs } = useDomainState();
  const logs: AuditLog[] = auditLogs.filter((l) => l.projectId === project.id);

  return (
    <Card data-testid="audit-log">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScrollText className="text-muted-foreground size-5" />
          변경 이력 (감사 로그)
          <Badge variant="secondary">수정 불가</Badge>
        </CardTitle>
        <p className="text-muted-foreground text-sm font-medium">
          계약과 공정에 대한 모든 변경이 자동으로 기록되며, 누구도 수정하거나
          삭제할 수 없습니다.
        </p>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm font-semibold">
            아직 기록된 이력이 없어요.
          </p>
        ) : (
          <ol className="flex flex-col">
            {logs.map((log, i) => (
              <li
                key={log.id}
                className="relative flex gap-4 pb-5 last:pb-0"
              >
                <div className="flex flex-col items-center">
                  <span className="bg-vivid-blue mt-1.5 size-2.5 shrink-0 rounded-full" />
                  {i < logs.length - 1 && (
                    <span className="bg-border mt-1 w-px flex-1" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{AUDIT_ACTION_LABELS[log.actionType]}</Badge>
                    <span className="text-muted-foreground text-xs font-semibold">
                      {log.actorName} · {formatTime(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-xs font-medium break-all">
                    {log.beforeState !== null && (
                      <>
                        <span className="font-bold">이전</span>{" "}
                        {stateSummary(log.beforeState)} {" → "}
                      </>
                    )}
                    <span className="font-bold">이후</span>{" "}
                    {stateSummary(log.afterState)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

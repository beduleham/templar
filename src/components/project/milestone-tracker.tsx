"use client";

import * as React from "react";
import { CircleCheck, Landmark, PiggyBank, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  approveInspection,
  depositEscrow,
  DomainError,
  rejectInspection,
  requestInspection,
  type ActorInfo,
} from "@/lib/domain/store";
import {
  flattenTasks,
  formatKrw,
  MILESTONE_PHASE_LABELS,
  MILESTONE_STATUS_LABELS,
  type Milestone,
  type Project,
} from "@/lib/domain/types";

const STATUS_BADGES: Record<
  Milestone["status"],
  "secondary" | "default" | "coral" | "mint"
> = {
  pending: "secondary",
  escrow_deposited: "default",
  inspection_requested: "coral",
  released: "mint",
};

/**
 * 50/30/20 마일스톤 에스크로 트래커.
 * 의뢰자: 예치 → 검수 승인/반려, 파트너: 검수 요청.
 * 모든 상태 변경은 감사 로그에 INSERT 전용으로 기록된다. (Mock PG — 실 PG 연동 시 교체)
 */
export function MilestoneTracker({
  project,
  actor,
}: {
  project: Project;
  actor: ActorInfo;
}) {
  const [requestTarget, setRequestTarget] = React.useState<Milestone | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<Milestone | null>(null);
  const [notes, setNotes] = React.useState("");
  const [reason, setReason] = React.useState("");

  if (project.contract === null || project.milestones.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-center">
          <p className="font-bold">아직 계약이 체결되지 않았어요</p>
          <p className="text-muted-foreground mt-1 text-sm">
            입찰 선정이 완료되면 50/30/20 마일스톤이 자동 생성됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isClient = actor.role !== "partner" && project.clientId === actor.id;
  const isPartner = actor.role === "partner";
  const tasks = flattenTasks(project);

  const run = (fn: () => void, successMessage: string) => {
    try {
      fn();
      toast.success(successMessage);
    } catch (e) {
      toast.error(e instanceof DomainError ? e.message : "처리에 실패했습니다.");
    }
  };

  const releasedTotal = project.milestones
    .filter((m) => m.status === "released")
    .reduce((s, m) => s + m.amount, 0);

  return (
    <Card data-testid="milestone-tracker">
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-lg">마일스톤 · 에스크로 정산</CardTitle>
          <p className="text-muted-foreground text-sm font-bold tabular-nums">
            정산 완료 {formatKrw(releasedTotal)} /{" "}
            {formatKrw(project.contract.totalAmount)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {project.milestones.map((milestone) => {
          const phaseTasks = tasks.filter(
            (t) => t.milestonePhase === milestone.phase
          );
          const undone = phaseTasks.filter((t) => t.status !== "done").length;
          const prev = project.milestones.find(
            (m) => m.phase === milestone.phase - 1
          );
          const depositBlocked =
            prev !== undefined && prev.status !== "released";

          return (
            <div
              key={milestone.id}
              className={cn(
                "rounded-2xl border p-5",
                milestone.status === "released"
                  ? "border-vivid-mint/40 bg-vivid-mint/8"
                  : "bg-muted/40 border-transparent"
              )}
              data-testid={`milestone-${milestone.phase}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold">
                  {MILESTONE_PHASE_LABELS[milestone.phase]}
                </p>
                <Badge variant={STATUS_BADGES[milestone.status]}>
                  {MILESTONE_STATUS_LABELS[milestone.status]}
                </Badge>
              </div>
              <p className="mt-3 text-xl font-extrabold tabular-nums">
                {formatKrw(milestone.amount)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs font-semibold">
                태스크 {phaseTasks.length - undone}/{phaseTasks.length} 완료
              </p>
              {milestone.rejectReason !== null &&
                milestone.status === "escrow_deposited" && (
                  <p className="text-vivid-coral mt-2 text-xs font-semibold">
                    반려됨: {milestone.rejectReason}
                  </p>
                )}
              {milestone.inspectionNotes !== null &&
                milestone.status === "inspection_requested" && (
                  <p className="text-muted-foreground mt-2 text-xs font-medium">
                    산출물: {milestone.inspectionNotes}
                  </p>
                )}

              <div className="mt-4 flex flex-col gap-2">
                {isClient && milestone.status === "pending" && (
                  <Button
                    size="sm"
                    disabled={depositBlocked}
                    onClick={() =>
                      run(
                        () => depositEscrow(actor, project.id, milestone.id),
                        `${MILESTONE_PHASE_LABELS[milestone.phase]} 대금이 에스크로에 안전하게 예치됐어요.`
                      )
                    }
                    data-testid={`deposit-${milestone.phase}`}
                  >
                    <PiggyBank className="size-4" />
                    에스크로 예치하기
                  </Button>
                )}
                {isPartner && milestone.status === "escrow_deposited" && (
                  <Button
                    size="sm"
                    disabled={undone > 0}
                    onClick={() => {
                      setNotes("");
                      setRequestTarget(milestone);
                    }}
                    data-testid={`inspect-request-${milestone.phase}`}
                  >
                    <Search className="size-4" />
                    검수 요청하기
                  </Button>
                )}
                {isPartner &&
                  milestone.status === "escrow_deposited" &&
                  undone > 0 && (
                    <p className="text-muted-foreground text-xs font-semibold">
                      남은 태스크 {undone}개를 완료하면 검수를 요청할 수 있어요.
                    </p>
                  )}
                {isClient && milestone.status === "inspection_requested" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        run(
                          () =>
                            approveInspection(actor, project.id, milestone.id),
                          "검수가 승인되어 대금이 정산됐어요."
                        )
                      }
                      data-testid={`approve-${milestone.phase}`}
                    >
                      <CircleCheck className="size-4" />
                      검수 승인 · 정산
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReason("");
                        setRejectTarget(milestone);
                      }}
                    >
                      반려하기
                    </Button>
                  </>
                )}
                {milestone.status === "released" && (
                  <p className="text-vivid-mint flex items-center gap-1.5 text-xs font-bold">
                    <Landmark className="size-3.5" />
                    파트너에게 정산 지급 완료
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* 검수 요청 다이얼로그 (파트너) */}
      <Dialog
        open={requestTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRequestTarget(null);
        }}
      >
        <DialogContent>
          <DialogTitle>마일스톤 검수 요청</DialogTitle>
          <DialogDescription>
            산출물 링크나 설명을 남기면 의뢰자가 확인 후 승인합니다.
          </DialogDescription>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="산출물 링크 또는 설명 (선택)"
            data-testid="inspect-notes"
          />
          <Button
            onClick={() => {
              if (requestTarget === null) return;
              run(
                () =>
                  requestInspection(actor, project.id, requestTarget.id, notes),
                "검수 요청을 보냈어요. 의뢰자 승인을 기다립니다."
              );
              setRequestTarget(null);
            }}
            data-testid="inspect-submit"
          >
            검수 요청 보내기
          </Button>
        </DialogContent>
      </Dialog>

      {/* 검수 반려 다이얼로그 (의뢰자) */}
      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      >
        <DialogContent>
          <DialogTitle>검수 반려</DialogTitle>
          <DialogDescription>
            반려 사유는 파트너에게 전달되고 감사 로그에 기록됩니다.
          </DialogDescription>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="반려 사유 (필수)"
          />
          <Button
            variant="destructive"
            onClick={() => {
              if (rejectTarget === null) return;
              run(
                () =>
                  rejectInspection(actor, project.id, rejectTarget.id, reason),
                "검수를 반려했어요."
              );
              setRejectTarget(null);
            }}
          >
            반려하기
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

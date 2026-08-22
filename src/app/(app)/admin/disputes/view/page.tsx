"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Banknote, ShieldAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { AuditLogList } from "@/components/project/audit-log-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useProject } from "@/lib/domain/hooks";
import { escrowService } from "@/services/escrow";
import {
  adminOverrideMilestone,
  DomainError,
  type ActorInfo,
  type OverrideAction,
} from "@/lib/domain/store";
import {
  formatKrw,
  isMilestoneClosed,
  MILESTONE_PHASE_LABELS,
  MILESTONE_STATUS_LABELS,
  type Milestone,
} from "@/lib/domain/types";

const MIN_REASON_LENGTH = 10;

/** 분쟁 상세 — 감사 로그를 근거로 마일스톤을 강제 정산/환불한다 */
function AdminDisputeView() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id") ?? "";
  const { user } = useAuth();
  const project = useProject(projectId);
  const [target, setTarget] = React.useState<{
    milestone: Milestone;
    action: OverrideAction;
  } | null>(null);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  if (user === null || user.role !== "admin") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="py-4 text-center">
          <span className="bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-2xl">
            <ShieldAlert className="size-6" />
          </span>
          <p className="mt-4 font-bold">접근 권한이 없어요</p>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            분쟁 조정은 운영 관리자 전용 기능입니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (project === null) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="py-4 text-center">
          <p className="font-bold">프로젝트를 찾을 수 없어요</p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/admin/disputes">
              <ArrowLeft className="size-4" />
              분쟁 목록으로
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const actor: ActorInfo = { id: user.id, name: user.name, role: user.role };
  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH;

  const execute = async () => {
    if (target === null) return;
    setPending(true);
    try {
      // 실 PG 연동 시 이 호출이 실제 정산/환불 API로 교체된다
      const result =
        target.action === "SETTLE"
          ? await escrowService.settle(target.milestone.id, target.milestone.amount)
          : await escrowService.refund(target.milestone.id, target.milestone.amount);
      if (!result.success) {
        toast.error("정산 게이트웨이 처리에 실패했습니다.");
        return;
      }
      adminOverrideMilestone(
        actor,
        project.id,
        target.milestone.id,
        target.action,
        reason
      );
      toast.success(
        target.action === "SETTLE"
          ? "강제 정산이 실행되고 감사 로그에 기록됐어요."
          : "강제 환불이 실행되고 감사 로그에 기록됐어요."
      );
      setTarget(null);
      setReason("");
    } catch (e) {
      toast.error(e instanceof DomainError ? e.message : "처리에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight">
              {project.title}
            </h2>
            {project.status === "disputed" ? (
              <Badge variant="coral">분쟁 중</Badge>
            ) : (
              <Badge variant="mint">조정 완료</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm font-semibold">
            {project.clientName} ↔ {project.contract?.partnerName}
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/disputes">
            <ArrowLeft className="size-4" />
            목록
          </Link>
        </Button>
      </div>

      {project.disputeReason !== null && (
        <Card className="mt-5 py-5">
          <CardContent className="px-6">
            <p className="text-muted-foreground text-xs font-bold">신고 사유</p>
            <p className="mt-1 text-sm font-semibold">{project.disputeReason}</p>
          </CardContent>
        </Card>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 좌측: 마일스톤 강제 제어 */}
        <Card data-testid="override-panel">
          <CardHeader>
            <CardTitle className="text-lg">마일스톤 강제 제어</CardTitle>
            <p className="text-muted-foreground text-sm font-medium">
              감사 로그를 근거로 판단해 대금을 정산하거나 환불하세요. 조정
              사유는 감사 로그에 영구 보존됩니다.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {project.milestones.map((milestone) => {
              const closed = isMilestoneClosed(milestone.status);
              return (
                <div
                  key={milestone.id}
                  className="bg-muted/60 rounded-2xl p-4"
                  data-testid={`admin-milestone-${milestone.phase}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-extrabold">
                      {MILESTONE_PHASE_LABELS[milestone.phase]}
                    </p>
                    <Badge variant={closed ? "mint" : "secondary"}>
                      {MILESTONE_STATUS_LABELS[milestone.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xl font-extrabold tabular-nums">
                    {formatKrw(milestone.amount)}
                  </p>
                  {!closed && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setReason("");
                          setTarget({ milestone, action: "SETTLE" });
                        }}
                        data-testid={`force-settle-${milestone.phase}`}
                      >
                        <Banknote className="size-4" />
                        강제 정산
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setReason("");
                          setTarget({ milestone, action: "REFUND" });
                        }}
                        data-testid={`force-refund-${milestone.phase}`}
                      >
                        <Undo2 className="size-4" />
                        강제 환불
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 우측: SSOT 감사 로그 타임라인 */}
        <AuditLogList project={project} />
      </div>

      {/* 조정 사유 입력 — 10자 미만이면 실행 불가 */}
      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {target?.action === "SETTLE" ? "강제 정산" : "강제 환불"} 판정
          </DialogTitle>
          <DialogDescription>
            {target !== null
              ? `${MILESTONE_PHASE_LABELS[target.milestone.phase]} · ${formatKrw(target.milestone.amount)}을(를) ${
                  target.action === "SETTLE"
                    ? "개발 파트너에게 정산"
                    : "의뢰자에게 환불"
                }합니다. 이 작업은 되돌릴 수 없습니다.`
              : ""}
          </DialogDescription>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="판정 사유를 구체적으로 입력하세요 (10자 이상)"
            data-testid="override-reason"
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 w-full resize-y rounded-2xl border px-4 py-3 text-sm font-medium outline-none focus-visible:ring-[3px]"
          />
          <Button
            variant={target?.action === "SETTLE" ? "default" : "destructive"}
            disabled={!canSubmit || pending}
            onClick={execute}
            data-testid="override-confirm"
          >
            {!canSubmit
              ? `${MIN_REASON_LENGTH}자 이상 입력해주세요`
              : pending
                ? "처리 중..."
                : "판정 확정하고 실행"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDisputeDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <AdminDisputeView />
    </React.Suspense>
  );
}

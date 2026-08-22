"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { DomainError, raiseDispute, type ActorInfo } from "@/lib/domain/store";
import type { Project } from "@/lib/domain/types";

const MIN_REASON_LENGTH = 10;

/** 계약 당사자가 분쟁을 신고해 운영사 조정을 요청한다 */
export function DisputeButton({
  project,
  actor,
}: {
  project: Project;
  actor: ActorInfo;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  if (project.contract === null || project.status === "disputed") return null;
  const isParty =
    project.clientId === actor.id || project.contract.partnerId === actor.id;
  if (!isParty) return null;

  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH;

  const handleSubmit = () => {
    try {
      raiseDispute(actor, project.id, reason);
      toast.success("분쟁이 접수됐어요. 운영사가 검토 후 조정합니다.");
      setOpen(false);
      setReason("");
    } catch (e) {
      toast.error(e instanceof DomainError ? e.message : "접수에 실패했습니다.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="open-dispute"
      >
        <TriangleAlert className="size-4" />
        분쟁 신고
      </Button>
      <DialogContent>
        <DialogTitle>분쟁 조정 신청</DialogTitle>
        <DialogDescription>
          운영사가 변경 이력(감사 로그)을 근거로 검토한 뒤, 묶여 있는 대금을
          정산하거나 환불해 드립니다.
        </DialogDescription>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="어떤 문제가 있었는지 구체적으로 적어주세요 (10자 이상)"
          data-testid="dispute-reason"
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 w-full resize-y rounded-2xl border px-4 py-3 text-sm font-medium outline-none focus-visible:ring-[3px]"
        />
        <Button
          variant="destructive"
          disabled={!canSubmit}
          onClick={handleSubmit}
          data-testid="submit-dispute"
        >
          {canSubmit
            ? "분쟁 조정 신청하기"
            : `${MIN_REASON_LENGTH}자 이상 입력해주세요`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

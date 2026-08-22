"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DomainError,
  submitBid,
  validateBidItems,
  type ActorInfo,
} from "@/lib/domain/store";
import {
  flattenTasks,
  formatKrw,
  type BidItem,
  type Project,
} from "@/lib/domain/types";

interface DraftItem {
  manDay: string;
  unitPrice: string;
  estimationBasis: string;
}

const EMPTY_DRAFT: DraftItem = { manDay: "", unitPrice: "", estimationBasis: "" };

function toBidItems(draft: Record<string, DraftItem>): Record<string, BidItem> {
  const items: Record<string, BidItem> = {};
  for (const [taskId, value] of Object.entries(draft)) {
    const manDay = Number(value.manDay);
    const unitPrice = Number(value.unitPrice);
    if (Number.isFinite(manDay) && Number.isFinite(unitPrice)) {
      items[taskId] = {
        manDay,
        unitPrice,
        estimationBasis:
          value.estimationBasis.trim() === "" ? null : value.estimationBasis.trim(),
      };
    }
  }
  return items;
}

/**
 * 태스크별 정량 입찰서 작성 폼.
 * 모든 최하위 태스크에 공수(M/D)·단가가 입력돼야 제출이 활성화되고,
 * 입력 즉시 에픽별·전체 합계가 실시간 롤업된다.
 */
export function BidForm({
  project,
  actor,
  onSubmitted,
}: {
  project: Project;
  actor: ActorInfo;
  onSubmitted: () => void;
}) {
  const [draft, setDraft] = React.useState<Record<string, DraftItem>>({});

  const items = toBidItems(draft);
  const { valid, missingCount, totalAmount, totalManDays } = validateBidItems(
    project,
    items
  );

  const update = (taskId: string, field: keyof DraftItem, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] ?? EMPTY_DRAFT), [field]: value },
    }));
  };

  const epicTotals = project.epics.map((epic) => {
    const tasks = epic.features.flatMap((f) => f.tasks);
    let md = 0;
    let amount = 0;
    for (const task of tasks) {
      const item = items[task.id];
      if (item !== undefined && item.manDay > 0 && item.unitPrice > 0) {
        md += item.manDay;
        amount += item.manDay * item.unitPrice;
      }
    }
    return { epic, md, amount };
  });

  const handleSubmit = () => {
    try {
      submitBid(actor, project.id, items);
      toast.success("입찰서가 제출됐어요. 의뢰자의 선정을 기다립니다.");
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof DomainError ? e.message : "제출에 실패했습니다.");
    }
  };

  return (
    <Card data-testid="bid-form">
      <CardHeader>
        <CardTitle className="text-lg">태스크별 정량 입찰서</CardTitle>
        <p className="text-muted-foreground text-sm font-medium">
          모든 태스크에 공수(M/D)와 일일 단가를 입력해야 제출할 수 있어요.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {epicTotals.map(({ epic, md, amount }) => (
          <div key={epic.id} className="bg-muted/60 rounded-2xl p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px] font-bold">{epic.title}</p>
              <p className="text-muted-foreground text-sm font-bold tabular-nums">
                {md} M/D · {formatKrw(amount)}
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {epic.features.flatMap((feature) =>
                feature.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-card flex flex-col gap-2 rounded-xl p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{task.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {feature.title}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Input
                        type="number"
                        min="0.5"
                        step="0.5"
                        placeholder="공수"
                        value={draft[task.id]?.manDay ?? ""}
                        onChange={(e) => update(task.id, "manDay", e.target.value)}
                        className="w-20 text-right tabular-nums"
                        aria-label={`${task.title} 공수`}
                        data-testid={`md-${task.id}`}
                      />
                      <span className="text-muted-foreground text-xs font-bold">
                        M/D ×
                      </span>
                      <Input
                        type="number"
                        min="10000"
                        step="10000"
                        placeholder="일일 단가"
                        value={draft[task.id]?.unitPrice ?? ""}
                        onChange={(e) =>
                          update(task.id, "unitPrice", e.target.value)
                        }
                        className="w-32 text-right tabular-nums"
                        aria-label={`${task.title} 단가`}
                        data-testid={`price-${task.id}`}
                      />
                      <span className="text-muted-foreground text-xs font-bold">
                        원
                      </span>
                    </div>
                    </div>
                    {/* 산정 근거 — 의뢰자 비교 화면에서 호버 툴팁으로 노출된다 */}
                    <textarea
                      value={draft[task.id]?.estimationBasis ?? ""}
                      onChange={(e) =>
                        update(task.id, "estimationBasis", e.target.value)
                      }
                      placeholder="공수 산정 근거 (선택) — 의뢰자가 견적을 이해하는 데 도움이 돼요"
                      rows={2}
                      aria-label={`${task.title} 산정 근거`}
                      data-testid={`basis-${task.id}`}
                      className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 w-full resize-y rounded-xl border px-3 py-2 text-xs font-medium outline-none focus-visible:ring-[3px]"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        ))}

        <div className="bg-foreground text-background flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
          <div>
            <p className="text-xs font-semibold opacity-70">총 입찰 금액</p>
            <p
              className="text-xl font-extrabold tabular-nums"
              data-testid="bid-total"
            >
              {formatKrw(totalAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold opacity-70">총 공수</p>
            <p className="text-xl font-extrabold tabular-nums">
              {totalManDays} M/D
            </p>
          </div>
        </div>

        {!valid && (
          <p className="text-vivid-coral text-sm font-bold" data-testid="bid-warning">
            아직 입력하지 않은 태스크가 {missingCount}개 있어요.
          </p>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!valid}
          size="lg"
          data-testid="bid-submit"
        >
          입찰서 제출하기
        </Button>
      </CardContent>
    </Card>
  );
}

/** 이미 제출한 입찰 요약 */
export function SubmittedBidSummary({ project, partnerId }: { project: Project; partnerId: string }) {
  const bid = project.bids.find((b) => b.partnerId === partnerId);
  if (bid === undefined) return null;
  const taskCount = flattenTasks(project).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">제출한 입찰서</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-2xl font-extrabold tabular-nums">
          {formatKrw(bid.totalAmount)}
        </p>
        <p className="text-muted-foreground text-sm font-medium">
          총 {bid.totalManDays} M/D · 태스크 {taskCount}개 전체 견적 완료 ·{" "}
          {bid.status === "accepted"
            ? "🎉 선정됐어요!"
            : bid.status === "rejected"
              ? "아쉽지만 선정되지 않았어요."
              : "의뢰자 선정을 기다리는 중"}
        </p>
      </CardContent>
    </Card>
  );
}

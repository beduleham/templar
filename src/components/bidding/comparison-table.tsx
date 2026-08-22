"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  acceptBid,
  calcMatchScore,
  DomainError,
  PARTNER_POOL,
  type ActorInfo,
} from "@/lib/domain/store";
import {
  buildBidsComparison,
  buildRadarProfiles,
  DEVIATION_THRESHOLD,
  type DeviationLevel,
} from "@/lib/domain/bid-analytics";
import { formatKrw, type Project } from "@/lib/domain/types";

// Recharts는 브라우저 API에 의존하므로 클라이언트에서만 로드한다
const BidRadarChart = dynamic(() => import("./bid-radar-chart"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted h-[340px] w-full animate-pulse rounded-2xl" />
  ),
});

const MAX_COMPARE = 3;

/** 평균 대비 ±20%를 넘는 셀에 경고/저가 색상을 입힌다 */
const DEVIATION_CLASSES: Record<DeviationLevel, string> = {
  high: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  low: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  normal: "",
};

/**
 * 의뢰자용 정량 비교 대시보드.
 * 요약 메트릭 → 다차원 레이더 → 태스크 단위 편차 매트릭스 순으로 구성된다.
 */
export function ComparisonTable({
  project,
  actor,
}: {
  project: Project;
  actor: ActorInfo;
}) {
  const router = useRouter();
  const allBids = React.useMemo(
    () => project.bids.filter((b) => b.status !== "rejected"),
    [project.bids]
  );
  const [selectedIds, setSelectedIds] = React.useState<string[]>(() =>
    allBids.slice(0, MAX_COMPARE).map((b) => b.id)
  );
  const [highlighted, setHighlighted] = React.useState<string | null>(null);

  const selectedBids = allBids.filter((b) => selectedIds.includes(b.id));
  const comparison = React.useMemo(
    () => buildBidsComparison(project, selectedBids),
    [project, selectedBids]
  );
  const radarProfiles = React.useMemo(
    () => buildRadarProfiles(selectedBids),
    [selectedBids]
  );

  if (allBids.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-center">
          <p className="font-bold">아직 도착한 입찰이 없어요</p>
          <p className="text-muted-foreground mt-1 text-sm">
            개발 파트너들이 스펙을 확인하고 입찰하면 여기에서 비교할 수 있어요.
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggleBid = (bidId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(bidId)) {
        if (prev.length === 1) {
          toast.error("최소 1개 개발사는 선택되어야 해요.");
          return prev;
        }
        return prev.filter((id) => id !== bidId);
      }
      if (prev.length >= MAX_COMPARE) {
        toast.error(`최대 ${MAX_COMPARE}개 개발사까지 비교할 수 있어요.`);
        return prev;
      }
      return [...prev, bidId];
    });
  };

  const matchScoreOf = (partnerId: string): number | null => {
    const profile = PARTNER_POOL.find((p) => p.id === partnerId);
    return profile !== undefined ? calcMatchScore(project, profile) : null;
  };

  const handleAccept = (bidId: string) => {
    try {
      acceptBid(actor, project.id, bidId);
      toast.success("계약이 체결되고 50/30/20 마일스톤이 생성됐어요.");
      router.push(`/projects/view?id=${project.id}`);
    } catch (e) {
      toast.error(e instanceof DomainError ? e.message : "선정에 실패했습니다.");
    }
  };

  const cheapestTotal = Math.min(...comparison.metrics.map((m) => m.totalAmount));

  return (
    <div className="flex flex-col gap-5" data-testid="comparison-table">
      {/* 요약 메트릭 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">입찰 요약</CardTitle>
          <p className="text-muted-foreground text-sm font-medium">
            참여 {allBids.length}곳 · 평균{" "}
            {formatKrw(Math.round(comparison.averageTotalAmount))} · 최저{" "}
            {formatKrw(comparison.minTotalAmount)} ~ 최고{" "}
            {formatKrw(comparison.maxTotalAmount)}
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allBids.map((bid) => {
            const metric = comparison.metrics.find((m) => m.bidId === bid.id);
            const selected = selectedIds.includes(bid.id);
            const score = matchScoreOf(bid.partnerId);
            return (
              <button
                key={bid.id}
                type="button"
                onClick={() => toggleBid(bid.id)}
                onMouseEnter={() => setHighlighted(bid.partnerName)}
                onMouseLeave={() => setHighlighted(null)}
                data-testid={`bid-filter-${bid.partnerId}`}
                className={cn(
                  "rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.98]",
                  selected
                    ? "bg-accent ring-primary/30 ring-2"
                    : "bg-muted/60 hover:bg-muted"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-extrabold">{bid.partnerName}</p>
                  {bid.totalAmount === cheapestTotal && (
                    <Badge variant="mint">최저가</Badge>
                  )}
                  {score !== null && (
                    <Badge variant="purple">적합도 {score}%</Badge>
                  )}
                </div>
                <p className="mt-2 text-lg font-extrabold tabular-nums">
                  {formatKrw(bid.totalAmount)}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs font-semibold tabular-nums">
                  {bid.totalManDays} M/D · 일 평균{" "}
                  {formatKrw(metric?.dailyRate ?? 0)}
                  {metric !== undefined && metric.cheapestTaskCount > 0 && (
                    <> · 최저가 항목 {metric.cheapestTaskCount}개</>
                  )}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* 다차원 레이더 */}
      {radarProfiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">다차원 역량 비교</CardTitle>
            <p className="text-muted-foreground text-sm font-medium">
              비용·일정은 낮을수록 높은 점수로 환산됩니다. 카드나 범례에
              마우스를 올리면 해당 파트너만 강조돼요.
            </p>
          </CardHeader>
          <CardContent>
            <BidRadarChart
              profiles={radarProfiles}
              highlighted={highlighted}
              onHighlight={setHighlighted}
            />
          </CardContent>
        </Card>
      )}

      {/* 태스크 단위 편차 매트릭스 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">태스크별 견적 비교</CardTitle>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
            <span>
              평균 대비 ±{DEVIATION_THRESHOLD}%를 벗어난 견적을 표시했어요.
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-full bg-red-400" />
              과다 청구 의심
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-full bg-blue-400" />
              저가 투찰 주의
            </span>
          </p>
        </CardHeader>
        <CardContent>
          {selectedBids.length < 2 ? (
            <p className="text-muted-foreground bg-muted rounded-2xl p-5 text-center text-sm font-semibold">
              {allBids.length < 2
                ? "비교 분석을 하려면 입찰이 2건 이상 필요해요."
                : "개발사를 2곳 이상 선택하면 편차를 비교할 수 있어요."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="text-muted-foreground min-w-52 pb-3 text-left text-xs font-bold uppercase">
                      태스크
                    </th>
                    <th className="text-muted-foreground min-w-24 pb-3 text-right text-xs font-bold uppercase">
                      평균가
                    </th>
                    {selectedBids.map((bid) => (
                      <th
                        key={bid.id}
                        onMouseEnter={() => setHighlighted(bid.partnerName)}
                        onMouseLeave={() => setHighlighted(null)}
                        className="min-w-36 pb-3 text-right align-top font-bold"
                      >
                        {bid.partnerName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.matrix.map((row, index) => {
                    const prevEpic =
                      index === 0 ? null : comparison.matrix[index - 1].epicTitle;
                    return (
                      <React.Fragment key={row.task.id}>
                        {row.epicTitle !== prevEpic && (
                          <tr>
                            <td
                              colSpan={selectedBids.length + 2}
                              className="bg-muted/60 rounded-lg px-3 py-2 text-[13px] font-bold"
                            >
                              {row.epicTitle}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="border-border border-b py-2.5 pr-3 font-semibold">
                            {row.task.title}
                          </td>
                          <td className="border-border text-muted-foreground border-b py-2.5 text-right text-xs font-semibold tabular-nums">
                            {formatKrw(Math.round(row.averageAmount))}
                          </td>
                          {row.cells.map((cell) => (
                            <td
                              key={cell.bidId}
                              className={cn(
                                "border-border border-b py-2.5 pr-2 text-right tabular-nums transition-opacity",
                                highlighted !== null &&
                                  highlighted !== cell.partnerName &&
                                  "opacity-40"
                              )}
                            >
                              <Tooltip
                                className="justify-end"
                                content={
                                  <span>
                                    <b>{cell.partnerName}</b> ·{" "}
                                    {cell.manDay} M/D ×{" "}
                                    {formatKrw(cell.unitPrice)}
                                    {"\n"}
                                    평균 대비{" "}
                                    {cell.deviationRate >= 0 ? "+" : ""}
                                    {cell.deviationRate.toFixed(1)}% (
                                    {cell.deviationRate >= 0 ? "+" : "−"}
                                    {formatKrw(
                                      Math.abs(
                                        Math.round(
                                          cell.amount - row.averageAmount
                                        )
                                      )
                                    )}
                                    )
                                    {"\n\n"}
                                    {cell.estimationBasis ?? "등록된 산정 근거가 없습니다."}
                                  </span>
                                }
                              >
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold",
                                    DEVIATION_CLASSES[cell.level]
                                  )}
                                >
                                  {cell.level === "high" && (
                                    <ArrowUp className="size-3" />
                                  )}
                                  {cell.level === "low" && (
                                    <ArrowDown className="size-3" />
                                  )}
                                  {cell.manDay} M/D
                                  {cell.estimationBasis !== null && (
                                    <Info className="text-muted-foreground size-3" />
                                  )}
                                </span>
                              </Tooltip>
                              <span className="text-muted-foreground block text-xs">
                                {formatKrw(cell.amount)}
                              </span>
                            </td>
                          ))}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  <tr>
                    <td className="pt-4 text-base font-extrabold">합계</td>
                    <td className="text-muted-foreground pt-4 text-right text-xs font-bold tabular-nums">
                      {formatKrw(Math.round(comparison.averageTotalAmount))}
                    </td>
                    {selectedBids.map((bid) => (
                      <td
                        key={bid.id}
                        className="pt-4 pr-2 text-right text-base font-extrabold tabular-nums"
                      >
                        {formatKrw(bid.totalAmount)}
                        <span className="text-muted-foreground block text-xs font-semibold">
                          {bid.totalManDays} M/D
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 파트너 선정 */}
      {project.status === "bidding" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">파트너 선정</CardTitle>
            <p className="text-muted-foreground text-sm font-medium">
              선정하면 계약이 체결되고 50/30/20 마일스톤이 자동 생성돼요.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {allBids.map((bid) => (
              <Button
                key={bid.id}
                onClick={() => handleAccept(bid.id)}
                data-testid={`accept-${bid.partnerId}`}
              >
                {bid.partnerName}와 계약 · {formatKrw(bid.totalAmount)}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

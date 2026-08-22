"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acceptBid,
  calcMatchScore,
  DomainError,
  PARTNER_POOL,
  type ActorInfo,
} from "@/lib/domain/store";
import { formatKrw, type Project } from "@/lib/domain/types";

/**
 * 의뢰자용 정량 비교 대시보드 —
 * 태스크 트리를 행으로, 각 파트너의 공수·금액을 열로 나란히 비교한다.
 */
export function ComparisonTable({
  project,
  actor,
}: {
  project: Project;
  actor: ActorInfo;
}) {
  const router = useRouter();
  const bids = project.bids.filter((b) => b.status !== "rejected");

  if (bids.length === 0) {
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

  return (
    <Card data-testid="comparison-table">
      <CardHeader>
        <CardTitle className="text-lg">입찰 정량 비교</CardTitle>
        <p className="text-muted-foreground text-sm font-medium">
          태스크 단위로 각 파트너의 공수(M/D)와 금액을 나란히 비교하세요.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="text-muted-foreground sticky left-0 min-w-52 pb-3 text-left text-xs font-bold uppercase">
                  태스크
                </th>
                {bids.map((bid) => {
                  const score = matchScoreOf(bid.partnerId);
                  return (
                    <th key={bid.id} className="min-w-40 pb-3 text-right align-top">
                      <p className="font-bold">{bid.partnerName}</p>
                      {score !== null && (
                        <Badge variant="purple" className="mt-1">
                          매칭 적합도 {score}%
                        </Badge>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {project.epics.map((epic) => (
                <React.Fragment key={epic.id}>
                  <tr>
                    <td
                      colSpan={bids.length + 1}
                      className="bg-muted/60 rounded-lg px-3 py-2 text-[13px] font-bold"
                    >
                      {epic.title}
                    </td>
                  </tr>
                  {epic.features.flatMap((feature) =>
                    feature.tasks.map((task) => (
                      <tr key={task.id} className="border-border border-b">
                        <td className="border-border border-b py-2.5 pr-3 font-semibold">
                          {task.title}
                        </td>
                        {bids.map((bid) => {
                          const item = bid.items[task.id];
                          return (
                            <td
                              key={bid.id}
                              className="border-border border-b py-2.5 text-right tabular-nums"
                            >
                              {item !== undefined ? (
                                <>
                                  <span className="font-bold">
                                    {item.manDay} M/D
                                  </span>
                                  <span className="text-muted-foreground block text-xs">
                                    {formatKrw(item.manDay * item.unitPrice)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </React.Fragment>
              ))}
              <tr>
                <td className="pt-4 text-base font-extrabold">합계</td>
                {bids.map((bid) => (
                  <td
                    key={bid.id}
                    className="pt-4 text-right text-base font-extrabold tabular-nums"
                  >
                    {formatKrw(bid.totalAmount)}
                    <span className="text-muted-foreground block text-xs font-semibold">
                      {bid.totalManDays} M/D
                    </span>
                  </td>
                ))}
              </tr>
              {project.status === "bidding" && (
                <tr>
                  <td />
                  {bids.map((bid) => (
                    <td key={bid.id} className="pt-4 text-right">
                      <Button
                        size="sm"
                        onClick={() => handleAccept(bid.id)}
                        data-testid={`accept-${bid.partnerId}`}
                      >
                        이 파트너와 계약
                      </Button>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

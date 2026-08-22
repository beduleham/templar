"use client";

import * as React from "react";
import { CalendarClock, CreditCard, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { escrowService } from "@/services/escrow";
import {
  applySubscriptionPayment,
  DomainError,
  scheduleSubscriptionCancel,
  type ActorInfo,
} from "@/lib/domain/store";
import {
  AS_STATUS_LABELS,
  AS_TIER_LABELS,
  formatKrw,
  type AsSubscription,
  type AsSubscriptionStatus,
  type Project,
} from "@/lib/domain/types";

const STATUS_VARIANTS: Record<
  AsSubscriptionStatus,
  "default" | "secondary" | "mint" | "coral"
> = {
  active: "mint",
  active_scheduled_cancel: "coral",
  paused: "coral",
  terminated: "secondary",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** 구독 상태 · 다음 결제일 · 결제 이력 · 해지 */
export function SubscriptionStatus({
  project,
  subscription,
  actor,
}: {
  project: Project;
  subscription: AsSubscription;
  actor: ActorInfo;
}) {
  const [pending, setPending] = React.useState(false);
  const isClient = project.clientId === actor.id;

  const handleCancel = () => {
    try {
      scheduleSubscriptionCancel(actor, project.id);
      toast.success(
        "해지가 예약됐어요. 다음 결제일까지는 그대로 이용할 수 있어요."
      );
    } catch (e) {
      toast.error(e instanceof DomainError ? e.message : "처리에 실패했습니다.");
    }
  };

  /** 데모용 정기 결제 시뮬레이션 — 실제로는 PG 웹훅이 이 경로를 호출한다 */
  const handleSimulateBilling = async (success: boolean) => {
    setPending(true);
    try {
      const charge = await escrowService.charge(
        subscription.billingKey,
        subscription.priceMonthly
      );
      applySubscriptionPayment(actor, project.id, {
        success,
        transactionId: charge.transactionId,
        errorMessage: success ? undefined : "카드 한도 초과",
      });
      toast[success ? "success" : "error"](
        success
          ? "정기 결제가 처리됐어요."
          : "정기 결제가 실패해 구독이 일시 중지됐어요."
      );
    } catch (e) {
      toast.error(e instanceof DomainError ? e.message : "처리에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card data-testid="subscription-status">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">
              {AS_TIER_LABELS[subscription.tier]} 요금제
            </CardTitle>
            <Badge variant={STATUS_VARIANTS[subscription.status]}>
              {AS_STATUS_LABELS[subscription.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-3xl font-extrabold tracking-tight tabular-nums">
            {formatKrw(subscription.priceMonthly)}
            <span className="text-muted-foreground ml-1 text-sm font-bold">
              / 월
            </span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="bg-muted flex items-center gap-3 rounded-2xl p-4">
              <CalendarClock className="text-vivid-blue size-5 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs font-semibold">
                  {subscription.status === "active_scheduled_cancel"
                    ? "이용 종료일"
                    : "다음 결제일"}
                </p>
                <p className="text-sm font-bold">
                  {formatDate(subscription.nextBillingDate)}
                </p>
              </div>
            </div>
            <div className="bg-muted flex items-center gap-3 rounded-2xl p-4">
              <CreditCard className="text-vivid-purple size-5 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs font-semibold">
                  결제 수단
                </p>
                <p className="text-sm font-bold">{subscription.cardLabel}</p>
              </div>
            </div>
          </div>

          {subscription.status === "active_scheduled_cancel" && (
            <p className="text-vivid-coral text-sm font-semibold">
              해지가 예약됐어요. {formatDate(subscription.nextBillingDate)}까지
              이용할 수 있어요.
            </p>
          )}
          {subscription.status === "paused" && (
            <p className="text-vivid-coral text-sm font-semibold">
              결제에 실패해 구독이 일시 중지됐어요. 결제 수단을 변경해주세요.
            </p>
          )}

          {isClient && subscription.status === "active" && (
            <Button
              variant="secondary"
              onClick={handleCancel}
              className="self-start"
              data-testid="cancel-subscription"
            >
              구독 해지하기
            </Button>
          )}

          {isClient && subscription.status !== "terminated" && (
            <div className="border-input flex flex-wrap items-center gap-2 rounded-2xl border border-dashed p-3">
              <span className="text-muted-foreground text-xs font-semibold">
                데모: 정기 결제 시뮬레이션
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => handleSimulateBilling(true)}
                data-testid="simulate-billing-success"
              >
                결제 성공
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => handleSimulateBilling(false)}
              >
                결제 실패
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ReceiptText className="text-muted-foreground size-5" />
            결제 이력
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {subscription.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-bold tabular-nums">
                    {formatKrw(payment.amount)}
                  </p>
                  <p className="text-muted-foreground text-xs font-medium">
                    {formatDate(payment.paidAt)} · {payment.transactionId}
                  </p>
                </div>
                <Badge variant={payment.status === "success" ? "mint" : "coral"}>
                  {payment.status === "success"
                    ? "결제 완료"
                    : `실패 · ${payment.errorMessage ?? "사유 미상"}`}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

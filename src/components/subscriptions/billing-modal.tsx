"use client";

import * as React from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { escrowService } from "@/services/escrow";
import {
  AS_TIER_PLANS,
  formatKrw,
  type AsSubscriptionTier,
} from "@/lib/domain/types";

export interface BillingRegistration {
  billingKey: string;
  cardLabel: string;
  transactionId: string;
}

/**
 * 정기 결제 카드 등록 모달.
 * PG사 결제창(빌링키 발급)을 대신하는 Mock 구현으로,
 * 카드번호·CVC는 입력받지도 저장하지도 않고 빌링키만 발급받는다.
 * 실 연동 시 이 모달이 PG SDK 결제창 호출로 교체된다.
 */
export function BillingModal({
  tier,
  open,
  onOpenChange,
  onRegistered,
}: {
  tier: AsSubscriptionTier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: (registration: BillingRegistration) => void;
}) {
  const [pending, setPending] = React.useState(false);
  const plan = AS_TIER_PLANS.find((p) => p.tier === tier);

  const handleRegister = async () => {
    if (plan === undefined) return;
    setPending(true);
    try {
      const billing = await escrowService.issueBillingKey("mock-user-1");
      const charge = await escrowService.charge(
        billing.billingKey,
        plan.priceMonthly
      );
      if (!charge.success) {
        toast.error("결제에 실패했어요. 카드 정보를 확인해주세요.");
        return;
      }
      onRegistered({
        billingKey: billing.billingKey,
        cardLabel: billing.cardLabel,
        transactionId: charge.transactionId,
      });
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>결제 카드 등록</DialogTitle>
        <DialogDescription>
          {plan !== undefined
            ? `${plan.name} 요금제 · 매월 ${formatKrw(plan.priceMonthly)}이 자동 결제됩니다.`
            : ""}
        </DialogDescription>

        <div className="bg-muted flex items-start gap-3 rounded-2xl p-4">
          <ShieldCheck className="text-vivid-mint mt-0.5 size-5 shrink-0" />
          <p className="text-muted-foreground text-xs leading-relaxed font-medium">
            카드번호와 CVC는 아칸에 저장되지 않습니다. 결제사가 발급한 안전한
            결제 키만 보관하며, 언제든 해지할 수 있어요.
          </p>
        </div>

        <div className="border-input flex items-center gap-3 rounded-2xl border border-dashed p-5">
          <CreditCard className="text-muted-foreground size-6" />
          <div>
            <p className="text-sm font-bold">결제사 카드 등록창</p>
            <p className="text-muted-foreground text-xs font-medium">
              데모 환경에서는 테스트 카드로 즉시 등록됩니다.
            </p>
          </div>
        </div>

        <Button
          onClick={handleRegister}
          disabled={pending}
          size="lg"
          data-testid="billing-confirm"
        >
          {pending
            ? "결제 진행 중..."
            : plan !== undefined
              ? `${formatKrw(plan.priceMonthly)} 결제하고 구독 시작`
              : "구독 시작"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

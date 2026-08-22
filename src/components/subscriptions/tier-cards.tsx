"use client";

import { Check, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AS_TIER_PLANS,
  formatKrw,
  type AsSubscriptionTier,
} from "@/lib/domain/types";

const TIER_STYLES: Record<
  AsSubscriptionTier,
  { accent: string; card: string; button: string }
> = {
  light: {
    accent: "text-vivid-mint",
    card: "bg-card",
    button: "bg-vivid-mint text-white hover:opacity-90",
  },
  standard: {
    accent: "text-white",
    card: "from-vivid-blue bg-gradient-to-br to-[#6aa8ff] text-white",
    button: "bg-white text-[#3182f6] hover:opacity-90",
  },
  premium: {
    accent: "text-vivid-purple",
    card: "bg-card",
    button: "bg-vivid-purple text-white hover:opacity-90",
  },
};

/** 3단계 AS 요금제 카드 — 스탠다드를 추천 등급으로 강조한다 */
export function TierCards({
  onSelect,
  currentTier,
}: {
  onSelect: (tier: AsSubscriptionTier) => void;
  currentTier?: AsSubscriptionTier;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {AS_TIER_PLANS.map((plan) => {
        const style = TIER_STYLES[plan.tier];
        const isCurrent = currentTier === plan.tier;
        const isFeatured = plan.tier === "standard";
        return (
          <div
            key={plan.tier}
            className={cn(
              "relative flex flex-col rounded-[28px] p-7 shadow-sm",
              style.card
            )}
            data-testid={`tier-${plan.tier}`}
          >
            {isFeatured && (
              <span className="absolute top-6 right-6 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                가장 많이 선택
              </span>
            )}
            <p
              className={cn(
                "text-sm font-bold",
                isFeatured ? "text-white/80" : "text-muted-foreground"
              )}
            >
              {plan.name}
            </p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">
              {formatKrw(plan.priceMonthly)}
              <span
                className={cn(
                  "ml-1 text-sm font-bold",
                  isFeatured ? "text-white/70" : "text-muted-foreground"
                )}
              >
                / 월
              </span>
            </p>
            <p
              className={cn(
                "mt-2 text-[13px] font-medium",
                isFeatured ? "text-white/80" : "text-muted-foreground"
              )}
            >
              {plan.summary}
            </p>
            <ul className="mt-5 flex flex-1 flex-col gap-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      isFeatured ? "text-white" : style.accent
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isFeatured ? "text-white/90" : ""
                    )}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
            {isCurrent ? (
              <Badge variant="secondary" className="mt-6 self-start">
                현재 구독 중
              </Badge>
            ) : (
              <Button
                className={cn("mt-6 w-full", style.button)}
                onClick={() => onSelect(plan.tier)}
                data-testid={`subscribe-${plan.tier}`}
              >
                <Sparkles className="size-4" />
                {plan.name} 구독하기
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";

import {
  BillingModal,
  type BillingRegistration,
} from "@/components/subscriptions/billing-modal";
import { SubscriptionStatus } from "@/components/subscriptions/subscription-status";
import { TierCards } from "@/components/subscriptions/tier-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { useDomainState } from "@/lib/domain/hooks";
import {
  DomainError,
  startSubscription,
  type ActorInfo,
} from "@/lib/domain/store";
import {
  AS_STATUS_LABELS,
  AS_TIER_LABELS,
  formatKrw,
  type AsSubscriptionTier,
  type Project,
} from "@/lib/domain/types";

/** AS 및 구독 관리 — 계약된 프로젝트의 유지보수 구독 라이프사이클 */
export default function SubscriptionsPage() {
  const { user } = useAuth();
  const { projects } = useDomainState();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    null
  );
  const [pendingTier, setPendingTier] = React.useState<AsSubscriptionTier | null>(
    null
  );
  const [modalOpen, setModalOpen] = React.useState(false);

  if (user === null) return null;
  const actor: ActorInfo = { id: user.id, name: user.name, role: user.role };
  const isPartner = user.role === "partner";

  // 계약이 체결된(=AS 대상) 프로젝트만 노출한다
  const eligible = projects.filter((p) => {
    if (p.contract === null) return false;
    if (user.role === "admin") return true;
    if (isPartner) return p.contract.partnerId === user.id;
    return p.clientId === user.id;
  });

  const activeProject: Project | null =
    eligible.find((p) => p.id === selectedProjectId) ?? eligible[0] ?? null;

  const handleSelectTier = (tier: AsSubscriptionTier) => {
    setPendingTier(tier);
    setModalOpen(true);
  };

  const handleRegistered = (registration: BillingRegistration) => {
    if (activeProject === null || pendingTier === null) return;
    try {
      startSubscription(
        actor,
        activeProject.id,
        pendingTier,
        registration.billingKey,
        registration.cardLabel,
        registration.transactionId
      );
      toast.success(
        `${AS_TIER_LABELS[pendingTier]} 요금제 구독이 시작됐어요.`
      );
    } catch (e) {
      toast.error(e instanceof DomainError ? e.message : "구독에 실패했습니다.");
    } finally {
      setPendingTier(null);
    }
  };

  if (eligible.length === 0) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="py-4 text-center">
          <span className="bg-muted text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-2xl">
            <Wrench className="size-6" />
          </span>
          <p className="mt-4 font-bold">아직 AS 대상 프로젝트가 없어요</p>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            계약이 체결된 프로젝트가 생기면 여기에서 유지보수 구독을 관리할 수
            있어요.
          </p>
          <Button asChild variant="secondary" className="mt-5">
            <Link href="/projects">
              프로젝트 보러 가기
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (activeProject === null) return null;
  const subscription = activeProject.subscription;

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">
          AS 및 구독 관리
        </h2>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          납품 후 1개월 무상 지원이 끝나면 월 구독으로 안정적인 유지보수를
          이어갈 수 있어요.
        </p>
      </div>

      {/* 프로젝트 선택 */}
      {eligible.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {eligible.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setSelectedProjectId(project.id)}
              className={
                project.id === activeProject.id
                  ? "bg-accent text-accent-foreground rounded-full px-4 py-2 text-sm font-bold"
                  : "bg-secondary text-secondary-foreground hover:bg-accent/60 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
              }
            >
              {project.title}
            </button>
          ))}
        </div>
      )}

      <Card className="mt-5 py-5">
        <CardContent className="flex flex-wrap items-center gap-3 px-6">
          <span className="bg-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
            <Wrench className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[17px] font-extrabold">
                {activeProject.title}
              </p>
              {subscription !== null &&
              subscription.status !== "terminated" ? (
                <Badge variant="mint">
                  {AS_TIER_LABELS[subscription.tier]} ·{" "}
                  {AS_STATUS_LABELS[subscription.status]}
                </Badge>
              ) : (
                <Badge variant="secondary">무상 지원 기간</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm font-semibold">
              {activeProject.contract !== null
                ? `${activeProject.contract.partnerName} · ${formatKrw(activeProject.contract.totalAmount)} 계약`
                : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5">
        {subscription !== null && subscription.status !== "terminated" ? (
          <SubscriptionStatus
            project={activeProject}
            subscription={subscription}
            actor={actor}
          />
        ) : isPartner ? (
          <Card>
            <CardContent className="py-4 text-center">
              <p className="font-bold">아직 구독이 시작되지 않았어요</p>
              <p className="text-muted-foreground mt-1 text-sm font-medium">
                의뢰자가 AS 요금제를 선택하면 이곳에서 현황을 볼 수 있어요.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="bg-card mb-5 flex items-start gap-3 rounded-[28px] p-5 shadow-sm">
              <ShieldCheck className="text-vivid-mint mt-0.5 size-5 shrink-0" />
              <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                구독은 언제든 해지할 수 있고, 해지해도 남은 기간은 그대로
                이용할 수 있어요. 카드 정보는 아칸에 저장되지 않습니다.
              </p>
            </div>
            <TierCards onSelect={handleSelectTier} />
          </>
        )}
      </div>

      <BillingModal
        tier={pendingTier}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onRegistered={handleRegistered}
      />
    </div>
  );
}

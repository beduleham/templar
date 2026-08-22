"use client";

import Link from "next/link";
import { ArrowRight, Scale, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { useDomainState } from "@/lib/domain/hooks";
import {
  formatKrw,
  isMilestoneClosed,
  MILESTONE_PHASE_LABELS,
} from "@/lib/domain/types";

/** 운영사 전용 분쟁 프로젝트 목록 */
export default function AdminDisputesPage() {
  const { user } = useAuth();
  const { projects } = useDomainState();

  // 어드민 권한 가드 — Supabase 연동 시 미들웨어의 user_metadata.role 검증으로 이관
  if (user === null || user.role !== "admin") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="py-4 text-center">
          <span className="bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-2xl">
            <ShieldAlert className="size-6" />
          </span>
          <p className="mt-4 font-bold">접근 권한이 없어요</p>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            분쟁 조정은 운영 관리자 전용 기능입니다. 헤더에서 운영 관리자
            모드로 전환해주세요.
          </p>
          <Button asChild variant="secondary" className="mt-5">
            <Link href="/dashboard">대시보드로 돌아가기</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const disputed = projects.filter((p) => p.status === "disputed");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3">
        <span className="bg-vivid-coral flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
          <Scale className="size-5" />
        </span>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">분쟁 조정</h2>
          <p className="text-muted-foreground mt-0.5 text-sm font-medium">
            감사 로그를 근거로 교착된 대금을 정산하거나 환불합니다.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {disputed.length === 0 && (
          <Card>
            <CardContent className="py-4 text-center">
              <p className="font-bold">진행 중인 분쟁이 없어요</p>
              <p className="text-muted-foreground mt-1 text-sm font-medium">
                계약 당사자가 분쟁을 신고하면 여기에 표시됩니다.
              </p>
            </CardContent>
          </Card>
        )}
        {disputed.map((project) => {
          const pending = project.milestones.filter(
            (m) => !isMilestoneClosed(m.status)
          );
          const lockedAmount = pending.reduce((s, m) => s + m.amount, 0);
          return (
            <Card key={project.id} className="py-5">
              <CardContent className="px-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[17px] font-extrabold">
                        {project.title}
                      </p>
                      <Badge variant="coral">분쟁 중</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm font-semibold">
                      {project.clientName} ↔ {project.contract?.partnerName} ·
                      묶인 대금 {formatKrw(lockedAmount)}
                    </p>
                  </div>
                  <Button asChild>
                    <Link
                      href={`/admin/disputes/view?id=${project.id}`}
                      data-testid={`dispute-${project.id}`}
                    >
                      조정하기
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
                {project.disputeReason !== null && (
                  <p className="bg-muted text-muted-foreground mt-4 rounded-2xl p-4 text-sm font-medium">
                    신고 사유: {project.disputeReason}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {pending.map((m) => (
                    <Badge key={m.id} variant="secondary">
                      {MILESTONE_PHASE_LABELS[m.phase]} · {formatKrw(m.amount)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

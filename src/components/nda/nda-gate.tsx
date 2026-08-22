"use client";

import * as React from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { DomainError, signNda } from "@/lib/domain/store";
import type { Project } from "@/lib/domain/types";

const NDA_TEXT = `표준 비밀유지계약서 (NDA)

제1조 (목적) 본 계약은 아칸(Archon) 플랫폼에 등록된 프로젝트의 상세 개발 명세, 시스템 설계도, 개발 태스크 등 일체의 정보(이하 "비밀정보")를 열람함에 있어, 열람자가 준수해야 할 비밀유지 의무를 정합니다.

제2조 (비밀정보의 범위) 비밀정보는 프로젝트 스펙 문서, 아키텍처 다이어그램, 태스크 구조, 예산 및 입찰 정보 등 프로젝트 상세 페이지에서 제공되는 모든 정보를 포함합니다.

제3조 (비밀유지 의무) 열람자는 비밀정보를 오직 본 프로젝트의 입찰 및 수행 목적에만 사용하며, 의뢰자의 사전 서면 동의 없이 제3자에게 공개, 제공, 유출하지 않습니다.

제4조 (의무의 존속) 본 의무는 서명일로부터 3년간 존속하며, 위반 시 열람자는 이로 인해 의뢰자에게 발생한 모든 손해를 배상할 책임을 집니다.

제5조 (전자 서명의 효력) 본 플랫폼에서의 전자 서명은 전자문서 및 전자거래 기본법에 따라 서면 서명과 동일한 효력을 가집니다.`;

/**
 * NDA 서명 게이트.
 * 파트너가 스펙 상세를 열람하기 전 반드시 통과해야 하는 관문 —
 * Supabase 연동 시 nda_signatures 테이블 + projects/tasks RLS 정책으로 강제된다.
 */
export function NdaGate({ project }: { project: Project }) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(user?.name ?? "");
  const [company, setCompany] = React.useState("");
  const [agreed, setAgreed] = React.useState(false);

  const handleSign = () => {
    if (user === null) return;
    if (!agreed) {
      toast.error("비밀유지계약 내용에 동의해주세요.");
      return;
    }
    try {
      signNda(
        { id: user.id, name: user.name, role: user.role },
        project.id,
        name,
        company
      );
      toast.success("NDA 서명이 완료됐어요. 상세 스펙이 열립니다.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof DomainError ? e.message : "서명에 실패했습니다.");
    }
  };

  return (
    <div className="bg-card flex flex-col items-center rounded-[28px] px-6 py-14 text-center shadow-sm">
      <span className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl">
        <Lock className="size-7" />
      </span>
      <h3 className="mt-5 text-xl font-extrabold tracking-tight">
        상세 스펙은 NDA 서명 후 열람할 수 있어요
      </h3>
      <p className="text-muted-foreground mt-2 max-w-md text-sm font-medium">
        의뢰자의 아이디어와 설계도를 보호하기 위해, 열람 전 표준
        비밀유지계약(NDA) 서명이 필요합니다.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mt-6" data-testid="open-nda">
            <ShieldCheck className="size-4" />
            NDA 서명하고 스펙 보기
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>표준 전자 비밀유지계약서</DialogTitle>
          <DialogDescription>
            아래 내용을 확인하고 서명하면 즉시 상세 스펙이 열립니다.
          </DialogDescription>
          <div className="bg-muted max-h-52 overflow-y-auto rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-wrap">
            {NDA_TEXT}
          </div>
          <div className="flex flex-col gap-2.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="서명자 성명 (필수)"
              data-testid="nda-name"
            />
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="회사명 / 소속 (선택)"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="accent-vivid-blue size-4"
                data-testid="nda-agree"
              />
              위 비밀유지계약 내용을 확인했으며 이에 동의합니다.
            </label>
          </div>
          <Button onClick={handleSign} data-testid="nda-sign">
            동의 및 서명 완료
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

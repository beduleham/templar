"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { ArchitectureMap } from "@/components/architecture-map";
import { BidForm, SubmittedBidSummary } from "@/components/bidding/bid-form";
import { ComparisonTable } from "@/components/bidding/comparison-table";
import { NdaGate } from "@/components/nda/nda-gate";
import { MarkdownView } from "@/components/spec/markdown-view";
import { TaskTree } from "@/components/spec/task-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { useProject } from "@/lib/domain/hooks";
import { canViewSpecDetail, type ActorInfo } from "@/lib/domain/store";

/** 프로젝트 입찰 상세 — 파트너: NDA → 스펙 열람 → 입찰 / 의뢰자: 비교·선정 */
export default function BidProjectPage() {
  const params = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const project = useProject(params.projectId);

  if (project === null) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="py-4 text-center">
          <p className="font-bold">프로젝트를 찾을 수 없어요</p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/bids">
              <ArrowLeft className="size-4" />
              입찰 허브로 돌아가기
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (user === null) return null;

  const actor: ActorInfo = { id: user.id, name: user.name, role: user.role };
  const canView = canViewSpecDetail(actor, project);
  const isPartner = user.role === "partner";
  const myBid = project.bids.find((b) => b.partnerId === user.id);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight">
              {project.title}
            </h2>
            {project.status === "bidding" ? (
              <Badge variant="purple">입찰 진행 중</Badge>
            ) : (
              <Badge>계약 체결됨</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {project.summary}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/bids">
              <ArrowLeft className="size-4" />
              목록
            </Link>
          </Button>
          {project.contract !== null && (
            <Button asChild size="sm">
              <Link href={`/projects/${project.id}`}>
                프로젝트 공정판
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {/* 접근 제어: 파트너는 NDA 서명 전 상세 스펙 차단 */}
        {!canView ? (
          <NdaGate project={project} />
        ) : (
          <>
            {!isPartner && <ComparisonTable project={project} actor={actor} />}
            {isPartner &&
              project.status === "bidding" &&
              (myBid !== undefined ? (
                <SubmittedBidSummary project={project} partnerId={user.id} />
              ) : (
                <BidForm
                  project={project}
                  actor={actor}
                  onSubmitted={() => undefined}
                />
              ))}
            {isPartner && project.status !== "bidding" && (
              <SubmittedBidSummary project={project} partnerId={user.id} />
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">상세 개발 명세</CardTitle>
                </CardHeader>
                <CardContent>
                  <MarkdownView markdown={project.specMarkdown} />
                </CardContent>
              </Card>
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">시스템 설계도</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ArchitectureMap mermaidCode={project.mermaidCode} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">개발 태스크</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TaskTree epics={project.epics} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

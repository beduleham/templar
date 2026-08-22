"use client";

import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * AI 스펙 생성 대기 화면.
 * 단계별 메시지 + 결과물 레이아웃을 모방한 특화 스켈레톤으로 체감 대기 시간을 줄인다.
 */
export function GenerationLoading({
  progress,
  message,
}: {
  progress: number;
  message: string;
}) {
  return (
    <div className="mx-auto max-w-6xl" data-testid="generation-loading">
      <div className="flex flex-col items-center text-center">
        <span className="bg-vivid-purple flex size-14 animate-pulse items-center justify-center rounded-2xl text-white shadow-md">
          <Sparkles className="size-7" />
        </span>
        <p
          className="mt-5 text-lg font-extrabold"
          data-testid="generation-stage"
        >
          {message}
        </p>
        <div className="mt-4 flex w-full max-w-md items-center gap-3">
          <Progress value={progress} className="h-2.5" />
          <span
            className="text-muted-foreground w-12 shrink-0 text-right text-sm font-bold tabular-nums"
            data-testid="generation-progress"
          >
            {progress}%
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 아키텍처 다이어그램 모양 스켈레톤 */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3">
              <div className="flex w-full justify-center gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11 flex-1 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-6 w-px" />
              <div className="flex w-full justify-center gap-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-11 flex-1 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-6 w-px" />
              <Skeleton className="h-12 w-2/3 rounded-2xl" />
            </div>
          </CardContent>
        </Card>

        {/* 계층형 태스크 목록 모양 스켈레톤 */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {[0, 1, 2].map((epic) => (
              <div key={epic} className="bg-muted/60 rounded-2xl p-4">
                <Skeleton className="h-4 w-40" />
                <div className="mt-3 flex flex-col gap-2 pl-4">
                  {[0, 1].map((task) => (
                    <div key={task} className="flex items-center gap-2">
                      <Skeleton className="size-2 rounded-full" />
                      <Skeleton className="h-3.5 flex-1" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

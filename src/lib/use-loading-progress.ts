"use client";

import * as React from "react";

/** 스펙 생성 단계 — 각 단계는 진행률 상한을 가진다 */
export interface GenerationStage {
  upTo: number;
  message: string;
}

export const GENERATION_STAGES: GenerationStage[] = [
  { upTo: 25, message: "의뢰인 요구사항 분석 및 핵심 비즈니스 로직 추출 중..." },
  { upTo: 50, message: "시스템 컴포넌트 설계 및 아키텍처 다이어그램 생성 중..." },
  { upTo: 75, message: "개발자가 즉시 실행 가능한 계층적 업무 태스크 분할 중..." },
  { upTo: 95, message: "단일 진실 공급원(SSOT) 스펙 문서 최종 검수 중..." },
];

export const COMPLETE_MESSAGE = "스펙 생성 완료! 화면으로 이동합니다.";

/** 진행률 구간에 해당하는 안내 메시지 */
export function stageMessage(progress: number): string {
  if (progress >= 100) return COMPLETE_MESSAGE;
  const stage = GENERATION_STAGES.find((s) => progress < s.upTo);
  return stage?.message ?? GENERATION_STAGES[GENERATION_STAGES.length - 1].message;
}

const CEILING = 95;

/**
 * 스펙 생성 대기 진행률.
 * 응답이 늦어도 95%에서 멈춰 대기하고, 완료 신호를 받으면 즉시 100%로 도달한다.
 */
export function useLoadingProgress(
  active: boolean,
  done: boolean,
  expectedMs = 5000
): { progress: number; message: string } {
  const [elapsedRatio, setElapsedRatio] = React.useState(0);

  React.useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    // 경과 시간 기준으로 계산해 다시 시작할 때 이전 진행률이 남지 않는다
    const advance = () => {
      setElapsedRatio(Math.min(1, (Date.now() - startedAt) / expectedMs));
    };
    const first = setTimeout(advance, 0);
    const timer = setInterval(advance, 80);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active, expectedMs]);

  // 완료 신호 전까지는 95%에서 멈춰 대기한다
  const progress = !active ? 0 : done ? 100 : elapsedRatio * CEILING;
  return { progress: Math.round(progress), message: stageMessage(progress) };
}

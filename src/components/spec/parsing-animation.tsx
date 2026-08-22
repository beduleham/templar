"use client";

import * as React from "react";
import { CircleCheckBig, FileText } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ParsingLogLine {
  level: "INFO" | "ANALYSIS" | "DETECTED";
  text: string;
}

/** 문서 분석 로그 — 실제 연동 시 스트리밍 응답의 청크로 대체된다 */
export function buildParsingLogs(fileName: string): ParsingLogLine[] {
  return [
    { level: "INFO", text: `'${fileName}' 업로드 완료` },
    { level: "INFO", text: "문서 텍스트 추출 완료" },
    { level: "ANALYSIS", text: "핵심 비즈니스 로직 식별 중" },
    { level: "DETECTED", text: "회원가입 및 로그인 모듈 감지" },
    { level: "DETECTED", text: "결제 및 정산 모듈 감지" },
    { level: "ANALYSIS", text: "화면 흐름과 데이터 구조 매핑 중" },
    { level: "DETECTED", text: "운영자 관리 화면 요구사항 감지" },
    { level: "INFO", text: "스펙 구조화 준비 완료" },
  ];
}

const KEYWORDS = [
  "회원가입",
  "결제 연동",
  "알림 발송",
  "관리자 화면",
  "예약 관리",
  "데이터 저장소",
];

const LEVEL_COLORS: Record<ParsingLogLine["level"], string> = {
  INFO: "text-[#8b95a1]",
  ANALYSIS: "text-[#4593fc]",
  DETECTED: "text-[#10cfb5]",
};

/**
 * 문서 파싱 애니메이션 — 스캔 라인, 터미널 로그 스트리밍, 키워드 플로팅.
 * 대기 시간 동안 시스템이 실제로 일하고 있음을 시각적으로 전달한다.
 */
export function ParsingAnimation({
  fileName,
  progress,
  onDone,
}: {
  fileName: string;
  progress: number;
  onDone?: () => void;
}) {
  const logs = React.useMemo(() => buildParsingLogs(fileName), [fileName]);
  const visibleCount = Math.min(
    logs.length,
    Math.floor((progress / 100) * (logs.length + 1))
  );
  const visibleKeywords = Math.min(
    KEYWORDS.length,
    Math.floor(((progress - 30) / 70) * KEYWORDS.length)
  );
  const complete = progress >= 100;

  React.useEffect(() => {
    if (complete && onDone !== undefined) {
      const timer = setTimeout(onDone, 1200);
      return () => clearTimeout(timer);
    }
  }, [complete, onDone]);

  return (
    <div className="mx-auto max-w-2xl" data-testid="parsing-animation">
      <style>{`
        @keyframes archon-scan {
          0% { top: 4%; }
          50% { top: 92%; }
          100% { top: 4%; }
        }
        .archon-scan-line { animation: archon-scan 2.4s ease-in-out infinite; }
      `}</style>

      <div className="flex flex-col items-center text-center">
        {/* 스캔되는 문서 카드 */}
        <div className="bg-card relative flex h-40 w-32 items-center justify-center overflow-hidden rounded-2xl shadow-sm">
          <FileText className="text-muted-foreground/40 size-14" />
          {!complete && (
            <span className="archon-scan-line bg-vivid-mint absolute left-0 h-0.5 w-full shadow-[0_0_14px_rgba(0,191,165,0.9)]" />
          )}
          {complete && (
            <span className="bg-vivid-mint/10 absolute inset-0 flex items-center justify-center">
              <CircleCheckBig className="text-vivid-mint size-12" />
            </span>
          )}
        </div>

        <p className="mt-5 text-lg font-extrabold">
          {complete ? "분석 완료!" : "AI 분석 엔진 가동 중"}
        </p>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          {fileName}
        </p>

        <div className="mt-4 flex w-full max-w-sm items-center gap-3">
          <Progress value={progress} className="h-2.5" />
          <span className="text-muted-foreground w-12 shrink-0 text-right text-sm font-bold tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>

        {/* 감지된 키워드 */}
        <div className="mt-5 flex min-h-9 flex-wrap justify-center gap-2">
          {KEYWORDS.slice(0, Math.max(0, visibleKeywords)).map((keyword) => (
            <span
              key={keyword}
              className="bg-accent text-accent-foreground animate-in fade-in-0 slide-in-from-bottom-2 rounded-full px-3 py-1 text-xs font-bold duration-300"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      {/* 터미널 로그 */}
      <div
        className="mt-6 h-44 overflow-y-auto rounded-2xl bg-[#101013] p-4 font-mono text-xs leading-relaxed"
        data-testid="parsing-terminal"
      >
        {logs.slice(0, visibleCount).map((log, i) => (
          <p
            key={i}
            className="animate-in fade-in-0 slide-in-from-left-2 duration-200"
          >
            <span className={cn("font-bold", LEVEL_COLORS[log.level])}>
              [{log.level}]
            </span>{" "}
            <span className="text-[#d3d6da]">{log.text}</span>
          </p>
        ))}
        {!complete && <p className="text-[#4593fc]">▋</p>}
      </div>
    </div>
  );
}

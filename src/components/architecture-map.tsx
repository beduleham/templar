"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  injectMermaidStyles,
  type TaskNodeState,
} from "@/lib/domain/mermaid-styler";

interface ArchitectureMapProps {
  mermaidCode: string;
  /** 태스크 상태 — 전달 시 노드 색상이 공정 상태로 칠해진다 */
  nodeStates?: TaskNodeState[];
  className?: string;
}

let renderSeq = 0;

/**
 * Mermaid.js 클라이언트 렌더러.
 * 브라우저 전용 API를 쓰므로 dynamic import로만 로드하고,
 * 문법 오류 시 크래시 대신 원본 코드 Fallback을 보여준다.
 */
export function ArchitectureMap({
  mermaidCode,
  nodeStates,
  className,
}: ArchitectureMapProps) {
  const styledCode = React.useMemo(
    () =>
      nodeStates !== undefined
        ? injectMermaidStyles(mermaidCode, nodeStates)
        : mermaidCode,
    [mermaidCode, nodeStates]
  );
  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "inherit",
        });
        renderSeq += 1;
        const { svg: rendered } = await mermaid.render(
          `archon-diagram-${renderSeq}`,
          styledCode
        );
        if (!cancelled) {
          setSvg(rendered);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setSvg(null);
          setError(true);
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [styledCode]);

  if (error) {
    return (
      <div className={cn("bg-muted rounded-2xl p-4", className)}>
        <p className="text-destructive text-sm font-semibold">
          설계도를 그리는 중 문제가 발생해 원본 코드를 표시합니다.
        </p>
        <pre className="text-muted-foreground mt-3 overflow-x-auto text-xs leading-relaxed">
          {styledCode}
        </pre>
      </div>
    );
  }

  if (svg === null) {
    return (
      <div
        className={cn(
          "bg-muted flex h-64 animate-pulse items-center justify-center rounded-2xl",
          className
        )}
      >
        <span className="text-muted-foreground text-sm font-semibold">
          설계도를 그리는 중...
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full", className)}
      data-testid="architecture-map"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

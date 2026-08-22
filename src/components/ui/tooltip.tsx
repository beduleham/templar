"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 경량 툴팁 — 호버 150ms 딜레이 후 페이드인, 터치 디바이스에서는 탭으로 토글.
 * 외부 의존성 없이 포지셔닝과 접근성만 처리한다.
 */
export function Tooltip({
  content,
  children,
  className,
  delayMs = 150,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  React.useEffect(() => clear, [clear]);

  const show = () => {
    clear();
    timerRef.current = setTimeout(() => setOpen(true), delayMs);
  };
  const hide = () => {
    clear();
    setOpen(false);
  };

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={() => setOpen((prev) => !prev)}
      tabIndex={0}
      role="button"
      aria-describedby={open ? "tooltip" : undefined}
    >
      {children}
      {open && (
        <span
          id="tooltip"
          role="tooltip"
          className="bg-foreground text-background animate-in fade-in-0 zoom-in-95 pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 rounded-xl px-3 py-2 text-left text-xs leading-relaxed font-medium break-words whitespace-pre-wrap shadow-lg duration-150"
        >
          {content}
        </span>
      )}
    </span>
  );
}

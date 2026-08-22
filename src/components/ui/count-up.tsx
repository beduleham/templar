"use client";

import * as React from "react";

/**
 * 금액 카운트업 애니메이션.
 * 값이 바뀔 때마다 이전 값에서 새 값까지 부드럽게 증가하며,
 * 모션 감소 설정에서는 즉시 최종값을 보여준다.
 */
export function CountUp({
  value,
  format,
  durationMs = 900,
  className,
}: {
  value: number;
  format: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(value);
  const fromRef = React.useRef(value);

  React.useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      fromRef.current = value;
      const immediate = setTimeout(() => setDisplay(value), 0);
      return () => clearTimeout(immediate);
    }

    const startedAt = Date.now();
    const tick = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      // easeOutCubic — 끝에서 부드럽게 멈춘다
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress >= 1) {
        fromRef.current = value;
        clearInterval(timer);
      }
    };
    const timer = setInterval(tick, 40);
    return () => clearInterval(timer);
  }, [value, durationMs]);

  return (
    <span className={className} data-testid="count-up">
      {format(display)}
    </span>
  );
}

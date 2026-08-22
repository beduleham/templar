"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 스크롤 진입 시 한 번만 페이드업시키는 래퍼.
 * React state 대신 DOM data 속성을 직접 토글해 리렌더를 만들지 않는다.
 * IntersectionObserver가 없는 환경(구형 브라우저)에서는 즉시 노출한다.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.shown = "true";
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.dataset.shown = "true";
            observer.unobserve(el);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>}
      data-shown="false"
      className={cn("archon-reveal", className)}
      style={{ transitionDelay: `${String(delay)}ms` }}
    >
      {children}
    </Tag>
  );
}

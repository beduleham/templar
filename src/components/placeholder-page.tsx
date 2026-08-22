import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import type { VividTone } from "@/lib/navigation";

const TONE_STYLES: Record<VividTone, string> = {
  blue: "bg-vivid-blue",
  purple: "bg-vivid-purple",
  mint: "bg-vivid-mint",
  coral: "bg-vivid-coral",
  slate: "bg-muted-foreground",
};

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone: VividTone;
}

/** 라우팅 골격 단계에서 사용하는 준비 중 카드 UI */
export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  tone,
}: PlaceholderPageProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="bg-card text-card-foreground rounded-[28px] p-8 shadow-sm lg:p-10">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-2xl text-white shadow-md",
            TONE_STYLES[tone]
          )}
        >
          <Icon className="size-6" />
        </span>
        <h2 className="mt-5 text-2xl font-extrabold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-2.5 text-[15px] leading-relaxed font-medium">
          {description}
        </p>
        <div className="bg-muted text-muted-foreground mt-8 rounded-2xl p-6 text-center text-sm font-semibold">
          준비 중인 페이지입니다.
        </div>
      </div>
    </div>
  );
}

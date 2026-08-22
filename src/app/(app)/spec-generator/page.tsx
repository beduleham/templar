import type { Metadata } from "next";

import { Sparkles } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "AI 스펙 생성" };

export default function SpecGeneratorPage() {
  return (
    <PlaceholderPage
      title="AI 스펙 생성"
      description="10~15분 대화형 질의응답 또는 기획 초안 업로드로 상세 스펙과 시스템 설계도를 자동 생성합니다."
      icon={Sparkles}
      tone="purple"
    />
  );
}

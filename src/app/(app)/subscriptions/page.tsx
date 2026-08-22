import type { Metadata } from "next";

import { Wrench } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "AS 및 구독 관리" };

export default function SubscriptionsPage() {
  return (
    <PlaceholderPage
      title="AS 및 구독 관리"
      description="납품 후 무상 유지보수 티켓과 월 정기 구독형 AS 서비스를 관리하는 화면입니다."
      icon={Wrench}
      tone="slate"
    />
  );
}

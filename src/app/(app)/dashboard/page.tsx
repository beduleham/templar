import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "대시보드" };

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="대시보드"
      description="진행 중인 프로젝트, 입찰 현황, 공정률을 한눈에 확인하는 홈 화면입니다."
    />
  );
}

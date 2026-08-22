import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "프로젝트 공정판" };

export default function ProjectsPage() {
  return (
    <PlaceholderPage
      title="프로젝트 공정판"
      description="칸반 보드와 시스템 설계도가 실시간으로 연동되어 개발 진행 상황을 색상으로 보여주는 공정 관리 화면입니다."
    />
  );
}

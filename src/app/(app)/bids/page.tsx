import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "입찰 및 계약" };

export default function BidsPage() {
  return (
    <PlaceholderPage
      title="입찰 및 계약"
      description="확정된 스펙을 기준으로 개발팀의 견적을 항목별로 비교하고 계약을 체결하는 허브입니다."
    />
  );
}

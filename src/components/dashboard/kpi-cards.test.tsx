import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildKpiItems, KpiCards } from "@/components/dashboard/kpi-cards";
import type { DashboardMetrics } from "@/lib/dashboard";

const METRICS: DashboardMetrics = {
  activeProjects: 2,
  totalAmount: 45_000_000,
  progressOrTasks: 53,
};

afterEach(cleanup);

describe("buildKpiItems", () => {
  it("client 역할은 총 예치 금액과 평균 공정률을 노출한다", () => {
    const labels = buildKpiItems("client", METRICS).map((i) => i.label);
    expect(labels).toEqual([
      "진행 중인 프로젝트",
      "총 예치 금액",
      "평균 공정률",
    ]);
  });

  it("partner 역할은 정산 예정 금액과 완료된 태스크를 노출한다", () => {
    const labels = buildKpiItems("partner", METRICS).map((i) => i.label);
    expect(labels).toEqual([
      "진행 중인 프로젝트",
      "정산 예정 금액",
      "완료된 태스크",
    ]);
  });
});

describe("KpiCards", () => {
  it("client 역할로 렌더링하면 원화 포맷 금액이 표시된다", () => {
    render(<KpiCards role="client" metrics={METRICS} />);
    expect(screen.getByText("총 예치 금액")).toBeDefined();
    expect(screen.getByText("₩45,000,000")).toBeDefined();
    expect(screen.getByText("53%")).toBeDefined();
  });

  it("partner 역할로 렌더링하면 완료된 태스크 수가 표시된다", () => {
    render(<KpiCards role="partner" metrics={METRICS} />);
    expect(screen.getByText("정산 예정 금액")).toBeDefined();
    expect(screen.getByText("53개")).toBeDefined();
    expect(screen.queryByText("평균 공정률")).toBeNull();
  });
});

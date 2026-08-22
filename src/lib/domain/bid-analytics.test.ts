import { beforeEach, describe, expect, it } from "vitest";

import {
  buildBidsComparison,
  buildRadarProfiles,
  calculateDeviation,
  deviationLevel,
  toRadarChartData,
} from "@/lib/domain/bid-analytics";
import { domainStore } from "@/lib/domain/store";
import { flattenTasks, type Project } from "@/lib/domain/types";

function careProject(): Project {
  const project = domainStore
    .getSnapshot()
    .projects.find((p) => p.id === "prj-care");
  if (project === undefined) throw new Error("seed missing");
  return project;
}

beforeEach(() => {
  domainStore.reset();
});

describe("calculateDeviation", () => {
  it("평균 100, 입력 120이면 +20%", () => {
    expect(calculateDeviation(120, 100)).toBeCloseTo(20, 5);
  });

  it("평균 100, 입력 150이면 +50%", () => {
    expect(calculateDeviation(150, 100)).toBeCloseTo(50, 5);
  });

  it("평균 100, 입력 70이면 -30%", () => {
    expect(calculateDeviation(70, 100)).toBeCloseTo(-30, 5);
  });

  it("평균이 0이면 편차 0으로 처리한다", () => {
    expect(calculateDeviation(50, 0)).toBe(0);
  });
});

describe("deviationLevel", () => {
  it("경계값 +20%는 고편차로 판정한다", () => {
    expect(deviationLevel(20)).toBe("high");
  });

  it("경계값 -20%는 저편차로 판정한다", () => {
    expect(deviationLevel(-20)).toBe("low");
  });

  it("±20% 이내는 정상으로 판정한다", () => {
    expect(deviationLevel(19.9)).toBe("normal");
    expect(deviationLevel(-19.9)).toBe("normal");
  });
});

describe("buildBidsComparison", () => {
  it("태스크별 평균가와 편차를 계산한다", () => {
    const project = careProject();
    const comparison = buildBidsComparison(project, project.bids);
    expect(comparison.bidCount).toBe(2);
    expect(comparison.matrix).toHaveLength(flattenTasks(project).length);

    const firstRow = comparison.matrix[0];
    const average =
      firstRow.cells.reduce((s, c) => s + c.amount, 0) / firstRow.cells.length;
    expect(firstRow.averageAmount).toBeCloseTo(average, 5);
    // 두 입찰의 편차는 평균 기준으로 서로 반대 부호를 갖는다
    const [a, b] = firstRow.cells;
    expect(Math.sign(a.deviationRate)).toBe(-Math.sign(b.deviationRate));
  });

  it("총액 요약과 일 평균 단가를 산출한다", () => {
    const project = careProject();
    const comparison = buildBidsComparison(project, project.bids);
    const totals = project.bids.map((b) => b.totalAmount);
    expect(comparison.minTotalAmount).toBe(Math.min(...totals));
    expect(comparison.maxTotalAmount).toBe(Math.max(...totals));
    for (const metric of comparison.metrics) {
      const bid = project.bids.find((b) => b.id === metric.bidId);
      if (bid === undefined) throw new Error("bid missing");
      expect(metric.dailyRate).toBe(
        Math.round(bid.totalAmount / bid.totalManDays)
      );
    }
  });

  it("산정 근거가 셀에 함께 전달된다", () => {
    const project = careProject();
    const comparison = buildBidsComparison(project, project.bids);
    const withBasis = comparison.matrix
      .flatMap((row) => row.cells)
      .filter((cell) => cell.estimationBasis !== null);
    expect(withBasis.length).toBeGreaterThan(0);
  });
});

describe("buildRadarProfiles", () => {
  it("비용이 낮은 입찰이 더 높은 비용 점수를 받는다", () => {
    const project = careProject();
    const profiles = buildRadarProfiles(project.bids);
    const sortedByAmount = [...profiles].sort(
      (a, b) => a.raw.totalAmount - b.raw.totalAmount
    );
    expect(sortedByAmount[0].scores.cost).toBeGreaterThan(
      sortedByAmount[sortedByAmount.length - 1].scores.cost
    );
  });

  it("5개 축 데이터를 파트너별 키로 변환한다", () => {
    const project = careProject();
    const profiles = buildRadarProfiles(project.bids);
    const data = toRadarChartData(profiles);
    expect(data).toHaveLength(5);
    for (const point of data) {
      for (const profile of profiles) {
        expect(typeof point[profile.partnerName]).toBe("number");
      }
    }
  });

  it("입찰이 없으면 빈 배열을 반환한다", () => {
    expect(buildRadarProfiles([])).toEqual([]);
  });
});

import {
  flattenTasks,
  type Bid,
  type Project,
  type SpecTask,
} from "@/lib/domain/types";

/* ------------------------------------------------------------------ */
/* 태스크별 편차 분석 (견적 하이라이트)                                  */
/* ------------------------------------------------------------------ */

/** 평균가 대비 편차 등급 — ±20%를 경계로 판정한다 */
export type DeviationLevel = "high" | "low" | "normal";

export const DEVIATION_THRESHOLD = 20;

export function deviationLevel(deviationRate: number): DeviationLevel {
  if (deviationRate >= DEVIATION_THRESHOLD) return "high";
  if (deviationRate <= -DEVIATION_THRESHOLD) return "low";
  return "normal";
}

/** 평균가 대비 편차율(%) — 평균이 0이면 편차 없음으로 본다 */
export function calculateDeviation(
  amount: number,
  averageAmount: number
): number {
  if (averageAmount === 0) return 0;
  return ((amount - averageAmount) / averageAmount) * 100;
}

export interface TaskBidCell {
  bidId: string;
  partnerId: string;
  partnerName: string;
  manDay: number;
  unitPrice: number;
  amount: number;
  deviationRate: number;
  level: DeviationLevel;
  estimationBasis: string | null;
}

export interface TaskBidComparison {
  task: SpecTask;
  epicTitle: string;
  averageAmount: number;
  cells: TaskBidCell[];
}

export interface BidSummaryMetric {
  bidId: string;
  partnerId: string;
  partnerName: string;
  totalAmount: number;
  totalManDays: number;
  /** 평균 일일 단가 = 총액 / 총 공수 */
  dailyRate: number;
  /** 이 입찰이 가장 저렴한 태스크 수 */
  cheapestTaskCount: number;
}

export interface ProjectBidsComparison {
  bidCount: number;
  averageTotalAmount: number;
  minTotalAmount: number;
  maxTotalAmount: number;
  metrics: BidSummaryMetric[];
  matrix: TaskBidComparison[];
}

/**
 * 태스크 단위 비교 매트릭스를 만든다.
 * 각 셀은 평균가 대비 편차율과 하이라이트 등급을 함께 가진다.
 */
export function buildBidsComparison(
  project: Project,
  bids: Bid[]
): ProjectBidsComparison {
  const epicOf = new Map<string, string>();
  for (const epic of project.epics) {
    for (const feature of epic.features) {
      for (const task of feature.tasks) {
        epicOf.set(task.id, epic.title);
      }
    }
  }

  const cheapestCount = new Map<string, number>();
  const matrix: TaskBidComparison[] = flattenTasks(project).map((task) => {
    const cells: TaskBidCell[] = bids.map((bid) => {
      const item = bid.items[task.id];
      const manDay = item?.manDay ?? 0;
      const unitPrice = item?.unitPrice ?? 0;
      return {
        bidId: bid.id,
        partnerId: bid.partnerId,
        partnerName: bid.partnerName,
        manDay,
        unitPrice,
        amount: manDay * unitPrice,
        deviationRate: 0,
        level: "normal",
        estimationBasis: item?.estimationBasis ?? null,
      };
    });

    const priced = cells.filter((c) => c.amount > 0);
    const averageAmount =
      priced.length === 0
        ? 0
        : priced.reduce((s, c) => s + c.amount, 0) / priced.length;

    for (const cell of cells) {
      cell.deviationRate = calculateDeviation(cell.amount, averageAmount);
      cell.level =
        cell.amount === 0 ? "normal" : deviationLevel(cell.deviationRate);
    }

    if (priced.length > 1) {
      const cheapest = priced.reduce((a, b) => (b.amount < a.amount ? b : a));
      cheapestCount.set(
        cheapest.bidId,
        (cheapestCount.get(cheapest.bidId) ?? 0) + 1
      );
    }

    return {
      task,
      epicTitle: epicOf.get(task.id) ?? "",
      averageAmount,
      cells,
    };
  });

  const totals = bids.map((b) => b.totalAmount);
  const metrics: BidSummaryMetric[] = bids.map((bid) => ({
    bidId: bid.id,
    partnerId: bid.partnerId,
    partnerName: bid.partnerName,
    totalAmount: bid.totalAmount,
    totalManDays: bid.totalManDays,
    dailyRate:
      bid.totalManDays === 0
        ? 0
        : Math.round(bid.totalAmount / bid.totalManDays),
    cheapestTaskCount: cheapestCount.get(bid.id) ?? 0,
  }));

  return {
    bidCount: bids.length,
    averageTotalAmount:
      totals.length === 0 ? 0 : totals.reduce((s, t) => s + t, 0) / totals.length,
    minTotalAmount: totals.length === 0 ? 0 : Math.min(...totals),
    maxTotalAmount: totals.length === 0 ? 0 : Math.max(...totals),
    metrics,
    matrix,
  };
}

/* ------------------------------------------------------------------ */
/* 다차원 레이더 점수                                                   */
/* ------------------------------------------------------------------ */

export const RADAR_AXES = [
  { key: "cost", label: "비용 합리성" },
  { key: "schedule", label: "일정 적정성" },
  { key: "tech", label: "기술 역량" },
  { key: "comm", label: "소통 능력" },
  { key: "portfolio", label: "포트폴리오" },
] as const;

export type RadarAxisKey = (typeof RADAR_AXES)[number]["key"];

export interface PartnerRadarProfile {
  bidId: string;
  partnerId: string;
  partnerName: string;
  color: string;
  scores: Record<RadarAxisKey, number>;
  raw: { totalAmount: number; totalManDays: number };
}

/** 레이더 차트 시리즈 색상 — 비비드 팔레트와 맞춘 3색 */
export const RADAR_COLORS = ["#3182f6", "#00bfa5", "#ff6b6b"];

/**
 * 비용·일정은 낮을수록 우수하므로 역산 정규화한다.
 * 입찰이 하나뿐이면 상대 비교가 불가능해 기준점 80점을 준다.
 */
function invertNormalize(value: number, min: number, max: number): number {
  if (max === min) return 80;
  return Math.round(100 - ((value - min) / (max - min)) * 60);
}

export function buildRadarProfiles(bids: Bid[]): PartnerRadarProfile[] {
  if (bids.length === 0) return [];
  const amounts = bids.map((b) => b.totalAmount);
  const manDays = bids.map((b) => b.totalManDays);
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  const minMd = Math.min(...manDays);
  const maxMd = Math.max(...manDays);

  return bids.map((bid, index) => ({
    bidId: bid.id,
    partnerId: bid.partnerId,
    partnerName: bid.partnerName,
    color: RADAR_COLORS[index % RADAR_COLORS.length],
    scores: {
      cost: invertNormalize(bid.totalAmount, minAmount, maxAmount),
      schedule: invertNormalize(bid.totalManDays, minMd, maxMd),
      tech: bid.scores.techScore,
      comm: bid.scores.commScore,
      portfolio: bid.scores.portfolioScore,
    },
    raw: { totalAmount: bid.totalAmount, totalManDays: bid.totalManDays },
  }));
}

export interface RadarDataPoint {
  subject: string;
  [partnerName: string]: string | number;
}

/** Recharts가 요구하는 축 기준 배열로 변환 */
export function toRadarChartData(
  profiles: PartnerRadarProfile[]
): RadarDataPoint[] {
  return RADAR_AXES.map((axis) => {
    const point: RadarDataPoint = { subject: axis.label };
    for (const profile of profiles) {
      point[profile.partnerName] = profile.scores[axis.key];
    }
    return point;
  });
}

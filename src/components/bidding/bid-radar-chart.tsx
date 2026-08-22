"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  toRadarChartData,
  type PartnerRadarProfile,
} from "@/lib/domain/bid-analytics";

/**
 * 다차원 역량 레이더 차트.
 * 비용·일정은 낮을수록 높은 점수로 역산 정규화되어 면적이 클수록 유리하다.
 * 범례에 호버하면 해당 파트너만 강조된다.
 */
export default function BidRadarChart({
  profiles,
  highlighted,
  onHighlight,
}: {
  profiles: PartnerRadarProfile[];
  highlighted: string | null;
  onHighlight: (partnerName: string | null) => void;
}) {
  const data = toRadarChartData(profiles);

  return (
    <div className="h-[340px] w-full" data-testid="radar-chart">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontWeight: 600 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          {profiles.map((profile) => {
            const dimmed = highlighted !== null && highlighted !== profile.partnerName;
            return (
              <Radar
                key={profile.bidId}
                name={profile.partnerName}
                dataKey={profile.partnerName}
                stroke={profile.color}
                fill={profile.color}
                strokeWidth={highlighted === profile.partnerName ? 3 : 1.5}
                fillOpacity={dimmed ? 0.04 : 0.22}
                strokeOpacity={dimmed ? 0.25 : 1}
                isAnimationActive={false}
              />
            );
          })}
          <Tooltip
            contentStyle={{
              borderRadius: 16,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
              fontWeight: 600,
            }}
            formatter={(value, name) => [`${String(value)}점`, String(name)]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, fontWeight: 700 }}
            onMouseEnter={(entry) => onHighlight(String(entry.value))}
            onMouseLeave={() => onHighlight(null)}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

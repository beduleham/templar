/**
 * 랜딩 히어로의 제품 프리뷰.
 * 실제 제품의 핵심(설계도 노드 상태 ↔ 공정 현황 ↔ 에스크로 단계)을
 * 브라우저 목업 안에서 CSS 애니메이션만으로 재현한다. 자바스크립트가 필요 없어
 * 정적 내보내기에서도 첫 페인트에 바로 움직인다.
 */

const NODES = [
  { id: "n1", x: 110, y: 10, w: 100, label: "사용자 앱", delay: 0 },
  { id: "n2", x: 8, y: 88, w: 92, label: "인증", delay: 1.1 },
  { id: "n3", x: 114, y: 88, w: 92, label: "예약", delay: 2.2 },
  { id: "n4", x: 220, y: 88, w: 92, label: "결제", delay: 3.3 },
  { id: "n5", x: 110, y: 166, w: 100, label: "데이터베이스", delay: 4.4 },
] as const;

const EDGES = [
  "M160 44 V 66 H 54 V 88",
  "M160 44 V 88",
  "M160 44 V 66 H 266 V 88",
  "M54 122 V 144 H 160 V 166",
  "M160 122 V 166",
  "M266 122 V 144 H 160 V 166",
] as const;

const TASKS = [
  { name: "설계도 확정", state: "완료", tone: "mint" },
  { name: "예약 API 개발", state: "진행 중", tone: "blue" },
  { name: "결제 연동", state: "대기", tone: "muted" },
] as const;

const TONE_CLASS: Record<(typeof TASKS)[number]["tone"], string> = {
  mint: "bg-vivid-mint/12 text-[#04836f]",
  blue: "bg-vivid-blue/12 text-vivid-blue",
  muted: "bg-muted text-muted-foreground",
};

export function HeroPreview() {
  return (
    <div className="archon-preview bg-card/85 ring-foreground/5 rounded-[26px] p-2.5 shadow-[0_28px_80px_-24px_rgba(25,31,40,0.28)] ring-1 backdrop-blur-xl">
      {/* 브라우저 크롬 */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="bg-vivid-coral/70 size-2.5 rounded-full" />
        <span className="size-2.5 rounded-full bg-[#ffd23f]/80" />
        <span className="bg-vivid-mint/70 size-2.5 rounded-full" />
        <div className="bg-muted text-muted-foreground mx-auto rounded-full px-4 py-1 text-[11px] font-semibold">
          archon.app / 펫케어 예약 플랫폼
        </div>
      </div>

      <div className="bg-background grid grid-cols-1 gap-3 rounded-[20px] p-3 lg:grid-cols-[1.35fr_1fr]">
        {/* 좌: 시스템 설계도 — 개발이 끝난 노드부터 순서대로 점등된다 */}
        <div className="bg-card rounded-[16px] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold">시스템 설계도</span>
            <span className="text-muted-foreground text-[10px] font-semibold">
              자동 생성됨
            </span>
          </div>
          <svg
            viewBox="0 0 320 210"
            className="mt-2 w-full"
            role="img"
            aria-label="사용자 앱에서 인증·예약·결제를 거쳐 데이터베이스로 이어지는 시스템 설계도. 개발이 완료된 구성요소부터 순서대로 색이 채워집니다."
          >
            {EDGES.map((d, index) => (
              <path
                key={d}
                d={d}
                fill="none"
                stroke="#d7dce1"
                strokeWidth={1.5}
                strokeDasharray="4 5"
                strokeLinecap="round"
                style={{
                  animation: `archon-flow 1.6s linear infinite`,
                  animationDelay: `${String(index * 0.12)}s`,
                }}
              />
            ))}
            {NODES.map((node) => (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={34}
                  rx={11}
                  fill="#e5e8eb"
                  stroke="#d7dce1"
                  strokeWidth={1.5}
                  style={{
                    animation: `archon-node 9s ease-in-out infinite`,
                    animationDelay: `${String(node.delay)}s`,
                  }}
                />
                <text
                  x={node.x + node.w / 2}
                  y={node.y + 22}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={700}
                  fill="#8b95a1"
                  style={{
                    animation: `archon-node-label 9s ease-in-out infinite`,
                    animationDelay: `${String(node.delay)}s`,
                  }}
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* 우: 공정 현황 + 에스크로 단계 */}
        <div className="flex flex-col gap-3">
          <div className="bg-card rounded-[16px] p-4">
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-1.5">
                <span
                  className="bg-vivid-mint absolute inset-0 rounded-full"
                  style={{ animation: "archon-ping 2s ease-out infinite" }}
                />
                <span className="bg-vivid-mint relative size-1.5 rounded-full" />
              </span>
              <span className="text-[11px] font-bold">실시간 공정</span>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {TASKS.map((task) => (
                <li
                  key={task.name}
                  className="bg-background flex items-center justify-between rounded-xl px-2.5 py-2"
                >
                  <span className="text-[11px] font-semibold">{task.name}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${TONE_CLASS[task.tone]}`}
                  >
                    {task.state}
                  </span>
                </li>
              ))}
            </ul>
            <div className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="from-vivid-blue to-vivid-purple h-full rounded-full bg-gradient-to-r"
                style={{ animation: "archon-sweep 9s ease-in-out infinite" }}
              />
            </div>
          </div>

          <div className="bg-card rounded-[16px] p-4">
            <span className="text-[11px] font-bold">에스크로 보관</span>
            <div className="mt-2.5 flex gap-1.5">
              {[
                ["50%", true],
                ["30%", true],
                ["20%", false],
              ].map(([pct, released]) => (
                <div
                  key={String(pct)}
                  className={`flex-1 rounded-xl py-2 text-center text-[11px] font-extrabold tabular-nums ${
                    released === true
                      ? "bg-vivid-mint/12 text-[#04836f]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {pct}
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-[10px] font-semibold">
              검수 승인 시에만 단계별로 지급됩니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * 마일스톤 정산 완료 축하 이펙트.
 * canvas-confetti를 동적 로드하고, 모션 감소 설정을 존중해 조용히 건너뛴다.
 */
export async function celebrateSettlement(): Promise<void> {
  if (typeof window === "undefined") return;
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (prefersReduced) return;

  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#3182f6", "#7c5cfc", "#00bfa5", "#ff6b6b", "#ffffff"];

  // 중앙에서 한 번 크게, 이어서 좌우 하단에서 뿜어져 나오도록 2.5초간 연출한다
  confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 }, colors });

  const end = Date.now() + 2000;
  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.9 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.9 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

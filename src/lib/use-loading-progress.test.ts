import { describe, expect, it } from "vitest";

import {
  COMPLETE_MESSAGE,
  GENERATION_STAGES,
  stageMessage,
} from "@/lib/use-loading-progress";

describe("stageMessage", () => {
  it("진행률 구간마다 정의된 4단계 메시지를 돌려준다", () => {
    expect(stageMessage(0)).toBe(GENERATION_STAGES[0].message);
    expect(stageMessage(24)).toBe(GENERATION_STAGES[0].message);
    expect(stageMessage(25)).toBe(GENERATION_STAGES[1].message);
    expect(stageMessage(49)).toBe(GENERATION_STAGES[1].message);
    expect(stageMessage(50)).toBe(GENERATION_STAGES[2].message);
    expect(stageMessage(74)).toBe(GENERATION_STAGES[2].message);
    expect(stageMessage(75)).toBe(GENERATION_STAGES[3].message);
    expect(stageMessage(94)).toBe(GENERATION_STAGES[3].message);
  });

  it("95% 이상 대기 구간에서도 마지막 단계 메시지를 유지한다", () => {
    expect(stageMessage(95)).toBe(GENERATION_STAGES[3].message);
    expect(stageMessage(99)).toBe(GENERATION_STAGES[3].message);
  });

  it("100%에 도달하면 완료 메시지로 바뀐다", () => {
    expect(stageMessage(100)).toBe(COMPLETE_MESSAGE);
  });
});

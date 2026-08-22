import { beforeEach, describe, expect, it } from "vitest";

import { injectMermaidStyles } from "@/lib/domain/mermaid-styler";
import {
  acceptBid,
  approveInspection,
  canViewSpecDetail,
  depositEscrow,
  DomainError,
  domainStore,
  requestInspection,
  signNda,
  submitBid,
  updateTaskStatus,
  validateBidItems,
  type ActorInfo,
} from "@/lib/domain/store";
import {
  calcProgressRate,
  flattenTasks,
  splitMilestoneAmounts,
  type Project,
} from "@/lib/domain/types";

const CLIENT: ActorInfo = { id: "mock-user-1", name: "김아칸", role: "client" };
const PARTNER: ActorInfo = { id: "partner-x", name: "테스트파트너", role: "partner" };

function careProject(): Project {
  const project = domainStore
    .getSnapshot()
    .projects.find((p) => p.id === "prj-care");
  if (project === undefined) throw new Error("seed missing");
  return project;
}

function fullItems(project: Project) {
  return Object.fromEntries(
    flattenTasks(project).map((t) => [
      t.id,
      { manDay: 2, unitPrice: 500_000, estimationBasis: null },
    ])
  );
}

beforeEach(() => {
  domainStore.reset();
});

describe("splitMilestoneAmounts", () => {
  it("50/30/20으로 분할되고 합이 총액과 일치한다", () => {
    const amounts = splitMilestoneAmounts(10_000_000);
    expect(amounts[1]).toBe(5_000_000);
    expect(amounts[2]).toBe(3_000_000);
    expect(amounts[3]).toBe(2_000_000);
  });

  it("나누어떨어지지 않는 금액도 잔액 보정으로 합이 보존된다", () => {
    const total = 33_333_333;
    const amounts = splitMilestoneAmounts(total);
    expect(amounts[1] + amounts[2] + amounts[3]).toBe(total);
    expect(amounts[1]).toBe(Math.floor(total * 0.5));
  });
});

describe("injectMermaidStyles", () => {
  it("상태별 스타일 구문을 주입한다", () => {
    const out = injectMermaidStyles("graph TD\n  a --> b", [
      { nodeId: "a", status: "done" },
      { nodeId: "b", status: "in_progress" },
      { nodeId: "c", status: "todo" },
    ]);
    expect(out).toContain("style a fill:#22c55e");
    expect(out).toContain("style b fill:#f97316");
    expect(out).toContain("style c fill:#f3f4f6");
  });

  it("빈 다이어그램이면 빈 문자열을 반환한다", () => {
    expect(injectMermaidStyles("", [])).toBe("");
  });
});

describe("입찰 검증", () => {
  it("모든 태스크에 견적이 없으면 유효하지 않다", () => {
    const project = careProject();
    const items = fullItems(project);
    const firstTaskId = flattenTasks(project)[0].id;
    delete items[firstTaskId];
    const result = validateBidItems(project, items);
    expect(result.valid).toBe(false);
    expect(result.missingCount).toBe(1);
  });

  it("NDA 서명 없이는 입찰이 거부된다", () => {
    const project = careProject();
    expect(() => submitBid(PARTNER, project.id, fullItems(project))).toThrow(
      DomainError
    );
  });

  it("총액과 총 공수가 롤업 계산된다", () => {
    const project = careProject();
    const result = validateBidItems(project, fullItems(project));
    const taskCount = flattenTasks(project).length;
    expect(result.valid).toBe(true);
    expect(result.totalManDays).toBe(taskCount * 2);
    expect(result.totalAmount).toBe(taskCount * 2 * 500_000);
  });
});

describe("계약-검수-정산 전체 흐름", () => {
  it("NDA → 입찰 → 계약 → 예치 → 완료 → 검수 → 정산이 규칙대로 동작한다", () => {
    let project = careProject();

    // 접근 제어: 파트너는 NDA 전 열람 불가, 소유 의뢰자는 가능
    expect(canViewSpecDetail(PARTNER, project)).toBe(false);
    expect(canViewSpecDetail(CLIENT, project)).toBe(true);

    signNda(PARTNER, project.id, "테스트파트너", "테스트컴퍼니");
    project = careProject();
    expect(canViewSpecDetail(PARTNER, project)).toBe(true);

    const bid = submitBid(PARTNER, project.id, fullItems(project));
    acceptBid(CLIENT, project.id, bid.id);
    project = careProject();

    // 계약·마일스톤 검증
    expect(project.status).toBe("active");
    expect(project.contract?.partnerId).toBe(PARTNER.id);
    expect(project.milestones).toHaveLength(3);
    const total = project.milestones.reduce((s, m) => s + m.amount, 0);
    expect(total).toBe(bid.totalAmount);
    // 경쟁 입찰은 자동 반려
    const rocket = project.bids.find((b) => b.partnerId === "partner-rocket");
    expect(rocket?.status).toBe("rejected");

    const ms1 = project.milestones.find((m) => m.phase === 1);
    if (ms1 === undefined) throw new Error("milestone missing");

    // 예치 전 검수 요청 불가
    expect(() =>
      requestInspection(PARTNER, project.id, ms1.id, "")
    ).toThrow(DomainError);

    depositEscrow(CLIENT, project.id, ms1.id);
    project = careProject();
    expect(project.milestones.find((m) => m.phase === 1)?.status).toBe(
      "escrow_deposited"
    );

    // 미완료 태스크가 있으면 검수 요청 차단
    expect(() =>
      requestInspection(PARTNER, project.id, ms1.id, "산출물 링크")
    ).toThrow(/미완료된 태스크/);

    for (const task of flattenTasks(project).filter(
      (t) => t.milestonePhase === 1
    )) {
      updateTaskStatus(PARTNER, project.id, task.id, "done");
    }
    project = careProject();
    requestInspection(PARTNER, project.id, ms1.id, "1단계 산출물 링크");
    project = careProject();
    expect(project.milestones.find((m) => m.phase === 1)?.status).toBe(
      "inspection_requested"
    );

    approveInspection(CLIENT, project.id, ms1.id);
    project = careProject();
    expect(project.milestones.find((m) => m.phase === 1)?.status).toBe(
      "released"
    );

    // 감사 로그: 전 과정이 INSERT 전용으로 누적된다
    const logs = domainStore
      .getSnapshot()
      .auditLogs.filter((l) => l.projectId === project.id);
    const types = logs.map((l) => l.actionType);
    for (const expected of [
      "NDA_SIGNED",
      "BID_SUBMITTED",
      "BID_ACCEPTED",
      "CONTRACT_CREATED",
      "ESCROW_DEPOSITED",
      "TASK_STATUS_UPDATE",
      "MILESTONE_INSPECTION_REQUESTED",
      "MILESTONE_RELEASED",
    ]) {
      expect(types).toContain(expected);
    }
    const release = logs.find((l) => l.actionType === "MILESTONE_RELEASED");
    expect(release?.beforeState).toEqual({
      phase: 1,
      status: "inspection_requested",
    });
    expect(release?.afterState).toMatchObject({ phase: 1, status: "released" });
  });

  it("2단계 예치는 1단계 정산 전에는 차단된다", () => {
    let project = careProject();
    signNda(PARTNER, project.id, "테스트파트너", "");
    const bid = submitBid(PARTNER, project.id, fullItems(project));
    acceptBid(CLIENT, project.id, bid.id);
    project = careProject();
    const ms2 = project.milestones.find((m) => m.phase === 2);
    if (ms2 === undefined) throw new Error("milestone missing");
    expect(() => depositEscrow(CLIENT, project.id, ms2.id)).toThrow(
      /이전 마일스톤/
    );
  });
});

describe("공정률 계산", () => {
  it("완료 비율을 소수점 첫째 자리까지 계산한다", () => {
    const project = careProject();
    const tasks = flattenTasks(project);
    updateTaskStatus(CLIENT, project.id, tasks[0].id, "done");
    const rate = calcProgressRate(careProject());
    expect(rate).toBeCloseTo(Math.round((1 / tasks.length) * 1000) / 10, 5);
  });
});

import { describe, expect, it } from "vitest";

import type {
  AsPaymentLogRow,
  AsSubscriptionRow,
  BidItemRow,
  BidRow,
  ContractRow,
  MilestoneRow,
  ProfileRow,
  ProjectNdaRow,
  ProjectRow,
  SpecEpicRow,
  SpecFeatureRow,
  SpecTaskRow,
  SystemAuditLogRow,
} from "./database.types";
import {
  toAsSubscription,
  toAuditLog,
  toBid,
  toProject,
  toSpecHierarchy,
  type ProjectRowBundle,
} from "./mappers";

const PROFILES = new Map<string, ProfileRow>([
  [
    "client-1",
    {
      id: "client-1",
      name: "김의뢰",
      company: "펫케어랩",
      role: "client",
      tech_tags: [],
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  ],
  [
    "partner-1",
    {
      id: "partner-1",
      name: "루멘랩스",
      company: "루멘랩스",
      role: "partner",
      tech_tags: ["Next.js"],
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  ],
]);

const PROJECT: ProjectRow = {
  id: "prj-1",
  title: "펫케어 예약 플랫폼",
  summary: "반려동물 돌봄 예약",
  client_id: "client-1",
  tech_tags: ["Next.js"],
  spec_markdown: "# 명세",
  mermaid_code: "graph TD",
  status: "active",
  dispute_reason: null,
  created_at: "2026-08-10T00:00:00Z",
  updated_at: "2026-08-10T00:00:00Z",
};

function task(overrides: Partial<SpecTaskRow> & { id: string }): SpecTaskRow {
  return {
    feature_id: "feat-1",
    project_id: "prj-1",
    title: "태스크",
    description: "",
    milestone_phase: 1,
    node_id: null,
    status: "todo",
    estimated_md: 3,
    sort_order: 1,
    updated_at: "2026-08-10T00:00:00Z",
    ...overrides,
  };
}

describe("toSpecHierarchy", () => {
  const epics: SpecEpicRow[] = [
    { id: "epic-2", project_id: "prj-1", title: "두번째", sort_order: 2 },
    { id: "epic-1", project_id: "prj-1", title: "첫번째", sort_order: 1 },
  ];
  const features: SpecFeatureRow[] = [
    { id: "feat-b", epic_id: "epic-1", title: "B", sort_order: 2 },
    { id: "feat-a", epic_id: "epic-1", title: "A", sort_order: 1 },
    { id: "feat-c", epic_id: "epic-2", title: "C", sort_order: 1 },
  ];
  const tasks: SpecTaskRow[] = [
    task({ id: "t2", feature_id: "feat-a", title: "두번째", sort_order: 2 }),
    task({ id: "t1", feature_id: "feat-a", title: "첫번째", sort_order: 1 }),
    task({ id: "t3", feature_id: "feat-c", title: "다른 에픽", sort_order: 1 }),
  ];

  it("sort_order 기준으로 에픽·피처·태스크를 정렬한다", () => {
    const result = toSpecHierarchy(epics, features, tasks);

    expect(result.map((e) => e.title)).toEqual(["첫번째", "두번째"]);
    expect(result[0].features.map((f) => f.title)).toEqual(["A", "B"]);
    expect(result[0].features[0].tasks.map((t) => t.title)).toEqual([
      "첫번째",
      "두번째",
    ]);
  });

  it("태스크가 없는 피처도 빈 배열로 유지한다", () => {
    const result = toSpecHierarchy(epics, features, tasks);
    expect(result[0].features[1].tasks).toEqual([]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const snapshot = epics.map((e) => e.id);
    toSpecHierarchy(epics, features, tasks);
    expect(epics.map((e) => e.id)).toEqual(snapshot);
  });
});

describe("toBid", () => {
  const bidRow: BidRow = {
    id: "bid-1",
    project_id: "prj-1",
    partner_id: "partner-1",
    total_amount: 2500000,
    total_man_days: 5,
    status: "submitted",
    tech_score: 88,
    comm_score: 76,
    portfolio_score: 82,
    created_at: "2026-08-20T00:00:00Z",
    updated_at: "2026-08-20T00:00:00Z",
  };
  const items: BidItemRow[] = [
    {
      id: "item-1",
      bid_id: "bid-1",
      task_id: "t1",
      man_day: 3,
      unit_price: 500000,
      estimation_basis: "재사용 가능",
      amount: 1500000,
    },
    {
      id: "item-2",
      bid_id: "bid-other",
      task_id: "t1",
      man_day: 9,
      unit_price: 900000,
      estimation_basis: null,
      amount: 8100000,
    },
  ];

  it("자기 입찰의 항목만 taskId 로 묶는다", () => {
    const bid = toBid(bidRow, items, PROFILES);

    expect(bid).not.toBeNull();
    expect(Object.keys(bid?.items ?? {})).toEqual(["t1"]);
    expect(bid?.items.t1.manDay).toBe(3);
    expect(bid?.items.t1.estimationBasis).toBe("재사용 가능");
  });

  it("파트너 이름을 프로필에서 채운다", () => {
    expect(toBid(bidRow, items, PROFILES)?.partnerName).toBe("루멘랩스");
  });

  it("프로필을 찾지 못해도 식별자를 노출하지 않는다", () => {
    const orphan = { ...bidRow, partner_id: "사라진-사용자" };
    expect(toBid(orphan, items, PROFILES)?.partnerName).toBe("알 수 없음");
  });

  it("제출 전(draft) 입찰은 도메인에 올리지 않는다", () => {
    expect(toBid({ ...bidRow, status: "draft" }, items, PROFILES)).toBeNull();
  });

  it("문자열로 내려온 숫자 컬럼을 숫자로 바꾼다", () => {
    const stringy = {
      ...bidRow,
      total_amount: "2500000" as unknown as number,
      total_man_days: "5.00" as unknown as number,
    };
    const bid = toBid(stringy, items, PROFILES);

    expect(bid?.totalAmount).toBe(2500000);
    expect(bid?.totalManDays).toBe(5);
  });
});

describe("toAsSubscription", () => {
  const subscription: AsSubscriptionRow = {
    id: "sub-1",
    project_id: "prj-1",
    tier: "standard",
    status: "active",
    billing_key: "bkey_a1b2",
    card_label: "신한 ****1234",
    price_monthly: 300000,
    next_billing_date: "2026-09-24",
    cancelled_at: null,
    created_at: "2026-08-24T00:00:00Z",
    updated_at: "2026-08-24T00:00:00Z",
  };
  const payments: AsPaymentLogRow[] = [
    {
      id: "pay-1",
      subscription_id: "sub-1",
      amount: 300000,
      status: "success",
      transaction_id: "tx-1",
      error_message: null,
      paid_at: "2026-08-24T00:00:00Z",
    },
    {
      id: "pay-2",
      subscription_id: "sub-1",
      amount: 300000,
      status: "success",
      transaction_id: "tx-2",
      error_message: null,
      paid_at: "2026-09-24T00:00:00Z",
    },
    {
      id: "pay-3",
      subscription_id: "sub-other",
      amount: 100000,
      status: "failed",
      transaction_id: "tx-3",
      error_message: "한도 초과",
      paid_at: "2026-09-24T00:00:00Z",
    },
  ];

  it("자기 구독의 결제만 최신순으로 담는다", () => {
    const result = toAsSubscription(subscription, payments);

    expect(result.payments.map((p) => p.transactionId)).toEqual(["tx-2", "tx-1"]);
  });
});

describe("toAuditLog", () => {
  it("계정이 지워진 기록도 이름을 보존한다", () => {
    const row: SystemAuditLogRow = {
      id: "log-1",
      project_id: "prj-1",
      actor_id: null,
      actor_name: "탈퇴한 사용자",
      action_type: "MILESTONE_RELEASED",
      before_state: null,
      after_state: { amount: 5000000 },
      created_at: "2026-08-24T00:00:00Z",
    };

    const log = toAuditLog(row);
    expect(log.actorName).toBe("탈퇴한 사용자");
    expect(log.actorId).toBe("");
    expect(log.afterState).toEqual({ amount: 5000000 });
  });
});

describe("toProject", () => {
  const contract: ContractRow = {
    id: "ct-1",
    project_id: "prj-1",
    bid_id: "bid-1",
    partner_id: "partner-1",
    total_amount: 10000001,
    signed_at: "2026-08-21T00:00:00Z",
  };
  const milestones: MilestoneRow[] = [
    {
      id: "ms-3",
      project_id: "prj-1",
      contract_id: "ct-1",
      phase: 3,
      ratio: 0.2,
      amount: 2000001,
      status: "pending",
      inspection_notes: null,
      reject_reason: null,
      updated_at: "2026-08-21T00:00:00Z",
    },
    {
      id: "ms-1",
      project_id: "prj-1",
      contract_id: "ct-1",
      phase: 1,
      ratio: 0.5,
      amount: 5000000,
      status: "released",
      inspection_notes: "확인 완료",
      reject_reason: null,
      updated_at: "2026-08-21T00:00:00Z",
    },
    {
      id: "ms-2",
      project_id: "prj-1",
      contract_id: "ct-1",
      phase: 2,
      ratio: 0.3,
      amount: 3000000,
      status: "escrow_deposited",
      inspection_notes: null,
      reject_reason: null,
      updated_at: "2026-08-21T00:00:00Z",
    },
  ];
  const ndas: ProjectNdaRow[] = [
    {
      id: "nda-1",
      project_id: "prj-1",
      user_id: "partner-1",
      signer_name: "루멘랩스",
      signer_company: "루멘랩스",
      signed_at: "2026-08-19T00:00:00Z",
    },
  ];

  const bundle: ProjectRowBundle = {
    project: PROJECT,
    epics: [{ id: "epic-1", project_id: "prj-1", title: "기반", sort_order: 1 }],
    features: [{ id: "feat-1", epic_id: "epic-1", title: "인증", sort_order: 1 }],
    tasks: [task({ id: "t1", node_id: "auth" })],
    ndas,
    bids: [
      {
        id: "bid-1",
        project_id: "prj-1",
        partner_id: "partner-1",
        total_amount: 10000001,
        total_man_days: 5,
        status: "accepted",
        tech_score: 88,
        comm_score: 76,
        portfolio_score: 82,
        created_at: "2026-08-20T00:00:00Z",
        updated_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "bid-draft",
        project_id: "prj-1",
        partner_id: "partner-1",
        total_amount: 0,
        total_man_days: 0,
        status: "draft",
        tech_score: 0,
        comm_score: 0,
        portfolio_score: 0,
        created_at: "2026-08-22T00:00:00Z",
        updated_at: "2026-08-22T00:00:00Z",
      },
    ],
    bidItems: [
      {
        id: "item-1",
        bid_id: "bid-1",
        task_id: "t1",
        man_day: 5,
        unit_price: 2000000,
        estimation_basis: null,
        amount: 10000000,
      },
    ],
    contract,
    milestones,
    subscription: null,
    payments: [],
    profiles: PROFILES,
  };

  it("마일스톤을 단계 순으로 정렬하고 합계가 계약 총액과 일치한다", () => {
    const project = toProject(bundle);

    expect(project.milestones.map((m) => m.phase)).toEqual([1, 2, 3]);
    expect(project.milestones.reduce((sum, m) => sum + m.amount, 0)).toBe(
      contract.total_amount,
    );
  });

  it("제출 전 입찰은 프로젝트에 포함하지 않는다", () => {
    const project = toProject(bundle);
    expect(project.bids.map((b) => b.id)).toEqual(["bid-1"]);
  });

  it("의뢰자·수행사 이름을 프로필에서 채운다", () => {
    const project = toProject(bundle);
    expect(project.clientName).toBe("김의뢰");
    expect(project.contract?.partnerName).toBe("루멘랩스");
  });

  it("계약·구독이 없는 프로젝트도 null 로 표현한다", () => {
    const project = toProject({ ...bundle, contract: null, milestones: [] });
    expect(project.contract).toBeNull();
    expect(project.subscription).toBeNull();
    expect(project.milestones).toEqual([]);
  });

  it("NDA 서명자를 그대로 옮긴다", () => {
    const project = toProject(bundle);
    expect(project.ndaSignatures).toEqual([
      {
        userId: "partner-1",
        signerName: "루멘랩스",
        signerCompany: "루멘랩스",
        signedAt: "2026-08-19T00:00:00Z",
      },
    ]);
  });
});

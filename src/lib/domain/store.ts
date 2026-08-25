import {
  chunkText,
  estimateTokens,
  hasEmbeddings,
  searchChunks,
  validateUpload,
  type RagChunk,
  type RagDocument,
  type RagSearchHit,
} from "@/lib/domain/rag";
import { generateSpecFromAnswers, type GeneratedSpec } from "@/lib/domain/spec-engine";
import {
  AS_TIER_PLANS,
  MILESTONE_RATIOS,
  calcProgressRate,
  flattenTasks,
  isMilestoneClosed,
  splitMilestoneAmounts,
  type AsPaymentLog,
  type AsSubscription,
  type AsSubscriptionTier,
  type AuditActionType,
  type AuditLog,
  type Bid,
  type BidItem,
  type DomainState,
  type Milestone,
  type MilestonePhase,
  type Project,
  type SpecTaskStatus,
} from "@/lib/domain/types";
import type { UserRole } from "@/lib/navigation";

// 지식 베이스 추가로 상태 모양이 바뀌어 버전을 올린다
const STORAGE_KEY = "archon.domain.v2";

export interface ActorInfo {
  id: string;
  name: string;
  role: UserRole;
}

export class DomainError extends Error {}

let idSeq = 0;
function newId(prefix: string): string {
  idSeq += 1;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${idSeq}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/* Seed 데이터 — 결정적(고정 날짜)이라 SSR 스냅샷으로도 안전하다        */
/* ------------------------------------------------------------------ */

function seededProject(
  id: string,
  spec: GeneratedSpec,
  base: Partial<Project>
): Project {
  return {
    id,
    title: spec.title,
    summary: spec.summary,
    clientId: "mock-user-1",
    clientName: "김아칸",
    techTags: spec.techTags,
    specMarkdown: spec.specMarkdown,
    mermaidCode: spec.mermaidCode,
    epics: spec.epics,
    status: "draft",
    ndaSignatures: [],
    bids: [],
    contract: null,
    milestones: [],
    disputeReason: null,
    subscription: null,
    createdAt: "2026-08-10T09:00:00.000Z",
    ...base,
  };
}

function buildSeed(): DomainState {
  // P1: 계약 후 개발이 진행 중인 프로젝트
  const petSpec = generateSpecFromAnswers([
    { questionId: "service", question: "어떤 서비스인가요?", answer: "펫시터 예약·결제 플랫폼" },
    { questionId: "users", question: "사용자는?", answer: "반려동물을 키우는 30대 직장인" },
    { questionId: "features", question: "핵심 기능은?", answer: "펫시터 예약, 안전 결제, 돌봄 일지" },
    { questionId: "auth", question: "가입 방식은?", answer: "카카오 간편 로그인" },
    { questionId: "payment", question: "결제 필요?", answer: "네, 필요해요" },
    { questionId: "data", question: "중요 데이터?", answer: "예약 내역과 고객 정보" },
    { questionId: "admin", question: "관리 화면?", answer: "예약 현황 대시보드" },
    { questionId: "timeline", question: "기한은?", answer: "3개월" },
  ]);

  const p1 = seededProject("prj-pet", petSpec, {
    status: "active",
    createdAt: "2026-07-21T02:00:00.000Z",
    ndaSignatures: [
      {
        userId: "mock-user-1",
        signerName: "김아칸",
        signerCompany: "스튜디오 아칸",
        signedAt: "2026-07-28T05:12:00.000Z",
      },
    ],
  });
  // 1단계 태스크 완료, 2단계 일부 진행
  for (const task of flattenTasks(p1)) {
    if (task.milestonePhase === 1) task.status = "done";
  }
  const phase2 = flattenTasks(p1).filter((t) => t.milestonePhase === 2);
  if (phase2.length > 0) phase2[0].status = "done";
  if (phase2.length > 1) phase2[1].status = "in_progress";

  const p1Total = 28_000_000;
  const p1Amounts = splitMilestoneAmounts(p1Total);
  const acceptedBid: Bid = {
    id: "bid-pet-1",
    projectId: p1.id,
    partnerId: "mock-user-1",
    partnerName: "김아칸 (개발 파트너)",
    items: Object.fromEntries(
      flattenTasks(p1).map((t) => [
        t.id,
        {
          manDay: t.estimatedMd,
          unitPrice: 700_000,
          estimationBasis: null,
        },
      ])
    ),
    totalAmount: p1Total,
    totalManDays: flattenTasks(p1).reduce((s, t) => s + t.estimatedMd, 0),
    status: "accepted",
    scores: { techScore: 88, commScore: 84, portfolioScore: 80 },
    createdAt: "2026-07-29T03:00:00.000Z",
  };
  p1.bids = [acceptedBid];
  p1.contract = {
    id: "contract-pet",
    bidId: acceptedBid.id,
    partnerId: "mock-user-1",
    partnerName: "김아칸 (개발 파트너)",
    totalAmount: p1Total,
    signedAt: "2026-07-30T01:00:00.000Z",
  };
  p1.milestones = [
    {
      id: "ms-pet-1",
      phase: 1,
      ratio: MILESTONE_RATIOS[1],
      amount: p1Amounts[1],
      status: "released",
      inspectionNotes: "1단계 산출물: 기반 화면·로그인·예약 화면 데모 링크",
      rejectReason: null,
      updatedAt: "2026-08-12T06:00:00.000Z",
    },
    {
      id: "ms-pet-2",
      phase: 2,
      ratio: MILESTONE_RATIOS[2],
      amount: p1Amounts[2],
      status: "escrow_deposited",
      inspectionNotes: null,
      rejectReason: null,
      updatedAt: "2026-08-13T02:00:00.000Z",
    },
    {
      id: "ms-pet-3",
      phase: 3,
      ratio: MILESTONE_RATIOS[3],
      amount: p1Amounts[3],
      status: "pending",
      inspectionNotes: null,
      rejectReason: null,
      updatedAt: "2026-07-30T01:00:00.000Z",
    },
  ];

  // P2: 입찰이 진행 중인 프로젝트 (타사 입찰 1건 존재)
  const careSpec = generateSpecFromAnswers([
    { questionId: "service", question: "어떤 서비스인가요?", answer: "헬스케어 구독 커머스" },
    { questionId: "users", question: "사용자는?", answer: "건강기능식품을 정기 구독하는 40대" },
    { questionId: "features", question: "핵심 기능은?", answer: "상품 구독, 정기 결제, 배송 조회" },
    { questionId: "auth", question: "가입 방식은?", answer: "이메일 가입" },
    { questionId: "payment", question: "결제 필요?", answer: "네, 필요해요" },
    { questionId: "data", question: "중요 데이터?", answer: "구독과 결제 이력" },
    { questionId: "admin", question: "관리 화면?", answer: "구독 현황 관리" },
    { questionId: "timeline", question: "기한은?", answer: "3개월" },
  ]);
  const p2 = seededProject("prj-care", careSpec, {
    status: "bidding",
    createdAt: "2026-08-18T01:30:00.000Z",
  });
  // 서로 다른 견적 성향의 입찰 2건 — 비교 대시보드의 편차·레이더가 바로 의미를 갖는다
  const p2Tasks = flattenTasks(p2);
  const rocketItems = Object.fromEntries(
    p2Tasks.map((t, i) => [
      t.id,
      {
        manDay: t.estimatedMd + 1,
        // 결제·데이터 관련 태스크에 공수를 크게 잡은 성향
        unitPrice: i % 3 === 0 ? 820_000 : 650_000,
        estimationBasis:
          i % 3 === 0
            ? "외부 결제사 연동과 예외 처리(환불·부분취소) 검증에 추가 공수가 필요합니다."
            : null,
      },
    ])
  );
  const lumenItems = Object.fromEntries(
    p2Tasks.map((t, i) => [
      t.id,
      {
        manDay: t.estimatedMd,
        unitPrice: i % 4 === 1 ? 430_000 : 600_000,
        estimationBasis:
          i % 4 === 1
            ? "사내에 유사 모듈이 있어 재사용이 가능해 공수를 낮게 책정했습니다."
            : null,
      },
    ])
  );
  const sumOf = (items: Record<string, BidItem>) =>
    Object.values(items).reduce((s, it) => s + it.manDay * it.unitPrice, 0);
  const mdOf = (items: Record<string, BidItem>) =>
    Object.values(items).reduce((s, it) => s + it.manDay, 0);

  p2.bids = [
    {
      id: "bid-care-rocket",
      projectId: p2.id,
      partnerId: "partner-rocket",
      partnerName: "스튜디오 로켓",
      items: rocketItems,
      totalAmount: sumOf(rocketItems),
      totalManDays: mdOf(rocketItems),
      status: "submitted",
      scores: { techScore: 92, commScore: 74, portfolioScore: 88 },
      createdAt: "2026-08-20T07:45:00.000Z",
    },
    {
      id: "bid-care-lumen",
      projectId: p2.id,
      partnerId: "partner-lumen",
      partnerName: "루멘랩스",
      items: lumenItems,
      totalAmount: sumOf(lumenItems),
      totalManDays: mdOf(lumenItems),
      status: "submitted",
      scores: { techScore: 78, commScore: 91, portfolioScore: 70 },
      createdAt: "2026-08-21T02:10:00.000Z",
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: "log-seed-1",
      projectId: p1.id,
      actorId: "mock-user-1",
      actorName: "김아칸",
      actionType: "CONTRACT_CREATED",
      beforeState: { project_status: "bidding" },
      afterState: { project_status: "active", total_amount: p1Total },
      createdAt: "2026-07-30T01:00:00.000Z",
    },
    {
      id: "log-seed-2",
      projectId: p1.id,
      actorId: "mock-user-1",
      actorName: "김아칸",
      actionType: "MILESTONE_RELEASED",
      beforeState: { phase: 1, status: "inspection_requested" },
      afterState: { phase: 1, status: "released", amount: p1Amounts[1] },
      createdAt: "2026-08-12T06:00:00.000Z",
    },
  ];


  // 지식 베이스 시드 — 임베딩이 없어 키워드 검색으로 동작하는 상태
  const KNOWLEDGE_TEXT = [
    "예약 신청은 돌봄사 선택과 일정 지정을 거쳐 결제로 이어진다. 보호자는 반려동물 정보를 미리 등록해두고 재예약 시 그대로 불러올 수 있다.",
    "결제는 카드 결제와 부분 취소를 지원한다. 환불 정책은 돌봄 시작 24시간 전까지 전액, 이후에는 50%를 반환하는 것을 원칙으로 한다.",
    "돌봄사는 돌봄 일지를 작성해 사진과 함께 보호자에게 전달한다. 일지는 예약 단위로 보관되며 보호자만 열람할 수 있다.",
    "관리자는 예약 현황 대시보드에서 일별 예약 건수와 취소율, 정산 대기 금액을 확인한다.",
  ].join("\n\n");

  const knowledgeDoc: RagDocument = {
    id: "ragdoc-pet-1",
    projectId: p1.id,
    title: "펫케어 요구사항 정의서.md",
    sourceType: "md",
    byteSize: new TextEncoder().encode(KNOWLEDGE_TEXT).length,
    chunkCount: 0,
    status: "processing",
    errorMessage: null,
    uploadedBy: "mock-user-1",
    uploaderName: "김아칸",
    createdAt: "2026-08-01T04:00:00.000Z",
  };
  const knowledgeChunks: RagChunk[] = chunkText(KNOWLEDGE_TEXT).map(
    (content, index) => ({
      id: `ragchunk-pet-${String(index)}`,
      documentId: knowledgeDoc.id,
      chunkIndex: index,
      content,
      tokenCount: estimateTokens(content),
      embedding: null,
    })
  );
  knowledgeDoc.chunkCount = knowledgeChunks.length;

  return {
    projects: [p1, p2],
    auditLogs,
    ragDocuments: [knowledgeDoc],
    ragChunks: knowledgeChunks,
  };
}

const SEED: DomainState = buildSeed();

/* ------------------------------------------------------------------ */
/* 스토어 본체                                                          */
/* ------------------------------------------------------------------ */

function loadPersisted(): DomainState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<DomainState>;
    // 이전 버전 상태가 남아 있어도 화면이 깨지지 않게 배열을 보정한다
    return {
      projects: parsed.projects ?? [],
      auditLogs: parsed.auditLogs ?? [],
      ragDocuments: parsed.ragDocuments ?? [],
      ragChunks: parsed.ragChunks ?? [],
    };
  } catch {
    return null;
  }
}

function persist(state: DomainState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 무시 — 세션 내 상태만 유지
  }
}

const listeners = new Set<() => void>();
let state: DomainState = SEED;
let hydrated = false;

function setState(next: DomainState) {
  state = next;
  persist(next);
  listeners.forEach((l) => l());
}

export const domainStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): DomainState {
    if (!hydrated) {
      hydrated = true;
      const persisted = loadPersisted();
      if (persisted !== null) state = persisted;
    }
    return state;
  },
  getServerSnapshot(): DomainState {
    return SEED;
  },
  /** 데모 초기화 — 시드로 되돌린다 */
  reset() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setState(buildSeed());
  },
};

function findProject(current: DomainState, projectId: string): Project {
  const project = current.projects.find((p) => p.id === projectId);
  if (project === undefined) throw new DomainError("프로젝트를 찾을 수 없습니다.");
  return project;
}

function replaceProject(current: DomainState, next: Project): DomainState {
  return {
    ...current,
    projects: current.projects.map((p) => (p.id === next.id ? next : p)),
  };
}

/**
 * 감사 로그 기록 — INSERT 전용.
 * 스토어는 로그를 수정·삭제하는 API를 일절 제공하지 않는다
 * (Supabase 연동 시 UPDATE/DELETE 차단 트리거 + RLS로 동일 규칙 적용).
 */
function appendAudit(
  current: DomainState,
  actor: ActorInfo,
  projectId: string,
  actionType: AuditActionType,
  beforeState: Record<string, unknown> | null,
  afterState: Record<string, unknown> | null
): DomainState {
  const log: AuditLog = {
    id: newId("log"),
    projectId,
    actorId: actor.id,
    actorName: actor.name,
    actionType,
    beforeState,
    afterState,
    createdAt: nowIso(),
  };
  return { ...current, auditLogs: [log, ...current.auditLogs] };
}

/* ------------------------------------------------------------------ */
/* 접근 제어 (Supabase RLS 대응 지점)                                   */
/* ------------------------------------------------------------------ */

/**
 * 스펙 상세(스펙 문서·아키텍처·태스크) 열람 권한.
 * 소유 의뢰자·관리자는 즉시, 파트너는 NDA 서명 후에만 열람 가능 —
 * Supabase 연동 시 projects/project_specs/tasks RLS 정책으로 이관된다.
 */
export function canViewSpecDetail(actor: ActorInfo, project: Project): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "client" && project.clientId === actor.id) return true;
  return project.ndaSignatures.some((s) => s.userId === actor.id);
}

export function hasSignedNda(actor: ActorInfo, project: Project): boolean {
  return project.ndaSignatures.some((s) => s.userId === actor.id);
}

/* ------------------------------------------------------------------ */
/* 액션                                                                */
/* ------------------------------------------------------------------ */

export function createProjectFromSpec(
  actor: ActorInfo,
  spec: GeneratedSpec
): Project {
  const current = domainStore.getSnapshot();
  const project: Project = {
    id: newId("prj"),
    title: spec.title,
    summary: spec.summary,
    clientId: actor.id,
    clientName: actor.name,
    techTags: spec.techTags,
    specMarkdown: spec.specMarkdown,
    mermaidCode: spec.mermaidCode,
    epics: spec.epics,
    status: "bidding",
    ndaSignatures: [],
    bids: [],
    contract: null,
    milestones: [],
    disputeReason: null,
    subscription: null,
    createdAt: nowIso(),
  };
  let next: DomainState = {
    ...current,
    projects: [project, ...current.projects],
  };
  next = appendAudit(next, actor, project.id, "PROJECT_CREATED", null, {
    title: project.title,
    status: project.status,
  });
  setState(next);
  return project;
}

export function signNda(
  actor: ActorInfo,
  projectId: string,
  signerName: string,
  signerCompany: string
) {
  if (signerName.trim() === "") throw new DomainError("서명자 성명을 입력해주세요.");
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  if (hasSignedNda(actor, project)) return;
  const updated: Project = {
    ...project,
    ndaSignatures: [
      ...project.ndaSignatures,
      {
        userId: actor.id,
        signerName: signerName.trim(),
        signerCompany: signerCompany.trim(),
        signedAt: nowIso(),
      },
    ],
  };
  let next = replaceProject(current, updated);
  next = appendAudit(next, actor, projectId, "NDA_SIGNED", null, {
    signer_name: signerName.trim(),
  });
  setState(next);
}

/** 입찰 검증: 모든 최하위 태스크에 공수·단가가 입력되어야 한다 */
export function validateBidItems(
  project: Project,
  items: Record<string, BidItem>
): { valid: boolean; missingCount: number; totalAmount: number; totalManDays: number } {
  const tasks = flattenTasks(project);
  let missingCount = 0;
  let totalAmount = 0;
  let totalManDays = 0;
  for (const task of tasks) {
    const item = items[task.id];
    if (item === undefined || item.manDay <= 0 || item.unitPrice <= 0) {
      missingCount += 1;
      continue;
    }
    totalAmount += item.manDay * item.unitPrice;
    totalManDays += item.manDay;
  }
  return { valid: missingCount === 0, missingCount, totalAmount, totalManDays };
}

export function submitBid(
  actor: ActorInfo,
  projectId: string,
  items: Record<string, BidItem>
): Bid {
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  if (project.status !== "bidding")
    throw new DomainError("입찰이 마감된 프로젝트입니다.");
  if (!hasSignedNda(actor, project))
    throw new DomainError("NDA 서명 후에 입찰할 수 있습니다.");
  const { valid, missingCount, totalAmount, totalManDays } = validateBidItems(
    project,
    items
  );
  if (!valid)
    throw new DomainError(
      `공수와 단가가 입력되지 않은 태스크가 ${missingCount}개 있습니다.`
    );

  const profile = PARTNER_POOL.find((p) => p.id === actor.id);
  const bid: Bid = {
    id: newId("bid"),
    projectId,
    partnerId: actor.id,
    partnerName: actor.name,
    items,
    totalAmount,
    totalManDays,
    status: "submitted",
    // 프로필 실적 기반 정성 점수 — Supabase 연동 시 developer_profiles에서 로드
    scores:
      profile !== undefined
        ? {
            techScore: Math.min(95, 60 + profile.completedProjects * 2),
            commScore: 82,
            portfolioScore: Math.min(95, 55 + profile.completedProjects * 2),
          }
        : { techScore: 82, commScore: 85, portfolioScore: 78 },
    createdAt: nowIso(),
  };
  const updated: Project = {
    ...project,
    bids: [...project.bids.filter((b) => b.partnerId !== actor.id), bid],
  };
  let next = replaceProject(current, updated);
  next = appendAudit(next, actor, projectId, "BID_SUBMITTED", null, {
    total_amount: totalAmount,
    total_man_days: totalManDays,
  });
  setState(next);
  return bid;
}

/**
 * 입찰 선정 → 계약 체결 → 50/30/20 마일스톤 자동 생성 (단일 원자적 갱신).
 */
export function acceptBid(actor: ActorInfo, projectId: string, bidId: string) {
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  if (project.clientId !== actor.id)
    throw new DomainError("프로젝트 소유자만 입찰을 수락할 수 있습니다.");
  const bid = project.bids.find((b) => b.id === bidId);
  if (bid === undefined) throw new DomainError("입찰을 찾을 수 없습니다.");

  const amounts = splitMilestoneAmounts(bid.totalAmount);
  const milestones: Milestone[] = ([1, 2, 3] as MilestonePhase[]).map(
    (phase) => ({
      id: newId("ms"),
      phase,
      ratio: MILESTONE_RATIOS[phase],
      amount: amounts[phase],
      status: "pending",
      inspectionNotes: null,
      rejectReason: null,
      updatedAt: nowIso(),
    })
  );

  const updated: Project = {
    ...project,
    status: "active",
    bids: project.bids.map((b) => ({
      ...b,
      status: b.id === bidId ? "accepted" : "rejected",
    })),
    contract: {
      id: newId("contract"),
      bidId,
      partnerId: bid.partnerId,
      partnerName: bid.partnerName,
      totalAmount: bid.totalAmount,
      signedAt: nowIso(),
    },
    milestones,
  };
  let next = replaceProject(current, updated);
  next = appendAudit(
    next,
    actor,
    projectId,
    "BID_ACCEPTED",
    { project_status: project.status },
    { project_status: "active", accepted_bid_id: bidId }
  );
  next = appendAudit(next, actor, projectId, "CONTRACT_CREATED", null, {
    total_amount: bid.totalAmount,
    milestones: amounts,
  });
  setState(next);
}

function updateMilestone(
  project: Project,
  milestoneId: string,
  patch: Partial<Milestone>
): { updated: Project; before: Milestone; after: Milestone } {
  const milestone = project.milestones.find((m) => m.id === milestoneId);
  if (milestone === undefined)
    throw new DomainError("마일스톤을 찾을 수 없습니다.");
  const after: Milestone = { ...milestone, ...patch, updatedAt: nowIso() };
  return {
    updated: {
      ...project,
      milestones: project.milestones.map((m) =>
        m.id === milestoneId ? after : m
      ),
    },
    before: milestone,
    after,
  };
}

/** 의뢰자: 에스크로 예치 (Mock PG — 실제 PG 연동 시 웹훅 승인으로 교체) */
export function depositEscrow(
  actor: ActorInfo,
  projectId: string,
  milestoneId: string
) {
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  if (project.clientId !== actor.id)
    throw new DomainError("의뢰자만 에스크로를 예치할 수 있습니다.");
  const milestone = project.milestones.find((m) => m.id === milestoneId);
  if (milestone === undefined)
    throw new DomainError("마일스톤을 찾을 수 없습니다.");
  if (milestone.status !== "pending")
    throw new DomainError("이미 예치된 마일스톤입니다.");
  const prevPhase = project.milestones.find(
    (m) => m.phase === milestone.phase - 1
  );
  if (prevPhase !== undefined && !isMilestoneClosed(prevPhase.status))
    throw new DomainError("이전 마일스톤 정산이 완료된 후 예치할 수 있습니다.");

  const { updated, before, after } = updateMilestone(project, milestoneId, {
    status: "escrow_deposited",
  });
  let next = replaceProject(current, updated);
  next = appendAudit(
    next,
    actor,
    projectId,
    "ESCROW_DEPOSITED",
    { phase: before.phase, status: before.status },
    { phase: after.phase, status: after.status, amount: after.amount }
  );
  setState(next);
}

/** 칸반 태스크 상태 변경 — 계약 이후에는 반드시 감사 로그가 남는다 */
export function updateTaskStatus(
  actor: ActorInfo,
  projectId: string,
  taskId: string,
  status: SpecTaskStatus
) {
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  let beforeStatus: SpecTaskStatus | null = null;
  let taskTitle = "";
  const updated: Project = {
    ...project,
    epics: project.epics.map((epic) => ({
      ...epic,
      features: epic.features.map((feature) => ({
        ...feature,
        tasks: feature.tasks.map((task) => {
          if (task.id !== taskId) return task;
          beforeStatus = task.status;
          taskTitle = task.title;
          return { ...task, status };
        }),
      })),
    })),
  };
  if (beforeStatus === null) throw new DomainError("태스크를 찾을 수 없습니다.");
  if (beforeStatus === status) return;
  let next = replaceProject(current, updated);
  next = appendAudit(
    next,
    actor,
    projectId,
    "TASK_STATUS_UPDATE",
    { task: taskTitle, status: beforeStatus },
    { task: taskTitle, status, progress_rate: calcProgressRate(updated) }
  );
  setState(next);
}

/** 파트너: 마일스톤 검수 요청 — 해당 단계 태스크가 모두 완료돼야 한다 */
export function requestInspection(
  actor: ActorInfo,
  projectId: string,
  milestoneId: string,
  notes: string
) {
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  const milestone = project.milestones.find((m) => m.id === milestoneId);
  if (milestone === undefined)
    throw new DomainError("마일스톤을 찾을 수 없습니다.");
  if (milestone.status !== "escrow_deposited")
    throw new DomainError("에스크로가 예치된 마일스톤만 검수를 요청할 수 있습니다.");
  const phaseTasks = flattenTasks(project).filter(
    (t) => t.milestonePhase === milestone.phase
  );
  const undone = phaseTasks.filter((t) => t.status !== "done").length;
  if (undone > 0)
    throw new DomainError(
      `마일스톤 내 미완료된 태스크가 ${undone}개 있어 검수를 요청할 수 없습니다.`
    );

  const { updated, before, after } = updateMilestone(project, milestoneId, {
    status: "inspection_requested",
    inspectionNotes: notes.trim() === "" ? null : notes.trim(),
    rejectReason: null,
  });
  let next = replaceProject(current, updated);
  next = appendAudit(
    next,
    actor,
    projectId,
    "MILESTONE_INSPECTION_REQUESTED",
    { phase: before.phase, status: before.status },
    { phase: after.phase, status: after.status }
  );
  setState(next);
}

/** 의뢰자: 검수 승인 → 에스크로 정산 방출 */
export function approveInspection(
  actor: ActorInfo,
  projectId: string,
  milestoneId: string
) {
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  if (project.clientId !== actor.id)
    throw new DomainError("의뢰자만 검수를 승인할 수 있습니다.");
  const milestone = project.milestones.find((m) => m.id === milestoneId);
  if (milestone === undefined)
    throw new DomainError("마일스톤을 찾을 수 없습니다.");
  if (milestone.status !== "inspection_requested")
    throw new DomainError("검수 요청 상태의 마일스톤만 승인할 수 있습니다.");

  const { updated, before, after } = updateMilestone(project, milestoneId, {
    status: "released",
  });
  const allReleased = updated.milestones.every((m) =>
    isMilestoneClosed(m.status)
  );
  const finalProject: Project = allReleased
    ? { ...updated, status: "completed" }
    : updated;
  let next = replaceProject(current, finalProject);
  next = appendAudit(
    next,
    actor,
    projectId,
    "MILESTONE_RELEASED",
    { phase: before.phase, status: before.status },
    { phase: after.phase, status: after.status, amount: after.amount }
  );
  setState(next);
}

/** 의뢰자: 검수 반려 → 에스크로 예치 상태로 복귀 */
export function rejectInspection(
  actor: ActorInfo,
  projectId: string,
  milestoneId: string,
  reason: string
) {
  if (reason.trim() === "") throw new DomainError("반려 사유를 입력해주세요.");
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  if (project.clientId !== actor.id)
    throw new DomainError("의뢰자만 검수를 반려할 수 있습니다.");
  const { updated, before, after } = updateMilestone(project, milestoneId, {
    status: "escrow_deposited",
    rejectReason: reason.trim(),
  });
  if (before.status !== "inspection_requested")
    throw new DomainError("검수 요청 상태의 마일스톤만 반려할 수 있습니다.");
  let next = replaceProject(current, updated);
  next = appendAudit(
    next,
    actor,
    projectId,
    "MILESTONE_INSPECTION_REJECTED",
    { phase: before.phase, status: before.status },
    { phase: after.phase, status: after.status, reason: reason.trim() }
  );
  setState(next);
}

/* ------------------------------------------------------------------ */
/* 분쟁 및 운영사 강제 조정                                             */
/* ------------------------------------------------------------------ */

/** 계약 당사자(의뢰자·파트너)가 분쟁을 신고한다 */
export function raiseDispute(
  actor: ActorInfo,
  projectId: string,
  reason: string
) {
  if (reason.trim().length < 10)
    throw new DomainError("분쟁 사유를 10자 이상 입력해주세요.");
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  if (project.contract === null)
    throw new DomainError("계약이 체결된 프로젝트만 분쟁을 신고할 수 있습니다.");
  const isParty =
    project.clientId === actor.id || project.contract.partnerId === actor.id;
  if (!isParty)
    throw new DomainError("계약 당사자만 분쟁을 신고할 수 있습니다.");

  const updated: Project = {
    ...project,
    status: "disputed",
    disputeReason: reason.trim(),
  };
  let next = replaceProject(current, updated);
  next = appendAudit(
    next,
    actor,
    projectId,
    "DISPUTE_RAISED",
    { project_status: project.status },
    { project_status: "disputed", reason: reason.trim() }
  );
  setState(next);
}

export type OverrideAction = "SETTLE" | "REFUND";

/**
 * 운영사(admin) 전용 강제 조정.
 * 감사 로그를 근거로 교착된 마일스톤을 강제 정산하거나 환불한다.
 * 조정 사유는 10자 이상 필수이며 감사 로그에 그대로 보존된다.
 */
export function adminOverrideMilestone(
  actor: ActorInfo,
  projectId: string,
  milestoneId: string,
  action: OverrideAction,
  reason: string
) {
  if (actor.role !== "admin")
    throw new DomainError("운영 관리자만 강제 조정을 실행할 수 있습니다.");
  if (reason.trim().length < 10)
    throw new DomainError("조정 사유를 10자 이상 입력해주세요.");

  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  const milestone = project.milestones.find((m) => m.id === milestoneId);
  if (milestone === undefined)
    throw new DomainError("마일스톤을 찾을 수 없습니다.");
  if (isMilestoneClosed(milestone.status))
    throw new DomainError("이미 정산이 종료된 마일스톤입니다.");

  const nextStatus =
    action === "SETTLE" ? "override_settled" : "override_refunded";
  const { updated, before, after } = updateMilestone(project, milestoneId, {
    status: nextStatus,
  });
  // 모든 마일스톤 처리가 끝나면 분쟁 상태를 해제한다
  const allClosed = updated.milestones.every((m) => isMilestoneClosed(m.status));
  const finalProject: Project = allClosed
    ? { ...updated, status: "completed" }
    : updated;

  let next = replaceProject(current, finalProject);
  next = appendAudit(
    next,
    actor,
    projectId,
    action === "SETTLE" ? "ADMIN_OVERRIDE_SETTLE" : "ADMIN_OVERRIDE_REFUND",
    { phase: before.phase, status: before.status },
    {
      phase: after.phase,
      status: after.status,
      amount: after.amount,
      reason: reason.trim(),
    }
  );
  setState(next);
}

/* ------------------------------------------------------------------ */
/* AS 구독 라이프사이클                                                 */
/* ------------------------------------------------------------------ */

function addMonth(iso: string): string {
  const date = new Date(iso);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

/**
 * AS 구독 시작 — 빌링키 등록 후 첫 달 결제까지 한 번에 처리한다.
 * 빌링키와 마스킹 카드 표기만 저장하며 카드 원본 정보는 다루지 않는다.
 */
export function startSubscription(
  actor: ActorInfo,
  projectId: string,
  tier: AsSubscriptionTier,
  billingKey: string,
  cardLabel: string,
  transactionId: string
) {
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  if (project.clientId !== actor.id)
    throw new DomainError("의뢰자만 AS 구독을 신청할 수 있습니다.");
  if (project.contract === null)
    throw new DomainError("계약이 체결된 프로젝트만 AS를 구독할 수 있습니다.");
  if (
    project.subscription !== null &&
    project.subscription.status !== "terminated"
  )
    throw new DomainError("이미 진행 중인 구독이 있습니다.");

  const plan = AS_TIER_PLANS.find((p) => p.tier === tier);
  if (plan === undefined) throw new DomainError("알 수 없는 요금제입니다.");

  const now = nowIso();
  const firstPayment: AsPaymentLog = {
    id: newId("pay"),
    amount: plan.priceMonthly,
    status: "success",
    transactionId,
    errorMessage: null,
    paidAt: now,
  };
  const subscription: AsSubscription = {
    id: newId("sub"),
    tier,
    status: "active",
    billingKey,
    cardLabel,
    priceMonthly: plan.priceMonthly,
    nextBillingDate: addMonth(now),
    cancelledAt: null,
    payments: [firstPayment],
    createdAt: now,
  };

  let next = replaceProject(current, { ...project, subscription });
  next = appendAudit(next, actor, projectId, "SUBSCRIPTION_STARTED", null, {
    tier,
    price_monthly: plan.priceMonthly,
  });
  next = appendAudit(next, actor, projectId, "SUBSCRIPTION_PAYMENT", null, {
    amount: plan.priceMonthly,
    status: "success",
    transaction_id: transactionId,
  });
  setState(next);
}

/** 해지 예약 — 즉시 종료하지 않고 다음 결제일에 종료된다 */
export function scheduleSubscriptionCancel(
  actor: ActorInfo,
  projectId: string
) {
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  if (project.clientId !== actor.id)
    throw new DomainError("의뢰자만 구독을 해지할 수 있습니다.");
  const subscription = project.subscription;
  if (subscription === null || subscription.status === "terminated")
    throw new DomainError("진행 중인 구독이 없습니다.");
  if (subscription.status === "active_scheduled_cancel")
    throw new DomainError("이미 해지가 예약되어 있습니다.");

  const updated: AsSubscription = {
    ...subscription,
    status: "active_scheduled_cancel",
    cancelledAt: nowIso(),
  };
  let next = replaceProject(current, { ...project, subscription: updated });
  next = appendAudit(
    next,
    actor,
    projectId,
    "SUBSCRIPTION_CANCEL_SCHEDULED",
    { status: subscription.status },
    { status: updated.status, ends_at: subscription.nextBillingDate }
  );
  setState(next);
}

/**
 * 정기 결제 웹훅 처리 — PG사가 보내오는 결제 결과를 반영한다.
 * 성공: 다음 결제일 1개월 연장 (해지 예약이면 종료)
 * 실패: 구독을 일시 중지하고 실패 로그를 남긴다
 */
export function applySubscriptionPayment(
  actor: ActorInfo,
  projectId: string,
  result: { success: boolean; transactionId: string; errorMessage?: string }
) {
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);
  const subscription = project.subscription;
  if (subscription === null) throw new DomainError("구독 정보가 없습니다.");

  const log: AsPaymentLog = {
    id: newId("pay"),
    amount: subscription.priceMonthly,
    status: result.success ? "success" : "failed",
    transactionId: result.transactionId,
    errorMessage: result.errorMessage ?? null,
    paidAt: nowIso(),
  };

  let updated: AsSubscription;
  if (!result.success) {
    updated = {
      ...subscription,
      status: "paused",
      payments: [log, ...subscription.payments],
    };
  } else if (subscription.status === "active_scheduled_cancel") {
    updated = {
      ...subscription,
      status: "terminated",
      payments: [log, ...subscription.payments],
    };
  } else {
    updated = {
      ...subscription,
      status: "active",
      nextBillingDate: addMonth(subscription.nextBillingDate),
      payments: [log, ...subscription.payments],
    };
  }

  let next = replaceProject(current, { ...project, subscription: updated });
  next = appendAudit(
    next,
    actor,
    projectId,
    "SUBSCRIPTION_PAYMENT",
    { status: subscription.status },
    {
      status: updated.status,
      amount: log.amount,
      payment: log.status,
      transaction_id: log.transactionId,
    }
  );
  setState(next);
}

/* ------------------------------------------------------------------ */
/* 매칭 적합도 (정밀 매칭)                                              */
/* ------------------------------------------------------------------ */

export interface PartnerProfile {
  id: string;
  name: string;
  specialties: string[];
  completedProjects: number;
}

export const PARTNER_POOL: PartnerProfile[] = [
  { id: "partner-rocket", name: "스튜디오 로켓", specialties: ["웹", "결제", "커머스"], completedProjects: 14 },
  { id: "partner-lumen", name: "루멘랩스", specialties: ["웹", "어드민", "AI"], completedProjects: 9 },
  { id: "partner-orbit", name: "오르빗웍스", specialties: ["모바일", "웹"], completedProjects: 21 },
];

/** 프로젝트 기술 태그와 파트너 전문 분야의 겹침 기반 적합도(%) */
export function calcMatchScore(
  project: Project,
  partner: PartnerProfile
): number {
  if (project.techTags.length === 0) return 50;
  const overlap = project.techTags.filter((t) =>
    partner.specialties.some((s) => s.includes(t) || t.includes(s))
  ).length;
  const base = (overlap / project.techTags.length) * 70;
  const experience = Math.min(partner.completedProjects, 20) * 1.5;
  return Math.min(99, Math.round(base + experience));
}

/* ------------------------------------------------------------------ */
/* RAG 지식 베이스                                                      */
/* ------------------------------------------------------------------ */

/** 문서를 열람할 수 있는가 — 상세 스펙과 같은 NDA 게이트 */
export function canViewKnowledge(actor: ActorInfo, project: Project): boolean {
  return canViewSpecDetail(actor, project);
}

/** 문서를 올리거나 지울 수 있는가 — 의뢰자와 운영사만 */
export function canManageKnowledge(
  actor: ActorInfo,
  project: Project
): boolean {
  if (actor.role === "admin") return true;
  return actor.role === "client" && project.clientId === actor.id;
}

export interface KnowledgeUpload {
  name: string;
  size: number;
  text: string;
}

/**
 * 문서 업로드 → 청킹까지. 임베딩은 아직 생성하지 않으므로 상태는
 * processing("청킹 완료 · 임베딩 대기")에 머문다. DB도 같은 규칙이라,
 * 임베딩이 비어 있는 문서는 indexed 로 전이되지 않는다.
 */
export function uploadKnowledgeDocument(
  actor: ActorInfo,
  projectId: string,
  file: KnowledgeUpload
): RagDocument {
  const current = domainStore.getSnapshot();
  const project = findProject(current, projectId);

  if (!canManageKnowledge(actor, project)) {
    throw new DomainError("이 프로젝트에 문서를 올릴 권한이 없어요.");
  }

  const validation = validateUpload({ name: file.name, size: file.size });
  if (!validation.ok) {
    throw new DomainError(validation.reason);
  }

  const duplicated = current.ragDocuments.some(
    (doc) => doc.projectId === projectId && doc.title === file.name
  );
  if (duplicated) {
    throw new DomainError("같은 이름의 문서가 이미 있어요.");
  }

  const contents = chunkText(file.text);
  if (contents.length === 0) {
    throw new DomainError("문서에서 읽어낼 내용이 없어요.");
  }

  const documentId = newId("ragdoc");
  const chunks: RagChunk[] = contents.map((content, index) => ({
    id: newId("ragchunk"),
    documentId,
    chunkIndex: index,
    content,
    tokenCount: estimateTokens(content),
    // 임베딩 API 연결 전까지 비워 둔다
    embedding: null,
  }));

  const document: RagDocument = {
    id: documentId,
    projectId,
    title: file.name,
    sourceType: validation.sourceType,
    byteSize: file.size,
    chunkCount: chunks.length,
    status: "processing",
    errorMessage: null,
    uploadedBy: actor.id,
    uploaderName: actor.name,
    createdAt: nowIso(),
  };

  let next: DomainState = {
    ...current,
    ragDocuments: [document, ...current.ragDocuments],
    ragChunks: [...current.ragChunks, ...chunks],
  };
  next = appendAudit(next, actor, projectId, "RAG_DOCUMENT_UPLOADED", null, {
    title: document.title,
    source_type: document.sourceType,
    byte_size: document.byteSize,
  });
  next = appendAudit(next, actor, projectId, "RAG_DOCUMENT_CHUNKED", null, {
    title: document.title,
    chunk_count: chunks.length,
    embedded_count: 0,
  });
  setState(next);

  return document;
}

export function deleteKnowledgeDocument(actor: ActorInfo, documentId: string) {
  const current = domainStore.getSnapshot();
  const document = current.ragDocuments.find((doc) => doc.id === documentId);
  if (document === undefined) {
    throw new DomainError("문서를 찾을 수 없어요.");
  }

  const project = findProject(current, document.projectId);
  if (!canManageKnowledge(actor, project)) {
    throw new DomainError("이 문서를 지울 권한이 없어요.");
  }

  let next: DomainState = {
    ...current,
    ragDocuments: current.ragDocuments.filter((doc) => doc.id !== documentId),
    ragChunks: current.ragChunks.filter((c) => c.documentId !== documentId),
  };
  next = appendAudit(
    next,
    actor,
    document.projectId,
    "RAG_DOCUMENT_DELETED",
    { title: document.title, chunk_count: document.chunkCount },
    null
  );
  setState(next);
}

export type KnowledgeSearchMode = "keyword" | "semantic";

export interface KnowledgeSearchResult {
  mode: KnowledgeSearchMode;
  hits: RagSearchHit[];
}

/**
 * 프로젝트 범위 검색.
 * 임베딩이 채워지면 mode 가 semantic 으로 바뀌고 화면은 그대로 쓰인다
 * (DB의 rag_search_keyword → rag_search_semantic 전환과 같은 구조).
 */
export function searchKnowledge(
  state: DomainState,
  projectId: string,
  query: string,
  limit = 5
): KnowledgeSearchResult {
  const chunks = state.ragChunks.filter((chunk) =>
    state.ragDocuments.some(
      (doc) => doc.id === chunk.documentId && doc.projectId === projectId
    )
  );
  const titleOf = (documentId: string): string =>
    state.ragDocuments.find((doc) => doc.id === documentId)?.title ?? "알 수 없는 문서";

  return {
    mode: hasEmbeddings(chunks) ? "semantic" : "keyword",
    hits: searchChunks(chunks, titleOf, query, limit),
  };
}

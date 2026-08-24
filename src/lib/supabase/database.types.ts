/**
 * supabase/migrations 의 스키마에 대응하는 타입.
 * `supabase gen types typescript` 로 생성하는 것과 같은 형태이며,
 * 스키마를 바꾸면 이 파일도 함께 갱신해야 한다.
 */

export type MilestonePhaseColumn = 1 | 2 | 3;

export type UserRole = "client" | "partner" | "admin";
export type ProjectStatusRow =
  | "draft"
  | "bidding"
  | "active"
  | "completed"
  | "disputed";
export type SpecTaskStatusRow = "todo" | "in_progress" | "done";
export type BidStatusRow = "draft" | "submitted" | "accepted" | "rejected";
export type MilestoneStatusRow =
  | "pending"
  | "escrow_deposited"
  | "inspection_requested"
  | "released"
  | "override_settled"
  | "override_refunded";
export type AsTierRow = "light" | "standard" | "premium";
export type AsSubscriptionStatusRow =
  | "active"
  | "active_scheduled_cancel"
  | "paused"
  | "terminated";
export type AsPaymentStatusRow = "success" | "failed";
export type AuditActionTypeRow =
  | "PROJECT_CREATED"
  | "NDA_SIGNED"
  | "BID_SUBMITTED"
  | "BID_ACCEPTED"
  | "CONTRACT_CREATED"
  | "ESCROW_DEPOSITED"
  | "TASK_STATUS_UPDATE"
  | "MILESTONE_INSPECTION_REQUESTED"
  | "MILESTONE_INSPECTION_REJECTED"
  | "MILESTONE_RELEASED"
  | "DISPUTE_RAISED"
  | "ADMIN_OVERRIDE_SETTLE"
  | "ADMIN_OVERRIDE_REFUND"
  | "SUBSCRIPTION_STARTED"
  | "SUBSCRIPTION_PAYMENT"
  | "SUBSCRIPTION_CANCEL_SCHEDULED";

export interface ProfileRow {
  id: string;
  name: string;
  company: string | null;
  role: UserRole;
  tech_tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  title: string;
  summary: string;
  client_id: string;
  tech_tags: string[];
  spec_markdown: string;
  mermaid_code: string;
  status: ProjectStatusRow;
  dispute_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpecEpicRow {
  id: string;
  project_id: string;
  title: string;
  sort_order: number;
}

export interface SpecFeatureRow {
  id: string;
  epic_id: string;
  title: string;
  sort_order: number;
}

export interface SpecTaskRow {
  id: string;
  feature_id: string;
  project_id: string;
  title: string;
  description: string;
  milestone_phase: MilestonePhaseColumn;
  node_id: string | null;
  status: SpecTaskStatusRow;
  estimated_md: number;
  sort_order: number;
  updated_at: string;
}

export interface ProjectNdaRow {
  id: string;
  project_id: string;
  user_id: string;
  signer_name: string;
  signer_company: string;
  signed_at: string;
}

export interface BidRow {
  id: string;
  project_id: string;
  partner_id: string;
  total_amount: number;
  total_man_days: number;
  status: BidStatusRow;
  tech_score: number;
  comm_score: number;
  portfolio_score: number;
  created_at: string;
  updated_at: string;
}

export interface BidItemRow {
  id: string;
  bid_id: string;
  task_id: string;
  man_day: number;
  unit_price: number;
  estimation_basis: string | null;
  /** man_day × unit_price 생성 컬럼 — 쓰기 불가 */
  amount: number;
}

export interface ContractRow {
  id: string;
  project_id: string;
  bid_id: string;
  partner_id: string;
  total_amount: number;
  signed_at: string;
}

export interface MilestoneRow {
  id: string;
  project_id: string;
  contract_id: string;
  phase: MilestonePhaseColumn;
  ratio: number;
  amount: number;
  status: MilestoneStatusRow;
  inspection_notes: string | null;
  reject_reason: string | null;
  updated_at: string;
}

export interface AsSubscriptionRow {
  id: string;
  project_id: string;
  tier: AsTierRow;
  status: AsSubscriptionStatusRow;
  billing_key: string;
  card_label: string;
  price_monthly: number;
  next_billing_date: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AsPaymentLogRow {
  id: string;
  subscription_id: string;
  amount: number;
  status: AsPaymentStatusRow;
  transaction_id: string;
  error_message: string | null;
  paid_at: string;
}

export interface SystemAuditLogRow {
  id: string;
  project_id: string;
  actor_id: string | null;
  actor_name: string;
  action_type: AuditActionTypeRow;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

/** 서버가 기본값을 채워주는 컬럼은 삽입 시 생략할 수 있다 */
type Insertable<Row, Optional extends keyof Row> = Omit<Row, Optional> &
  Partial<Pick<Row, Optional>>;

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<
        ProfileRow,
        Insertable<ProfileRow, "company" | "role" | "tech_tags" | "created_at" | "updated_at">,
        Partial<ProfileRow>
      >;
      projects: TableDef<
        ProjectRow,
        Insertable<
          ProjectRow,
          | "id"
          | "summary"
          | "tech_tags"
          | "spec_markdown"
          | "mermaid_code"
          | "status"
          | "dispute_reason"
          | "created_at"
          | "updated_at"
        >,
        Partial<ProjectRow>
      >;
      spec_epics: TableDef<
        SpecEpicRow,
        Insertable<SpecEpicRow, "id" | "sort_order">,
        Partial<SpecEpicRow>
      >;
      spec_features: TableDef<
        SpecFeatureRow,
        Insertable<SpecFeatureRow, "id" | "sort_order">,
        Partial<SpecFeatureRow>
      >;
      spec_tasks: TableDef<
        SpecTaskRow,
        Insertable<
          SpecTaskRow,
          | "id"
          | "project_id"
          | "description"
          | "node_id"
          | "status"
          | "estimated_md"
          | "sort_order"
          | "updated_at"
        >,
        Partial<SpecTaskRow>
      >;
      project_ndas: TableDef<
        ProjectNdaRow,
        Insertable<ProjectNdaRow, "id" | "signed_at">,
        Partial<ProjectNdaRow>
      >;
      bids: TableDef<
        BidRow,
        Insertable<
          BidRow,
          | "id"
          | "total_amount"
          | "total_man_days"
          | "status"
          | "tech_score"
          | "comm_score"
          | "portfolio_score"
          | "created_at"
          | "updated_at"
        >,
        Partial<BidRow>
      >;
      bid_items: TableDef<
        BidItemRow,
        // amount 는 생성 컬럼이라 삽입할 수 없다
        Insertable<Omit<BidItemRow, "amount">, "id" | "estimation_basis">,
        Partial<Omit<BidItemRow, "amount">>
      >;
      contracts: TableDef<
        ContractRow,
        Insertable<ContractRow, "id" | "signed_at">,
        Partial<ContractRow>
      >;
      milestones: TableDef<
        MilestoneRow,
        Insertable<
          MilestoneRow,
          "id" | "status" | "inspection_notes" | "reject_reason" | "updated_at"
        >,
        Partial<MilestoneRow>
      >;
      as_subscriptions: TableDef<
        AsSubscriptionRow,
        Insertable<
          AsSubscriptionRow,
          "id" | "status" | "cancelled_at" | "created_at" | "updated_at"
        >,
        Partial<AsSubscriptionRow>
      >;
      as_payment_logs: TableDef<
        AsPaymentLogRow,
        Insertable<AsPaymentLogRow, "id" | "error_message" | "paid_at">,
        Partial<AsPaymentLogRow>
      >;
      system_audit_logs: TableDef<
        SystemAuditLogRow,
        Insertable<
          SystemAuditLogRow,
          "id" | "before_state" | "after_state" | "created_at"
        >,
        // 감사 로그는 추가 전용이라 UPDATE 형태를 노출하지 않는다
        never
      >;
    };
  };
}

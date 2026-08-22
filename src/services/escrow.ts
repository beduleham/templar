/**
 * 에스크로/정산 게이트웨이 추상화.
 *
 * MVP는 MockEscrowService로 동작하며, 실제 PG사(토스페이먼츠·포트원 등)
 * 연동 시 같은 인터페이스를 구현한 어댑터로 교체한다.
 * 카드번호·CVC 등 민감 금융 정보는 어떤 구현체에서도 플랫폼에 저장하지 않는다.
 */

export interface EscrowResult {
  success: boolean;
  /** PG사 거래 고유 ID */
  transactionId: string;
  message: string;
}

export interface BillingKeyResult {
  billingKey: string;
  /** 마스킹된 카드 표기 — 원본 카드 정보는 PG사에만 존재한다 */
  cardLabel: string;
}

export interface EscrowService {
  /** 마일스톤 대금 예치 */
  deposit(milestoneId: string, amount: number): Promise<EscrowResult>;
  /** 파트너에게 정산 지급 */
  settle(milestoneId: string, amount: number): Promise<EscrowResult>;
  /** 의뢰자에게 환불 */
  refund(milestoneId: string, amount: number): Promise<EscrowResult>;
  /** 정기 결제용 빌링키 발급 (카드 등록창 대체) */
  issueBillingKey(customerId: string): Promise<BillingKeyResult>;
  /** 빌링키로 정기 결제 청구 */
  charge(billingKey: string, amount: number): Promise<EscrowResult>;
}

let mockSeq = 0;
function mockTid(prefix: string): string {
  mockSeq += 1;
  return `${prefix}_${mockSeq.toString().padStart(8, "0")}`;
}

/** MVP용 모의 구현 — 항상 성공하며 거래 ID만 발급한다 */
export const mockEscrowService: EscrowService = {
  async deposit(milestoneId, amount) {
    return {
      success: true,
      transactionId: mockTid("dep"),
      message: `${amount}원이 에스크로에 예치되었습니다.`,
    };
  },
  async settle(milestoneId, amount) {
    return {
      success: true,
      transactionId: mockTid("stl"),
      message: `${amount}원이 파트너에게 정산되었습니다.`,
    };
  },
  async refund(milestoneId, amount) {
    return {
      success: true,
      transactionId: mockTid("rfd"),
      message: `${amount}원이 의뢰자에게 환불되었습니다.`,
    };
  },
  async issueBillingKey(customerId) {
    return {
      billingKey: `bkey_${customerId}_${mockTid("bk")}`,
      cardLabel: "신한카드 ****-1234",
    };
  },
  async charge(billingKey, amount) {
    return {
      success: true,
      transactionId: mockTid("chg"),
      message: `${amount}원이 결제되었습니다.`,
    };
  },
};

export const escrowService: EscrowService = mockEscrowService;

// 심의서 초안 생성 서비스.
//
// 백엔드 도입 시 이 함수를 Gemini 호출(response_mime_type: "application/json",
// 현행 안정 모델 — 스펙의 gemini-1.5-*는 단종)로 교체한다. 시스템 프롬프트는
// 스펙의 4개 항목 JSON 스키마를 강제하며, 금액 수치는 프롬프트에 주입된
// 계산값만 사용한다. 본 Mock 역시 전달받은 교구 메타데이터와 계산된 수치만
// 사용해 환각 없이 작성한다.

import {
  budgetUsageRate,
  deliberationTotal,
  type DeliberationReportRequest,
  type DeliberationReportResponse,
} from '../lib/deliberation'
import { formatKrw } from '../lib/quotation'

const MOCK_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 1000

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function generateDeliberationReport(
  request: DeliberationReportRequest,
): Promise<DeliberationReportResponse> {
  if (request.selectedItems.length === 0) {
    throw new Error('심의 대상 교구가 없습니다')
  }
  await delay(MOCK_DELAY_MS)

  const items = request.selectedItems
  const itemNames = items.map((i) => `'${i.itemName}'`).join(', ')
  const areas = [...new Set(items.map((i) => i.curriculumArea).filter(Boolean))]
  const totalCost = deliberationTotal(items)
  const rate = budgetUsageRate(totalCost, request.totalBudget)

  const introductionPurpose =
    `본 학급(${request.targetAge}, 원아 ${request.classSize}명)의 교육과정 운영 내실화를 위해 ` +
    `${itemNames} 총 ${items.length}종의 교재·교구 도입을 신청합니다. ` +
    `해당 교구는 현재 진행 중인 누리과정 연계 활동에 직접 활용될 예정으로, ` +
    `유아의 발달 수준에 적합한 놀이 중심 교육 환경을 조성하는 데 필요합니다.`

  const curriculumConnection =
    `신청 교구는 누리과정 ${areas.join(', ')} 영역과 직접 연계됩니다. ` +
    items
      .map(
        (i) =>
          `'${i.itemName}'은(는) ${i.curriculumArea} 영역 활동에 활용되며, ${i.description}`,
      )
      .join(' ') +
    ` 이를 통해 영역별 성취 기준에 부합하는 균형 있는 발달을 지원할 수 있습니다.`

  const budgetFeasibility =
    `총 소요 금액은 ${formatKrw(totalCost)}으로, 배정 예산 ${formatKrw(request.totalBudget)}` +
    (rate !== null ? ` 대비 약 ${rate}% 수준` : '') +
    `입니다. ` +
    (rate !== null && rate <= 100
      ? '배정 예산 범위 내에서 집행 가능하며, '
      : '예산 조정 협의가 필요하나, ') +
    `신청 교구는 소모성 재료가 아닌 다회성 활용이 가능한 품목 중심으로 구성되어 ` +
    `학기 전반에 걸쳐 반복 사용 시 원아 1인당 비용 효율이 높습니다.`

  const expectedEffect =
    `원아 측면에서는 ${areas.join('·')} 영역의 흥미 유발과 주도적 탐구 기회가 확대되고, ` +
    `교사 측면에서는 활동 준비 시간이 단축되어 상호작용의 질이 향상될 것으로 기대됩니다. ` +
    `또한 계획-실행-평가로 이어지는 보육 과정의 일관성이 강화되어 학부모 만족도 제고에 기여할 것입니다.`

  return {
    introductionPurpose,
    curriculumConnection,
    budgetFeasibility,
    expectedEffect,
  }
}

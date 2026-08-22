import type {
  MilestonePhase,
  SpecEpic,
  SpecTask,
} from "@/lib/domain/types";

/**
 * 대화형 Q&A 질문 정의.
 * 실제 서비스에서는 Vercel AI SDK가 이전 답변을 기반으로 다음 질문을
 * 동적 생성한다 — 본 단계에서는 마스터 스펙의 질문 템플릿을 정적으로 제공하고,
 * LLM 연동 태스크에서 /api/spec/generate 로 교체한다.
 */
export interface SpecQuestion {
  id: string;
  question: string;
  placeholder: string;
  suggestions: string[];
}

export const SPEC_QUESTIONS: SpecQuestion[] = [
  {
    id: "service",
    question: "어떤 서비스를 만들고 싶으신가요? 한 문장으로 알려주세요.",
    placeholder: "예: 반려동물 돌봄 예약 서비스",
    suggestions: ["예약·중개 플랫폼", "구독형 커머스", "사내 업무 시스템"],
  },
  {
    id: "users",
    question: "주로 어떤 분들이 사용하게 되나요?",
    placeholder: "예: 반려동물을 키우는 30대 직장인",
    suggestions: ["일반 소비자", "우리 회사 직원", "소상공인 사장님"],
  },
  {
    id: "features",
    question: "꼭 필요한 핵심 기능을 쉼표로 나눠 적어주세요.",
    placeholder: "예: 예약, 결제, 후기 작성",
    suggestions: ["예약, 결제, 알림", "상품 등록, 주문 관리", "게시판, 채팅"],
  },
  {
    id: "auth",
    question: "회원 가입은 어떤 방식이 좋을까요?",
    placeholder: "예: 카카오 간편 로그인",
    suggestions: ["카카오·네이버 간편 로그인", "이메일 가입", "둘 다"],
  },
  {
    id: "payment",
    question: "서비스 안에서 결제가 필요한가요?",
    placeholder: "예: 네, 카드 결제가 필요해요",
    suggestions: ["네, 필요해요", "아니요, 필요 없어요"],
  },
  {
    id: "data",
    question: "쌓이는 정보 중 가장 중요한 것은 무엇인가요?",
    placeholder: "예: 예약 내역과 고객 정보",
    suggestions: ["주문·예약 내역", "회원 정보", "콘텐츠·게시글"],
  },
  {
    id: "admin",
    question: "운영자가 관리 화면에서 무엇을 하면 좋을까요?",
    placeholder: "예: 예약 현황 확인과 정산 관리",
    suggestions: ["현황 대시보드", "회원·주문 관리", "필요 없어요"],
  },
  {
    id: "timeline",
    question: "언제까지 첫 버전이 필요하신가요?",
    placeholder: "예: 3개월 안에",
    suggestions: ["1~2개월", "3개월", "6개월 이내"],
  },
];

export interface QnaAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface GeneratedSpec {
  title: string;
  summary: string;
  specMarkdown: string;
  mermaidCode: string;
  epics: SpecEpic[];
  techTags: string[];
}

/** 생성 대기 화면의 단계 메시지 (마스터 스펙 UX 원칙) */
export const GENERATION_STAGES = [
  "요구사항 분석 중...",
  "시스템 아키텍처 설계 중...",
  "개발 태스크 분할 중...",
] as const;

function parseFeatures(featuresAnswer: string): string[] {
  const parsed = featuresAnswer
    .split(/[,、·]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 4);
  return parsed.length > 0 ? parsed : ["핵심 기능"];
}

function answerOf(answers: QnaAnswer[], id: string): string {
  return answers.find((a) => a.questionId === id)?.answer.trim() ?? "";
}

let taskSeq = 0;
function taskId(prefix: string): string {
  taskSeq += 1;
  return `${prefix}-${taskSeq}`;
}

function makeTask(
  title: string,
  description: string,
  phase: MilestonePhase,
  nodeId: string | null,
  estimatedMd: number
): SpecTask {
  return {
    id: taskId("task"),
    title,
    description,
    milestonePhase: phase,
    nodeId,
    status: "todo",
    estimatedMd,
  };
}

/**
 * 결정적 스펙 생성기.
 * 동일 답변 → 동일 결과. Mermaid 노드 ID는 태스크의 nodeId와 1:1로 일치시켜
 * 공정판의 노드 색상 동기화가 보장된다.
 */
export function generateSpecFromAnswers(answers: QnaAnswer[]): GeneratedSpec {
  taskSeq = 0;
  const service = answerOf(answers, "service") || "새 서비스";
  const users = answerOf(answers, "users") || "일반 사용자";
  const features = parseFeatures(answerOf(answers, "features"));
  const needsPayment = /네|필요|카드|결제/.test(answerOf(answers, "payment"));
  const needsAdmin = !/없/.test(answerOf(answers, "admin") || "현황");
  const authAnswer = answerOf(answers, "auth") || "이메일 가입";

  const title = service.replace(/를?\s*만들고\s*싶.*$/, "").slice(0, 40);
  const summary = `${users}를 위한 ${title} — ${features.join(", ")} 기능을 제공합니다.`;

  // Mermaid 노드 정의 (노드 ID는 영숫자만 사용 — 렌더링 안정성 규칙)
  const featureNodes = features.map((f, i) => ({
    id: `feat${i + 1}`,
    apiId: `api${i + 1}`,
    label: f,
  }));

  const mermaidLines: string[] = [
    "graph TD",
    '  subgraph client["사용자 화면"]',
    '    web["웹 앱 (반응형)"]',
    ...featureNodes.map((n) => `    ${n.id}["${n.label} 화면"]`),
    "  end",
    '  subgraph server["서비스 로직"]',
    '    auth["로그인/회원"]',
    ...featureNodes.map((n) => `    ${n.apiId}["${n.label} 처리"]`),
    ...(needsPayment ? ['    pay["결제 처리"]'] : []),
    "  end",
    '  subgraph data["데이터 저장소"]',
    '    db[("메인 데이터베이스")]',
    "  end",
    ...(needsAdmin ? ['  admin["운영자 관리 화면"]'] : []),
    "  web --> auth",
    ...featureNodes.map((n) => `  ${n.id} --> ${n.apiId}`),
    "  auth --> db",
    ...featureNodes.map((n) => `  ${n.apiId} --> db`),
    ...(needsPayment ? ["  pay --> db", `  ${featureNodes[0].apiId} --> pay`] : []),
    ...(needsAdmin ? ["  admin --> db"] : []),
  ];

  // 계층적 태스크: Epic(마일스톤 단계) > Feature > Task
  const epic1: SpecEpic = {
    id: "epic-1",
    title: "1단계 · 기반 구축 (선금 50%)",
    features: [
      {
        id: "feat-base",
        title: "프로젝트 기반",
        tasks: [
          makeTask("화면 뼈대와 디자인 시스템", "반응형 웹 앱 셸과 공통 UI를 만듭니다.", 1, "web", 4),
          makeTask("데이터 저장소 설계", "핵심 정보 구조를 설계하고 저장소를 구축합니다.", 1, "db", 3),
        ],
      },
      {
        id: "feat-auth",
        title: "회원 및 로그인",
        tasks: [
          makeTask(`로그인 구현 (${authAnswer})`, "회원 가입과 로그인 흐름을 완성합니다.", 1, "auth", 3),
        ],
      },
      {
        id: "feat-core1",
        title: `${featureNodes[0].label} 기능`,
        tasks: [
          makeTask(`${featureNodes[0].label} 화면`, `${featureNodes[0].label} 사용자 화면을 만듭니다.`, 1, featureNodes[0].id, 3),
          makeTask(`${featureNodes[0].label} 처리 로직`, `${featureNodes[0].label} 핵심 동작을 구현합니다.`, 1, featureNodes[0].apiId, 4),
        ],
      },
    ],
  };

  const epic2: SpecEpic = {
    id: "epic-2",
    title: "2단계 · 핵심 기능 (중도금 30%)",
    features: featureNodes.slice(1).map((n, i) => ({
      id: `feat-core${i + 2}`,
      title: `${n.label} 기능`,
      tasks: [
        makeTask(`${n.label} 화면`, `${n.label} 사용자 화면을 만듭니다.`, 2, n.id, 3),
        makeTask(`${n.label} 처리 로직`, `${n.label} 핵심 동작을 구현합니다.`, 2, n.apiId, 3),
      ],
    })),
  };
  if (needsPayment) {
    epic2.features.push({
      id: "feat-pay",
      title: "결제",
      tasks: [
        makeTask("결제 연동", "안전한 결제 흐름을 연동합니다.", 2, "pay", 4),
      ],
    });
  }
  if (epic2.features.length === 0) {
    epic2.features.push({
      id: "feat-core-extra",
      title: `${featureNodes[0].label} 고도화`,
      tasks: [
        makeTask(`${featureNodes[0].label} 고도화`, "핵심 기능의 완성도를 높입니다.", 2, featureNodes[0].apiId, 3),
      ],
    });
  }

  const epic3: SpecEpic = {
    id: "epic-3",
    title: "3단계 · 마무리 (잔금 20%)",
    features: [
      ...(needsAdmin
        ? [
            {
              id: "feat-admin",
              title: "운영자 도구",
              tasks: [
                makeTask("운영자 관리 화면", "운영에 필요한 현황판과 관리 기능을 만듭니다.", 3 as MilestonePhase, "admin", 3),
              ],
            },
          ]
        : []),
      {
        id: "feat-qa",
        title: "품질 및 출시",
        tasks: [
          makeTask("통합 점검과 다듬기", "전체 흐름을 점검하고 사용성을 다듬습니다.", 3, null, 2),
          makeTask("출시 준비", "실제 사용 환경에 배포하고 안정화합니다.", 3, null, 2),
        ],
      },
    ],
  };

  const specMarkdown = [
    `# ${title} 개발 명세`,
    "",
    "## 서비스 개요",
    summary,
    "",
    "## 핵심 기능 요구사항",
    ...features.map((f, i) => `${i + 1}. **${f}** — ${users}가 ${f} 기능을 쉽고 빠르게 사용할 수 있어야 합니다.`),
    `${features.length + 1}. **회원/로그인** — ${authAnswer} 방식으로 안전하게 가입하고 로그인합니다.`,
    ...(needsPayment ? [`${features.length + 2}. **결제** — 서비스 내 안전한 결제를 지원합니다.`] : []),
    "",
    "## 비기능 요구사항",
    "- 데스크톱과 모바일을 모두 지원하는 반응형 웹",
    "- 주요 화면 3초 이내 로딩",
    "- 개인정보와 결제 정보의 안전한 처리",
    "",
    "## 답변 요약",
    ...answers.map((a) => `- ${a.question} → ${a.answer}`),
  ].join("\n");

  return {
    title,
    summary,
    specMarkdown,
    mermaidCode: mermaidLines.join("\n"),
    epics: [epic1, epic2, epic3],
    techTags: [
      "웹",
      ...(needsPayment ? ["결제"] : []),
      ...(needsAdmin ? ["어드민"] : []),
      features[0],
    ],
  };
}

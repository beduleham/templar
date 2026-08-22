"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { ArchitectureMap } from "@/components/architecture-map";
import { DraftUploader } from "@/components/spec/draft-uploader";
import { GenerationLoading } from "@/components/spec/generation-loading";
import { MarkdownView } from "@/components/spec/markdown-view";
import { ParsingAnimation } from "@/components/spec/parsing-animation";
import { TaskTree } from "@/components/spec/task-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { useLoadingProgress } from "@/lib/use-loading-progress";
import {
  SPEC_QUESTIONS,
  generateSpecFromAnswers,
  type GeneratedSpec,
  type QnaAnswer,
} from "@/lib/domain/spec-engine";
import { createProjectFromSpec } from "@/lib/domain/store";

type Step = "intro" | "qna" | "upload" | "parsing" | "generating" | "result";

const GENERATION_MS = 4200;
const PARSING_MS = 5200;

/**
 * 대화형 AI 스펙 생성기.
 * 현재는 결정적 Mock 엔진(@/lib/domain/spec-engine)으로 생성하며,
 * LLM 연동 시 /api/spec/generate (Vercel AI SDK streamObject)로 교체된다.
 */
export default function SpecGeneratorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role ?? "client";

  const [step, setStep] = React.useState<Step>("intro");
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<QnaAnswer[]>([]);
  const [input, setInput] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [result, setResult] = React.useState<GeneratedSpec | null>(null);
  const [ready, setReady] = React.useState(false);

  const question = SPEC_QUESTIONS[questionIndex];
  const isBusy = step === "generating" || step === "parsing";
  const { progress, message } = useLoadingProgress(
    isBusy,
    ready,
    step === "parsing" ? PARSING_MS : GENERATION_MS
  );

  // 생성이 끝나면(=ready) 결과 화면으로 넘어간다
  React.useEffect(() => {
    if (step === "generating" && progress >= 100) {
      const timer = setTimeout(() => setStep("result"), 500);
      return () => clearTimeout(timer);
    }
  }, [step, progress]);

  const runGeneration = React.useCallback(
    (finalAnswers: QnaAnswer[], nextStep: "generating" | "parsing") => {
      setReady(false);
      setStep(nextStep);
      // 실제 LLM 호출을 대체하는 비동기 생성 — 완료 신호를 받으면 진행률이 100%로 점프한다
      const timer = setTimeout(() => {
        setResult(generateSpecFromAnswers(finalAnswers));
        setReady(true);
      }, nextStep === "parsing" ? PARSING_MS : GENERATION_MS);
      return () => clearTimeout(timer);
    },
    []
  );

  const submitAnswer = (answer: string) => {
    const trimmed = answer.trim();
    if (trimmed === "") {
      toast.error("답변을 입력해주세요.");
      return;
    }
    const nextAnswers: QnaAnswer[] = [
      ...answers,
      { questionId: question.id, question: question.question, answer: trimmed },
    ];
    setAnswers(nextAnswers);
    setInput("");
    if (questionIndex + 1 < SPEC_QUESTIONS.length) {
      setQuestionIndex(questionIndex + 1);
    } else {
      runGeneration(nextAnswers, "generating");
    }
  };

  const handleUpload = (file: File) => {
    // 기획 초안 파싱 — 실제 구현에서는 Storage 업로드 + 텍스트 추출로 대체
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const uploaded: QnaAnswer[] = [
      { questionId: "service", question: "서비스", answer: baseName },
      { questionId: "users", question: "사용자", answer: "기획 초안에 정의된 사용자" },
      { questionId: "features", question: "기능", answer: "핵심 기능, 회원 관리, 결제" },
      { questionId: "auth", question: "가입", answer: "이메일 가입" },
      { questionId: "payment", question: "결제", answer: "네, 필요해요" },
      { questionId: "data", question: "데이터", answer: "문서에 정의된 데이터" },
      { questionId: "admin", question: "관리", answer: "현황 대시보드" },
      { questionId: "timeline", question: "기한", answer: "3개월" },
    ];
    setFileName(file.name);
    setAnswers(uploaded);
    runGeneration(uploaded, "parsing");
  };

  const saveProject = () => {
    if (result === null || user === null) return;
    const project = createProjectFromSpec(
      { id: user.id, name: user.name, role },
      result
    );
    toast.success("프로젝트가 생성되고 입찰이 시작됐어요.");
    router.push(`/bids/view?id=${project.id}`);
  };

  const restart = () => {
    setStep("intro");
    setAnswers([]);
    setQuestionIndex(0);
    setResult(null);
    setReady(false);
    setFileName("");
  };

  if (role === "partner") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="py-4 text-center">
          <p className="font-bold">AI 스펙 생성은 의뢰자 전용 기능입니다.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            헤더의 역할 전환에서 의뢰자 모드로 변경해 사용해보세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step === "intro") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <span className="bg-vivid-purple mx-auto flex size-14 items-center justify-center rounded-2xl text-white shadow-md">
            <Sparkles className="size-7" />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight lg:text-3xl">
            10분 대화로 개발 명세를 만들어요
          </h2>
          <p className="text-muted-foreground mt-2 text-[15px] font-medium">
            {SPEC_QUESTIONS.length}개의 질문에 답하면 상세 스펙, 시스템 설계도,
            개발 태스크가 자동으로 만들어집니다.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setStep("qna")}
            className="from-vivid-purple rounded-[28px] bg-gradient-to-br to-[#a78bfa] p-7 text-left text-white shadow-sm transition-transform duration-200 active:scale-[0.98]"
            data-testid="start-qna"
          >
            <Wand2 className="size-7 opacity-90" />
            <p className="mt-4 text-lg font-extrabold">대화로 시작하기</p>
            <p className="mt-1 text-[13px] font-medium text-white/80">
              질문에 하나씩 답하며 만들어요
            </p>
          </button>
          <button
            type="button"
            onClick={() => setStep("upload")}
            className="bg-card rounded-[28px] p-7 text-left shadow-sm transition-transform duration-200 active:scale-[0.98]"
            data-testid="start-upload"
          >
            <FileUp className="text-vivid-blue size-7" />
            <p className="mt-4 text-lg font-extrabold">기획 초안 업로드</p>
            <p className="text-muted-foreground mt-1 text-[13px] font-medium">
              PDF·DOCX·TXT 문서를 분석해요
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (step === "upload") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight">
            기획 초안을 올려주세요
          </h2>
          <p className="text-muted-foreground mt-1.5 text-[15px] font-medium">
            문서를 분석해 개발 명세와 설계도를 자동으로 만들어 드려요.
          </p>
        </div>
        <DraftUploader onAccepted={handleUpload} />
        <Button variant="secondary" className="mt-5" onClick={restart}>
          다른 방법으로 시작하기
        </Button>
      </div>
    );
  }

  if (step === "parsing") {
    return (
      <ParsingAnimation
        fileName={fileName}
        progress={progress}
        onDone={() => setStep("result")}
      />
    );
  }

  if (step === "qna") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <Progress
            value={(questionIndex / SPEC_QUESTIONS.length) * 100}
            className="h-2"
          />
          <span className="text-muted-foreground shrink-0 text-sm font-bold tabular-nums">
            {questionIndex + 1}/{SPEC_QUESTIONS.length}
          </span>
        </div>
        <Card className="mt-5">
          <CardHeader>
            <CardTitle className="text-lg leading-snug">
              {question.question}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAnswer(input);
              }}
              className="flex flex-col gap-4"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={question.placeholder}
                autoFocus
                data-testid="qna-input"
                className="border-input bg-background focus-visible:ring-ring/50 h-12 w-full rounded-2xl border px-4 text-[15px] font-medium outline-none focus-visible:ring-[3px]"
              />
              <div className="flex flex-wrap gap-2">
                {question.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submitAnswer(s)}
                    className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground rounded-full px-4 py-1.5 text-sm font-semibold transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Button type="submit" className="self-end" data-testid="qna-next">
                {questionIndex + 1 === SPEC_QUESTIONS.length
                  ? "스펙 생성하기"
                  : "다음"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "generating") {
    return <GenerationLoading progress={progress} message={message} />;
  }

  if (result === null) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {result.title}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {result.summary}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={restart}>
            다시 만들기
          </Button>
          <Button onClick={saveProject} data-testid="save-project">
            이 스펙으로 입찰 시작하기
          </Button>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">상세 개발 명세</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownView markdown={result.specMarkdown} />
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                시스템 설계도
                <Badge variant="purple">자동 생성</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ArchitectureMap mermaidCode={result.mermaidCode} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                개발 태스크{" "}
                <span className="text-muted-foreground text-sm font-semibold">
                  {result.epics.reduce(
                    (sum, epic) =>
                      sum +
                      epic.features.reduce((s, f) => s + f.tasks.length, 0),
                    0
                  )}
                  개
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskTree epics={result.epics} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

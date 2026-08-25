import { describe, expect, it } from "vitest";

import {
  buildSnippet,
  chunkText,
  detectSourceType,
  estimateTokens,
  hasEmbeddings,
  searchChunks,
  tokenize,
  validateUpload,
  type RagChunk,
} from "./rag";

function chunk(index: number, content: string, embedding: number[] | null = null): RagChunk {
  return {
    id: `chunk-${String(index)}`,
    documentId: "doc-1",
    chunkIndex: index,
    content,
    tokenCount: estimateTokens(content),
    embedding,
  };
}

describe("validateUpload", () => {
  it("지원 형식과 크기를 통과시킨다", () => {
    expect(validateUpload({ name: "요구사항.pdf", size: 1000 })).toEqual({
      ok: true,
      sourceType: "pdf",
    });
  });

  it("지원하지 않는 형식을 거절한다", () => {
    const result = validateUpload({ name: "그림.png", size: 1000 });
    expect(result.ok).toBe(false);
  });

  it("10MB 를 넘으면 거절한다 (DB CHECK 와 같은 한도)", () => {
    const result = validateUpload({ name: "큰문서.pdf", size: 11 * 1024 * 1024 });
    expect(result).toEqual({ ok: false, reason: "파일이 너무 큽니다 (최대 10MB)" });
  });

  it("빈 파일을 거절한다", () => {
    expect(validateUpload({ name: "빈.txt", size: 0 }).ok).toBe(false);
  });

  it("확장자 대소문자를 가리지 않는다", () => {
    expect(detectSourceType("SPEC.MD")).toBe("md");
  });
});

describe("chunkText", () => {
  it("문단 경계를 유지한다", () => {
    const chunks = chunkText("첫 문단입니다.\n\n둘째 문단입니다.", { overlap: 0 });
    expect(chunks).toEqual(["첫 문단입니다.", "둘째 문단입니다."]);
  });

  it("상한을 넘는 문단은 문장 단위로 나눈다", () => {
    const long = "가나다라마바사. ".repeat(20).trim();
    const chunks = chunkText(long, { maxChars: 60, overlap: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const piece of chunks) {
      expect(piece.length).toBeLessThanOrEqual(60);
    }
  });

  it("문장 경계가 없는 긴 텍스트도 상한을 넘기지 않는다", () => {
    const chunks = chunkText("가".repeat(500), { maxChars: 100, overlap: 0 });
    expect(chunks).toHaveLength(5);
    expect(chunks.every((c) => c.length === 100)).toBe(true);
  });

  it("겹침을 주면 앞 청크의 끝이 이어진다", () => {
    const source = "첫 문단입니다.\n\n둘째 문단입니다.";
    const plain = chunkText(source, { overlap: 0 });
    const overlapped = chunkText(source, { overlap: 5 });

    const tail = plain[0].slice(-5);
    expect(overlapped[0]).toBe(plain[0]);
    expect(overlapped[1]).toBe(`${tail} ${plain[1]}`);
  });

  it("빈 문단을 결과에 넣지 않는다", () => {
    expect(chunkText("\n\n  \n\n본문\n\n\n")).toEqual(["본문"]);
  });
});

describe("tokenize", () => {
  it("한글을 2-gram 으로 쪼갠다", () => {
    expect(tokenize("환불")).toEqual(["환불"]);
    expect(tokenize("환불정책")).toEqual(["환불", "불정", "정책"]);
  });

  it("라틴 단어는 그대로 둔다", () => {
    expect(tokenize("Next.js API")).toEqual(["next", "js", "api"]);
  });

  it("구두점과 공백으로 분리한다", () => {
    expect(tokenize("결제, 환불!")).toEqual(["결제", "환불"]);
  });
});

describe("searchChunks", () => {
  const chunks = [
    chunk(0, "예약 신청은 돌봄사 선택과 일정 지정을 거쳐 결제로 이어진다."),
    chunk(1, "결제는 카드 결제와 부분 취소를 지원하며 환불 정책을 따른다."),
    chunk(2, "관리자는 예약 현황 대시보드에서 일별 집계를 확인한다."),
  ];
  const titleOf = () => "요구사항 정의서.pdf";

  it("질의어를 포함한 청크만 돌려준다", () => {
    const hits = searchChunks(chunks, titleOf, "환불");
    expect(hits).toHaveLength(1);
    expect(hits[0].chunk.chunkIndex).toBe(1);
  });

  it("어미가 붙어 있어도 찾아낸다", () => {
    const hits = searchChunks(chunks, titleOf, "환불 정책");
    expect(hits[0].chunk.content).toContain("환불 정책을 따른다");
  });

  it("관련도가 높은 청크를 위로 올린다", () => {
    const hits = searchChunks(chunks, titleOf, "결제");
    expect(hits[0].chunk.chunkIndex).toBe(1);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it("결과 수를 제한한다", () => {
    expect(searchChunks(chunks, titleOf, "예약", 1)).toHaveLength(1);
  });

  it("일치하는 것이 없으면 빈 배열을 준다", () => {
    expect(searchChunks(chunks, titleOf, "블록체인")).toEqual([]);
  });

  it("빈 질의에 결과를 만들어내지 않는다", () => {
    expect(searchChunks(chunks, titleOf, "   ")).toEqual([]);
  });

  it("문서 제목을 결과에 담는다", () => {
    expect(searchChunks(chunks, titleOf, "예약")[0].documentTitle).toBe(
      "요구사항 정의서.pdf",
    );
  });
});

describe("buildSnippet", () => {
  it("매칭 구간만 hit 로 표시한다", () => {
    const segments = buildSnippet("환불 정책을 따른다", ["환불"]);
    expect(segments.filter((s) => s.hit).map((s) => s.text)).toEqual(["환불"]);
  });

  it("겹치는 2-gram 매칭을 하나로 합친다", () => {
    const segments = buildSnippet("환불정책 안내", ["환불", "불정", "정책"]);
    const hits = segments.filter((s) => s.hit);
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toBe("환불정책");
  });

  it("원문을 손실 없이 이어붙일 수 있다", () => {
    const content = "예약 신청은 결제로 이어진다";
    const segments = buildSnippet(content, ["결제"]);
    expect(segments.map((s) => s.text).join("")).toBe(content);
  });

  it("긴 본문은 매칭 위치 주변만 잘라내고 말줄임을 붙인다", () => {
    const content = `${"앞부분 ".repeat(40)}핵심키워드${" 뒷부분".repeat(40)}`;
    const segments = buildSnippet(content, ["핵심"], 100);
    const text = segments.map((s) => s.text).join("");

    expect(text).toContain("핵심");
    expect(text.startsWith("… ")).toBe(true);
    expect(text.endsWith(" …")).toBe(true);
  });
});

describe("hasEmbeddings", () => {
  it("임베딩이 하나도 없으면 false", () => {
    expect(hasEmbeddings([chunk(0, "본문")])).toBe(false);
  });

  it("임베딩이 채워지면 true — 화면이 의미 검색 모드로 전환된다", () => {
    expect(hasEmbeddings([chunk(0, "본문", [0.1, 0.2])])).toBe(true);
  });
});

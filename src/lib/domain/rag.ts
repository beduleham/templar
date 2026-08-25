/**
 * RAG 지식 베이스 — 청킹과 검색.
 *
 * 임베딩은 아직 연결되지 않았다. 그래서 검색은 BM25 키워드 랭킹으로 동작한다.
 * 임베딩 API를 붙이면 `RagChunk.embedding` 이 채워지고 검색만 코사인 유사도로
 * 바뀐다 — 청킹·스니펫·화면은 그대로 재사용된다.
 * (DB 쪽도 같은 구조다: rag_search_keyword → rag_search_semantic)
 */

export type RagSourceType = "pdf" | "docx" | "txt" | "md";

export type RagDocumentStatus = "pending" | "processing" | "indexed" | "failed";

export interface RagChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  /** 대략적인 토큰 수 — 비용 추정용이며 정확한 토크나이저가 아니다 */
  tokenCount: number;
  /** 임베딩 API 연결 전까지 null */
  embedding: number[] | null;
}

export interface RagDocument {
  id: string;
  projectId: string;
  title: string;
  sourceType: RagSourceType;
  byteSize: number;
  chunkCount: number;
  status: RagDocumentStatus;
  errorMessage: string | null;
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
}

export const RAG_MAX_BYTES = 10 * 1024 * 1024;

export const RAG_ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;

export const RAG_SOURCE_LABELS: Record<RagSourceType, string> = {
  pdf: "PDF",
  docx: "Word",
  txt: "텍스트",
  md: "마크다운",
};

export const RAG_STATUS_LABELS: Record<RagDocumentStatus, string> = {
  pending: "업로드됨",
  // 청킹은 끝났고 임베딩만 남은 상태. 이 상태에서도 키워드 검색은 동작한다.
  processing: "청킹 완료 · 임베딩 대기",
  indexed: "의미 검색 가능",
  failed: "처리 실패",
};

/** 청킹 기본값 — 문단을 살리면서 임베딩 입력 길이에 맞춘다 */
export const CHUNK_MAX_CHARS = 480;
export const CHUNK_OVERLAP_CHARS = 60;

export function detectSourceType(fileName: string): RagSourceType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".md")) return "md";
  return null;
}

export type UploadValidation =
  | { ok: true; sourceType: RagSourceType }
  | { ok: false; reason: string };

export function validateUpload(file: {
  name: string;
  size: number;
}): UploadValidation {
  const sourceType = detectSourceType(file.name);
  if (sourceType === null) {
    return {
      ok: false,
      reason: `지원하지 않는 형식입니다 (${RAG_ACCEPTED_EXTENSIONS.join(", ")} 만 가능)`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, reason: "빈 파일은 업로드할 수 없습니다" };
  }
  if (file.size > RAG_MAX_BYTES) {
    return { ok: false, reason: "파일이 너무 큽니다 (최대 10MB)" };
  }
  return { ok: true, sourceType };
}

/** 한국어 위주라 글자 수 기반으로 대략 추정한다 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 1.8));
}

/**
 * 문단을 우선 유지하고, 한 문단이 상한을 넘으면 문장 단위로 나눈다.
 * 이어지는 청크에는 앞 청크의 끝부분을 겹쳐 문맥이 끊기지 않게 한다.
 */
export function chunkText(
  text: string,
  options: { maxChars?: number; overlap?: number } = {},
): string[] {
  const maxChars = options.maxChars ?? CHUNK_MAX_CHARS;
  const overlap = Math.min(options.overlap ?? CHUNK_OVERLAP_CHARS, maxChars - 1);

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  const pieces: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      pieces.push(paragraph);
      continue;
    }
    // 문장 경계(。.!?)를 우선 쓰고, 그래도 길면 글자 수로 자른다
    const sentences = paragraph.match(/[^.!?。]+[.!?。]?\s*/g) ?? [paragraph];
    let buffer = "";
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length === 0) continue;
      if (buffer.length > 0 && buffer.length + trimmed.length + 1 > maxChars) {
        pieces.push(buffer);
        buffer = "";
      }
      if (trimmed.length > maxChars) {
        for (let i = 0; i < trimmed.length; i += maxChars) {
          pieces.push(trimmed.slice(i, i + maxChars));
        }
        continue;
      }
      buffer = buffer.length > 0 ? `${buffer} ${trimmed}` : trimmed;
    }
    if (buffer.length > 0) pieces.push(buffer);
  }

  if (overlap <= 0 || pieces.length <= 1) return pieces;

  return pieces.map((piece, index) => {
    if (index === 0) return piece;
    const previous = pieces[index - 1];
    const tail = previous.slice(Math.max(0, previous.length - overlap));
    return `${tail} ${piece}`.trim();
  });
}

const CJK = /[ㄱ-ㆎ가-힣一-鿿぀-ヿ]/;

/**
 * 토큰화. 라틴 문자는 단어 단위로, 한글·한자·가나는 2-gram 으로 쪼갠다.
 * 형태소 분석기 없이 "환불 정책" 같은 질의가 "환불 정책을" 에 걸리게 하는 최소 장치다.
 */
export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^0-9a-zㄱ-ㆎ가-힣一-鿿぀-ヿ]+/)
    .filter((w) => w.length > 0);

  const tokens: string[] = [];
  for (const word of words) {
    if (!CJK.test(word)) {
      tokens.push(word);
      continue;
    }
    if (word.length === 1) {
      tokens.push(word);
      continue;
    }
    for (let i = 0; i < word.length - 1; i += 1) {
      tokens.push(word.slice(i, i + 2));
    }
  }
  return tokens;
}

export interface SnippetSegment {
  text: string;
  hit: boolean;
}

export interface RagSearchHit {
  chunk: RagChunk;
  documentId: string;
  documentTitle: string;
  score: number;
  segments: SnippetSegment[];
}

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const SNIPPET_CHARS = 190;

/**
 * BM25 랭킹. 임베딩이 붙기 전까지 쓰는 정직한 키워드 검색이며,
 * 의미가 비슷하지만 표현이 다른 문장은 잡지 못한다.
 */
export function searchChunks(
  chunks: readonly RagChunk[],
  titleOf: (documentId: string) => string,
  query: string,
  limit = 5,
): RagSearchHit[] {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0 || chunks.length === 0) return [];

  const docTokens = chunks.map((chunk) => tokenize(chunk.content));
  const avgLength =
    docTokens.reduce((sum, tokens) => sum + tokens.length, 0) / chunks.length;

  const documentFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    let count = 0;
    for (const tokens of docTokens) {
      if (tokens.includes(term)) count += 1;
    }
    documentFrequency.set(term, count);
  }

  const scored = chunks.map((chunk, index) => {
    const tokens = docTokens[index];
    const length = tokens.length;
    const counts = new Map<string, number>();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }

    let score = 0;
    const matched: string[] = [];
    for (const term of queryTerms) {
      const frequency = counts.get(term) ?? 0;
      if (frequency === 0) continue;
      matched.push(term);
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5));
      const norm =
        frequency * (BM25_K1 + 1) /
        (frequency + BM25_K1 * (1 - BM25_B + (BM25_B * length) / avgLength));
      score += idf * norm;
    }

    return { chunk, score, matched };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex)
    .slice(0, Math.max(1, limit))
    .map((entry) => ({
      chunk: entry.chunk,
      documentId: entry.chunk.documentId,
      documentTitle: titleOf(entry.chunk.documentId),
      score: Math.round(entry.score * 1000) / 1000,
      segments: buildSnippet(entry.chunk.content, entry.matched),
    }));
}

/**
 * 매칭된 구간을 표시한 발췌문. 첫 매칭 위치를 중심으로 잘라내고,
 * 하이라이트할 구간을 segment 로 나눠 돌려준다(화면에서 그대로 렌더).
 */
export function buildSnippet(
  content: string,
  terms: readonly string[],
  maxChars = SNIPPET_CHARS,
): SnippetSegment[] {
  if (terms.length === 0) {
    return [{ text: content.slice(0, maxChars), hit: false }];
  }

  const lower = content.toLowerCase();
  const positions: Array<[number, number]> = [];
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(term, from);
      if (at === -1) break;
      positions.push([at, at + term.length]);
      from = at + 1;
    }
  }
  if (positions.length === 0) {
    return [{ text: content.slice(0, maxChars), hit: false }];
  }

  positions.sort((a, b) => a[0] - b[0]);
  // 겹치거나 맞닿은 구간은 하나로 합친다 (2-gram 이라 자주 겹친다)
  const merged: Array<[number, number]> = [positions[0]];
  for (const [start, end] of positions.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const first = merged[0][0];
  const windowStart = Math.max(0, first - 40);
  const windowEnd = Math.min(content.length, windowStart + maxChars);

  const segments: SnippetSegment[] = [];
  let cursor = windowStart;
  for (const [start, end] of merged) {
    if (end <= windowStart || start >= windowEnd) continue;
    const hitStart = Math.max(start, windowStart);
    const hitEnd = Math.min(end, windowEnd);
    if (hitStart > cursor) {
      segments.push({ text: content.slice(cursor, hitStart), hit: false });
    }
    segments.push({ text: content.slice(hitStart, hitEnd), hit: true });
    cursor = hitEnd;
  }
  if (cursor < windowEnd) {
    segments.push({ text: content.slice(cursor, windowEnd), hit: false });
  }

  if (windowStart > 0) segments.unshift({ text: "… ", hit: false });
  if (windowEnd < content.length) segments.push({ text: " …", hit: false });
  return segments;
}

/** 임베딩이 하나라도 채워졌는지 — 화면의 검색 모드 배지를 결정한다 */
export function hasEmbeddings(chunks: readonly RagChunk[]): boolean {
  return chunks.some((chunk) => chunk.embedding !== null);
}

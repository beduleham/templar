"use client";

import * as React from "react";
import { Database, Info, Layers } from "lucide-react";
import { toast } from "sonner";

import { DocumentList } from "@/components/knowledge/document-list";
import { DocumentUploader } from "@/components/knowledge/document-uploader";
import { KnowledgeSearch } from "@/components/knowledge/knowledge-search";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDomainState } from "@/lib/domain/hooks";
import { hasEmbeddings, type RagSearchHit } from "@/lib/domain/rag";
import {
  DomainError,
  canManageKnowledge,
  canViewKnowledge,
  deleteKnowledgeDocument,
  searchKnowledge,
  uploadKnowledgeDocument,
  type ActorInfo,
  type KnowledgeSearchMode,
} from "@/lib/domain/store";

/**
 * 지식 베이스 — 프로젝트 문서를 올려 청킹하고 검색한다.
 *
 * 임베딩 API가 아직 연결되지 않아 검색은 키워드(BM25) 랭킹으로 동작한다.
 * 임베딩이 채워지면 같은 화면이 의미 검색으로 전환된다.
 */
export default function KnowledgePage() {
  const { user } = useAuth();
  const state = useDomainState();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    null,
  );
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<RagSearchHit[]>([]);
  const [mode, setMode] = React.useState<KnowledgeSearchMode>("keyword");
  const [searched, setSearched] = React.useState(false);

  if (user === null) return null;
  const actor: ActorInfo = { id: user.id, name: user.name, role: user.role };

  // NDA 게이트 — 상세 스펙을 볼 수 있는 프로젝트만 지식 베이스가 열린다
  const visible = state.projects.filter((project) =>
    canViewKnowledge(actor, project),
  );
  const project =
    visible.find((p) => p.id === selectedProjectId) ?? visible[0] ?? null;

  const documents =
    project === null
      ? []
      : state.ragDocuments.filter((doc) => doc.projectId === project.id);
  const chunks = state.ragChunks.filter((chunk) =>
    documents.some((doc) => doc.id === chunk.documentId),
  );
  const embedded = hasEmbeddings(chunks);
  const canManage = project !== null && canManageKnowledge(actor, project);

  const runSearch = () => {
    if (project === null) return;
    const result = searchKnowledge(state, project.id, query);
    setMode(result.mode);
    setHits(result.hits);
    setSearched(true);
  };

  const resetSearch = () => {
    setHits([]);
    setSearched(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">지식 베이스</h1>
        <p className="text-muted-foreground mt-1.5 text-sm font-medium">
          프로젝트 문서를 올려두면 청킹해 보관하고, 질문으로 해당 대목을 바로
          찾아냅니다.
        </p>
      </header>

      {/* 임베딩 연결 상태 — 현재 무엇으로 동작 중인지 감추지 않는다 */}
      <Card
        data-testid="embedding-status"
        className={embedded ? "bg-vivid-mint/8" : "bg-vivid-purple/8"}
      >
        <CardContent className="flex items-start gap-3.5 py-5">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-2xl text-white ${
              embedded ? "bg-vivid-mint" : "bg-vivid-purple"
            }`}
          >
            <Info className="size-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold">
              {embedded
                ? "임베딩 연결됨 — 의미 검색으로 동작합니다"
                : "임베딩 미연결 — 키워드 검색으로 동작합니다"}
            </p>
            <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed font-medium">
              {embedded
                ? "청크 임베딩이 채워져 있어 표현이 달라도 의미가 가까운 대목을 찾습니다."
                : "문서 업로드·청킹·검색·접근 통제는 모두 동작합니다. 임베딩 API를 연결하면 같은 화면이 의미 검색으로 바뀌고, 표현이 달라도 찾아냅니다."}
            </p>
          </div>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="text-sm font-bold">열람 가능한 프로젝트가 없어요</p>
            <p className="text-muted-foreground mt-1.5 text-[13px] font-medium">
              NDA에 서명한 프로젝트의 지식 베이스만 열립니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {visible.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {visible.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={item.id === project?.id ? "default" : "secondary"}
                  data-testid={`knowledge-project-${item.id}`}
                  onClick={() => {
                    setSelectedProjectId(item.id);
                    resetSearch();
                  }}
                >
                  {item.title}
                </Button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col gap-4 py-6">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-extrabold">
                    <Database className="text-vivid-blue size-4.5" />
                    문서 {documents.length}건
                  </h2>
                  <Badge className="bg-muted text-muted-foreground tabular-nums">
                    <Layers className="size-3" />
                    청크 {chunks.length}개
                  </Badge>
                </div>

                {canManage ? (
                  <DocumentUploader
                    disabled={project === null}
                    onAccepted={(file) => {
                      if (project === null) return;
                      try {
                        const created = uploadKnowledgeDocument(
                          actor,
                          project.id,
                          file,
                        );
                        toast.success(
                          `'${created.title}' 청킹 완료 — 청크 ${String(created.chunkCount)}개`,
                        );
                        resetSearch();
                      } catch (error) {
                        toast.error(
                          error instanceof DomainError
                            ? error.message
                            : "업로드에 실패했어요.",
                        );
                      }
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground rounded-2xl bg-muted px-4 py-3 text-[13px] font-semibold">
                    문서 업로드는 의뢰자와 운영사만 할 수 있어요.
                  </p>
                )}

                <DocumentList
                  documents={documents}
                  canManage={canManage}
                  onDelete={(documentId) => {
                    try {
                      deleteKnowledgeDocument(actor, documentId);
                      toast.success("문서를 삭제했어요.");
                      resetSearch();
                    } catch (error) {
                      toast.error(
                        error instanceof DomainError
                          ? error.message
                          : "삭제에 실패했어요.",
                      );
                    }
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-4 py-6">
                <h2 className="text-base font-extrabold">문서 검색</h2>
                <KnowledgeSearch
                  mode={mode}
                  hits={hits}
                  query={query}
                  searched={searched}
                  disabled={chunks.length === 0}
                  onQueryChange={(value) => {
                    setQuery(value);
                    if (value.trim().length === 0) resetSearch();
                  }}
                  onSearch={runSearch}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

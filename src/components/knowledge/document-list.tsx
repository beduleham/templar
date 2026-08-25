"use client";

import { FileText, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RAG_SOURCE_LABELS,
  RAG_STATUS_LABELS,
  type RagDocument,
  type RagDocumentStatus,
} from "@/lib/domain/rag";

const STATUS_TONE: Record<RagDocumentStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-vivid-purple/12 text-vivid-purple",
  indexed: "bg-vivid-mint/12 text-[#04836f]",
  failed: "bg-destructive/12 text-destructive",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({
  documents,
  canManage,
  onDelete,
}: {
  documents: readonly RagDocument[];
  canManage: boolean;
  onDelete: (documentId: string) => void;
}) {
  if (documents.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm font-semibold">
        아직 올린 문서가 없어요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5" data-testid="knowledge-documents">
      {documents.map((document) => (
        <li
          key={document.id}
          data-testid={`knowledge-doc-${document.id}`}
          className="bg-background flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
        >
          <span className="bg-card text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
            <FileText className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{document.title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs font-semibold">
              {RAG_SOURCE_LABELS[document.sourceType]} ·{" "}
              {formatBytes(document.byteSize)} · 청크 {document.chunkCount}개 ·{" "}
              {document.uploaderName}
            </p>
          </div>
          <Badge className={STATUS_TONE[document.status]}>
            {RAG_STATUS_LABELS[document.status]}
          </Badge>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${document.title} 삭제`}
              data-testid={`knowledge-delete-${document.id}`}
              onClick={() => {
                onDelete(document.id);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KnowledgeSearchMode } from "@/lib/domain/store";
import type { RagSearchHit } from "@/lib/domain/rag";

const MODE_LABEL: Record<KnowledgeSearchMode, string> = {
  keyword: "키워드 검색",
  semantic: "의미 검색",
};

export function KnowledgeSearch({
  mode,
  hits,
  query,
  searched,
  disabled,
  onQueryChange,
  onSearch,
}: {
  mode: KnowledgeSearchMode;
  hits: readonly RagSearchHit[];
  query: string;
  searched: boolean;
  disabled: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <Input
          data-testid="knowledge-query"
          value={query}
          disabled={disabled}
          placeholder="예: 환불 정책은 어떻게 되나요?"
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          className="h-11"
        />
        <Button
          type="submit"
          data-testid="knowledge-search"
          disabled={disabled || query.trim().length === 0}
          className="h-11 px-5"
        >
          <Search className="size-4" />
          검색
        </Button>
      </form>

      {searched && hits.length === 0 && (
        <p
          data-testid="knowledge-empty"
          className="text-muted-foreground py-8 text-center text-sm font-semibold"
        >
          일치하는 내용을 찾지 못했어요.
          {mode === "keyword" && (
            <span className="mt-1 block text-xs">
              지금은 키워드 검색이라 표현이 다르면 못 찾을 수 있어요.
            </span>
          )}
        </p>
      )}

      {hits.length > 0 && (
        <ul className="flex flex-col gap-2.5" data-testid="knowledge-results">
          {hits.map((hit, index) => (
            <li
              key={hit.chunk.id}
              data-testid={`knowledge-hit-${String(index)}`}
              className="bg-background rounded-2xl px-4 py-3.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-xs font-bold">
                  {hit.documentTitle}
                  <span className="text-muted-foreground ml-1.5 font-semibold">
                    #{hit.chunk.chunkIndex}
                  </span>
                </span>
                <Badge className="bg-accent text-accent-foreground shrink-0 tabular-nums">
                  {MODE_LABEL[mode]} {hit.score.toFixed(2)}
                </Badge>
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed font-medium">
                {hit.segments.map((segment, segmentIndex) => (
                  <span
                    key={segmentIndex}
                    className={
                      segment.hit
                        ? "bg-vivid-mint/20 rounded px-0.5 font-bold"
                        : undefined
                    }
                  >
                    {segment.text}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

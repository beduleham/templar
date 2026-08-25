"use client";

import * as React from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { RAG_ACCEPTED_EXTENSIONS, validateUpload } from "@/lib/domain/rag";

/**
 * 지식 문서 업로드.
 * 브라우저에서 텍스트를 읽어 청킹까지 진행한다. PDF/DOCX 는 바이너리라
 * 클라이언트에서 본문을 추출할 수 없어, 서버 파서 연결 전까지 텍스트 계열만
 * 실제 청킹이 가능하다 — 그 사실을 화면에 그대로 안내한다.
 */
export function DocumentUploader({
  disabled,
  onAccepted,
}: {
  disabled: boolean;
  onAccepted: (file: { name: string; size: number; text: string }) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (file === undefined) return;

    const validation = validateUpload({ name: file.name, size: file.size });
    if (!validation.ok) {
      toast.error(validation.reason);
      return;
    }
    if (validation.sourceType === "pdf" || validation.sourceType === "docx") {
      toast.error(
        "PDF·Word 본문 추출은 서버 파서 연결 후 가능해요. 지금은 TXT·MD 만 청킹됩니다.",
      );
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error("파일을 읽지 못했어요.");
    };
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (text.trim().length === 0) {
        toast.error("문서에서 읽어낼 내용이 없어요.");
        return;
      }
      onAccepted({ name: file.name, size: file.size, text });
    };
    reader.readAsText(file);
  };

  return (
    <div
      data-testid="knowledge-dropzone"
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) handleFile(event.dataTransfer.files[0]);
      }}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-[22px] border-2 border-dashed px-6 py-10 text-center transition-colors",
        disabled
          ? "border-border cursor-not-allowed opacity-55"
          : dragging
            ? "border-vivid-blue bg-accent"
            : "border-border hover:border-vivid-blue/50 hover:bg-muted/50",
      )}
    >
      <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-2xl">
        <FileUp className="size-5" />
      </span>
      <p className="mt-4 text-[15px] font-bold">
        문서를 끌어다 놓거나 눌러서 선택하세요
      </p>
      <p className="text-muted-foreground mt-1.5 text-[13px] font-semibold">
        {RAG_ACCEPTED_EXTENSIONS.join(" · ")} · 최대 10MB
      </p>
      <input
        ref={inputRef}
        data-testid="knowledge-input"
        type="file"
        accept={RAG_ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { FileUp, FileText } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = [".pdf", ".docx", ".txt"];

function isAccepted(file: File): boolean {
  return ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext));
}

/** 기획 초안 드래그 앤 드롭 업로드 — 10MB, PDF/DOCX/TXT 제한 */
export function DraftUploader({
  onAccepted,
}: {
  onAccepted: (file: File) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (file === undefined) return;
    if (!isAccepted(file)) {
      toast.error("PDF, DOCX, TXT 파일만 올릴 수 있어요.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("파일 크기는 10MB까지 올릴 수 있어요.");
      return;
    }
    onAccepted(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center rounded-[28px] border-2 border-dashed p-10 text-center transition-all duration-200",
        dragging
          ? "border-vivid-blue bg-accent scale-[1.02]"
          : "border-input bg-card hover:bg-muted/60"
      )}
      data-testid="draft-dropzone"
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl transition-colors",
          dragging ? "bg-vivid-blue text-white" : "bg-muted text-muted-foreground"
        )}
      >
        {dragging ? (
          <FileText className="size-7" />
        ) : (
          <FileUp className="size-7" />
        )}
      </span>
      <p className="mt-5 text-lg font-extrabold">
        {dragging ? "여기에 놓아주세요" : "기획 초안을 끌어다 놓으세요"}
      </p>
      <p className="text-muted-foreground mt-1.5 text-sm font-medium">
        PDF · DOCX · TXT · 최대 10MB · 클릭해서 선택할 수도 있어요
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
        data-testid="draft-input"
      />
    </div>
  );
}

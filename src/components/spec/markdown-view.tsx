import * as React from "react";

/** 스펙 문서용 경량 마크다운 뷰어 (#, ##, 리스트, 굵게만 지원) */
export function MarkdownView({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const renderInline = (text: string): React.ReactNode[] =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    const items = listBuffer;
    listBuffer = [];
    elements.push(
      <ul key={key} className="flex list-disc flex-col gap-1.5 pl-5">
        {items.map((item, i) => (
          <li key={i} className="text-[15px] leading-relaxed">
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
  };

  lines.forEach((line, idx) => {
    const key = `line-${idx}`;
    if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
      return;
    }
    flushList(`list-${idx}`);
    if (line.startsWith("# ")) {
      elements.push(
        <h3 key={key} className="text-xl font-extrabold tracking-tight">
          {line.slice(2)}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h4 key={key} className="mt-2 text-base font-bold">
          {line.slice(3)}
        </h4>
      );
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <p key={key} className="text-[15px] leading-relaxed">
          {renderInline(line)}
        </p>
      );
    } else if (line.trim() !== "") {
      elements.push(
        <p key={key} className="text-muted-foreground text-[15px] leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  });
  flushList("list-final");

  return <div className="flex flex-col gap-2.5">{elements}</div>;
}

import type { SpecTaskStatus } from "@/lib/domain/types";

export interface TaskNodeState {
  nodeId: string;
  status: SpecTaskStatus;
}

/**
 * 태스크 상태에 따라 Mermaid 마크다운에 노드 스타일 구문을 주입한다.
 * 완료 = 녹색, 진행 중 = 주황색, 할 일 = 회색 (마스터 스펙의 공정 시각화 규칙).
 */
export function injectMermaidStyles(
  originalMermaid: string,
  tasks: TaskNodeState[]
): string {
  if (originalMermaid.trim() === "") return "";

  const styles = tasks
    .filter((task) => task.nodeId !== "")
    .map((task) => {
      switch (task.status) {
        case "done":
          return `style ${task.nodeId} fill:#22c55e,stroke:#15803d,stroke-width:2px,color:#fff`;
        case "in_progress":
          return `style ${task.nodeId} fill:#f97316,stroke:#ea580c,stroke-width:2px,color:#fff`;
        case "todo":
          return `style ${task.nodeId} fill:#f3f4f6,stroke:#9ca3af,stroke-width:1px,color:#1f2937`;
      }
    })
    .join("\n");

  return styles === "" ? originalMermaid : `${originalMermaid}\n${styles}`;
}

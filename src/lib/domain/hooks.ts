"use client";

import * as React from "react";

import { domainStore } from "@/lib/domain/store";
import type { DomainState, Project } from "@/lib/domain/types";

/** 도메인 스토어 전체 상태 구독 */
export function useDomainState(): DomainState {
  return React.useSyncExternalStore(
    domainStore.subscribe,
    domainStore.getSnapshot,
    domainStore.getServerSnapshot
  );
}

export function useProject(projectId: string): Project | null {
  const state = useDomainState();
  return state.projects.find((p) => p.id === projectId) ?? null;
}

"use client";

import * as React from "react";
import type { UserRole } from "@/lib/navigation";

/**
 * Mock 인증 사용자 모델.
 * 실제 Supabase Auth 연동 시 `@supabase/supabase-js`의 User 세션으로 대체된다.
 * (본 태스크의 Non-Goal: 실제 RLS/세션 연동은 후속 태스크에서 수행)
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  signIn: (role: UserRole) => void;
  signOut: () => void;
  setRole: (role: UserRole) => void;
}

const MOCK_USER_BASE: Omit<AuthUser, "role"> = {
  id: "mock-user-1",
  name: "김아칸",
  email: "demo@archon.dev",
  avatarUrl: null,
};

const ROLE_STORAGE_KEY = "archon.mock-role";

const DEFAULT_USER: AuthUser = { ...MOCK_USER_BASE, role: "client" };

function readStoredRole(): UserRole | null {
  try {
    const raw = window.localStorage.getItem(ROLE_STORAGE_KEY);
    if (raw === "client" || raw === "partner" || raw === "admin") {
      return raw;
    }
  } catch {
    // localStorage 접근 불가 환경은 기본값 사용
  }
  return null;
}

function storeRole(role: UserRole | null) {
  try {
    if (role === null) {
      window.localStorage.removeItem(ROLE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    }
  } catch {
    // 저장 실패는 무시 — 세션 내 상태만 유지
  }
}

/**
 * 모듈 스코프의 Mock 인증 스토어.
 * useSyncExternalStore로 구독하며, Supabase Auth 도입 시
 * onAuthStateChange 구독으로 교체되는 지점이다.
 */
const authStore = {
  user: DEFAULT_USER as AuthUser | null,
  hydrated: false,
  listeners: new Set<() => void>(),
  subscribe(listener: () => void): () => void {
    authStore.listeners.add(listener);
    return () => {
      authStore.listeners.delete(listener);
    };
  },
  getSnapshot(): AuthUser | null {
    if (!authStore.hydrated) {
      authStore.hydrated = true;
      const stored = readStoredRole();
      if (stored !== null) {
        authStore.user = { ...MOCK_USER_BASE, role: stored };
      }
    }
    return authStore.user;
  },
  getServerSnapshot(): AuthUser | null {
    return DEFAULT_USER;
  },
  setUser(user: AuthUser | null) {
    authStore.user = user;
    storeRole(user?.role ?? null);
    authStore.listeners.forEach((listener) => listener());
  },
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = React.useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getServerSnapshot
  );

  const signIn = React.useCallback((role: UserRole) => {
    authStore.setUser({ ...MOCK_USER_BASE, role });
  }, []);

  const signOut = React.useCallback(() => {
    authStore.setUser(null);
  }, []);

  const setRole = React.useCallback((role: UserRole) => {
    if (authStore.user !== null) {
      authStore.setUser({ ...authStore.user, role });
    }
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn,
      signOut,
      setRole,
    }),
    [user, signIn, signOut, setRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
}

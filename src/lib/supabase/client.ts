import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Supabase 브라우저 클라이언트.
 *
 * 정적 배포에서도 브라우저가 anon 키로 직접 붙고 RLS가 접근을 통제하므로
 * 별도 서버가 필요 없다. anon 키는 번들에 포함되는 공개 값이며, 보안은
 * supabase/migrations 의 RLS 정책이 담당한다.
 * service_role 키는 절대 이 경로로 들어와서는 안 된다.
 *
 * 환경 변수가 없으면 null 을 돌려주고, 앱은 클라이언트 도메인 스토어로
 * 동작한다(데모 모드).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

let cached: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) return null;

  cached ??= createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // 정적 호스팅에서 OAuth 리다이렉트를 받으려면 URL 세션 감지가 필요하다
      detectSessionInUrl: true,
    },
  });

  return cached;
}

/** 데모 모드 여부 — 화면에 안내 배지를 띄울 때 쓴다 */
export function isDemoMode(): boolean {
  return !isSupabaseConfigured;
}

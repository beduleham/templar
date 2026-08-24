#!/usr/bin/env node
/**
 * Supabase 프로젝트가 제대로 준비됐는지 확인한다.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… npm run supabase:check
 *   (또는 .env.local 에 넣어두고 실행)
 *
 * anon 키만 사용한다. service_role 키는 필요 없고, 넣어서도 안 된다.
 */
import { readFileSync, existsSync } from "node:fs";

// .env.local 을 읽어 환경 변수로 채운다 (이미 설정된 값이 우선)
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const results = [];
const check = (ok, label, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

if (url === "" || key === "") {
  console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다.");
  process.exit(1);
}

check(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url), "URL 형식", url);

// service_role 키가 잘못 들어왔는지 확인 — 들어왔다면 즉시 중단해야 한다
try {
  const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
  if (payload.role === "service_role") {
    console.error("\n🚨 service_role 키가 들어왔습니다. 이 키는 모든 RLS를 우회합니다.");
    console.error("   Supabase 대시보드에서 즉시 폐기(rotate)하고 anon public 키로 바꾸세요.");
    process.exit(1);
  }
  check(payload.role === "anon", "anon 키 확인", `role=${payload.role}`);
} catch {
  check(false, "키 형식을 해석할 수 없습니다");
}

const rest = (path) =>
  fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

// 인증 서비스 응답 확인
try {
  const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
  check(res.ok, "Auth 서비스 응답", `HTTP ${res.status}`);
} catch (error) {
  check(false, "Auth 서비스 응답", String(error));
}

/**
 * 비로그인(anon) 상태로 테이블을 조회해 본다.
 *   permission denied → 테이블이 있고 접근이 막혀 있다 (정상)
 *   relation ... does not exist → 스키마가 적용되지 않았다
 *   200 + 데이터 → 테이블이 열려 있다 (위험)
 */
const TABLES = [
  "projects", "spec_epics", "spec_features", "spec_tasks", "project_ndas",
  "bids", "bid_items", "contracts", "milestones",
  "as_subscriptions", "as_payment_logs", "system_audit_logs", "profiles",
];

let missing = 0;
let exposed = 0;

for (const table of TABLES) {
  let res;
  try {
    res = await rest(`${table}?select=*&limit=1`);
  } catch (error) {
    check(false, `${table}`, String(error));
    continue;
  }
  const body = await res.text();

  if (res.ok) {
    exposed += 1;
    check(false, `${table}`, "⚠ 비로그인 상태에서 조회됨 — RLS/권한을 확인하세요");
  } else if (body.includes("does not exist") || body.includes("PGRST205")) {
    missing += 1;
    check(false, `${table}`, "테이블 없음 — schema.sql 이 적용되지 않았습니다");
  } else {
    check(true, `${table}`, "존재 + 비로그인 차단됨");
  }
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} 통과`);

if (missing > 0) {
  console.log("\n→ supabase/schema.sql 을 SQL Editor 에 붙여넣고 Run 하세요.");
}
if (exposed > 0) {
  console.log("\n→ 열려 있는 테이블이 있습니다. schema.sql 의 RLS 구간이 실행됐는지 확인하세요.");
}

process.exit(failed > 0 ? 1 : 0);

# 배포 및 프로덕션 체크리스트

## 현재 배포

| 항목 | 값 |
| --- | --- |
| 라이브 URL | https://beduleham.github.io/templar/ |
| 방식 | Next.js 정적 내보내기(`output: "export"`) → `gh-pages` 브랜치 게시 |
| 파이프라인 | `.github/workflows/deploy-pages.yml` (push 시 lint → vitest → build → 배포) |
| 서브패스 | `BASE_PATH=/templar` (CI에서 주입, 로컬은 빈 값) |

## 환경 변수

키는 코드에 하드코딩하지 않고 환경 변수로만 주입합니다. `.env.example`을 복사해
`.env.local`을 만들어 사용하세요.

| 변수 | 용도 | 없을 때 동작 |
| --- | --- | --- |
| `IGN8T_API_KEY` | ign8t MCP 백로그 연동 | MCP 도구 사용 불가 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 연결 | 클라이언트 도메인 스토어로 동작 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 | 동일 |
| `NEXT_PUBLIC_SENTRY_DSN` | 에러 트래킹 | 관측성 no-op |
| `NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY` | LLM 트레이싱 | 관측성 no-op |

## 보안 헤더

정적 호스팅(GitHub Pages)은 커스텀 응답 헤더를 지원하지 않아, 문서 수준에서
가능한 항목만 `<meta http-equiv>`로 적용했습니다.

- 적용됨: `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`
- 적용 불가(서버 필요): `Strict-Transport-Security`, `X-Frame-Options`
  - GitHub Pages는 전 구간 HTTPS이며 HSTS는 `github.io` 도메인 정책으로 적용됩니다.
  - Vercel·Cloudflare 등으로 옮기면 `next.config.ts`의 `headers()` 또는
    `_headers` 파일로 전체 헤더를 적용할 수 있습니다.

## 프로덕션 전환 시 남은 작업

현재 데모는 서버·외부 서비스 없이 동작하도록 구현돼 있습니다. 실제 운영 전환에는
다음 연동이 필요하며, 각 교체 지점은 코드 주석에 명시돼 있습니다.

1. **Supabase** — `src/lib/domain/store.ts`의 클라이언트 스토어를 Auth/DB/Realtime과
   RLS 정책으로 교체. `canViewSpecDetail`이 RLS 대응 지점입니다.
2. **LLM** — `src/lib/domain/spec-engine.ts`의 결정적 생성기를 Vercel AI SDK 기반
   `/api/spec/generate`로 교체.
3. **PG사** — `src/services/escrow.ts`의 `mockEscrowService`를 실제 결제·정산 어댑터로
   교체(인터페이스 동일).
4. **관측성** — `src/services/observability.ts`의 `registerObservability()`에
   Sentry/Langfuse 어댑터 주입.

## 검증 명령

```bash
npm run lint     # ESLint
npm test         # Vitest 단위 테스트
npm run build    # 타입 체크 + 정적 빌드
```

E2E는 `scratchpad/e2e-journey.mjs`(Playwright)로 전체 여정을 검증합니다.

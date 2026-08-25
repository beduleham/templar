# 아칸 (Archon)

AI 기반 SI 플랫폼 — 대화형 AI 스펙 생성부터 입찰·계약, 마일스톤 에스크로 정산,
실시간 공정관리까지를 하나의 '단일 진실 공급원(SSOT)'으로 관리합니다.

**🌐 라이브 데모: https://beduleham.github.io/templar/**
(GitHub Pages 정적 배포 — `main`/개발 브랜치 push 시 GitHub Actions가 자동 재배포)

## 기술 스택

- [Next.js](https://nextjs.org) 16 (App Router) + TypeScript (strict, `any` 금지)
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Radix 기반, `src/components/ui`)
- Pretendard 웹폰트 (npm 패키지, 빌드 시 번들)
- Supabase (PostgreSQL) — 스키마·비즈니스 규칙·RLS는 `supabase/` 에 작성·검증
  완료, 앱 연결은 대기 중 (현재 화면은 클라이언트 도메인 스토어로 동작).
  자세한 내용은 [docs/database.md](docs/database.md)

## 개발

```bash
npm install
npm run dev     # 개발 서버
npm run build   # 타입 체크 + 프로덕션 빌드
npm run lint    # ESLint
npm test        # Vitest 단위 테스트
npm run db:test # DB 스키마·비즈니스 규칙·RLS·RAG 검증 (로컬 PostgreSQL 14+ · pgvector 필요)
```

## 라우팅 구조

| 경로 | 설명 | 레이아웃 |
| --- | --- | --- |
| `/` | 랜딩 페이지 | 독립 |
| `/auth` | 로그인 (현재 Mock 역할 선택) | `(auth)` — 셸 없음 |
| `/dashboard` | 대시보드 홈 | `(app)` — 앱 셸 |
| `/spec-generator` | AI 스펙 생성기 (client, admin 전용) | `(app)` |
| `/bids` | 입찰 및 계약 허브 | `(app)` |
| `/projects` | 아키텍처 연동 공정판 | `(app)` |
| `/knowledge` | 지식 베이스 — 문서 업로드·청킹·검색 (임베딩 미연결) | `(app)` |
| `/subscriptions` | AS 및 구독 관리 | `(app)` |

앱 셸은 데스크톱(≥1024px)에서 좌측 고정 사이드바, 모바일에서 햄버거 → 드로워
(Sheet) 네비게이션으로 동작하며, 사용자 역할(client/partner/admin)에 따라 메뉴가
필터링됩니다. 역할 전환은 헤더 프로필 드롭다운의 개발용 스위처로 테스트할 수
있습니다.

## ign8t MCP

백로그와 스펙은 ign8t로 관리합니다. 설정은 [`docs/ign8t-mcp-setup.md`](docs/ign8t-mcp-setup.md) 참고
(API 키는 `IGN8T_API_KEY` 환경 변수로만 주입하며 저장소에 커밋하지 않습니다).

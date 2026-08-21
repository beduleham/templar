# 누리플랜 (templar)

어린이집·유치원 원장/교사의 교육계획 수립과 교재·교구 선정을 일원화하는 AI 추천 어시스턴트.

## 기술 스택

- React 19 + TypeScript + Vite
- react-router-dom 7 (SPA 라우팅)
- Tailwind CSS 4 (`@tailwindcss/vite`)
- Zustand (역할 전역 상태), lucide-react (아이콘)

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 타입 체크 + 프로덕션 빌드
npm run lint     # oxlint
```

## 구조

- `src/components/layout/` — 앱 셸(`AppShell`), 헤더, 사이드바, 모바일 드로어
- `src/config/navigation.ts` — 역할별 네비게이션 메뉴 정의
- `src/store/useRoleStore.ts` — 교사/원장 ↔ 공급업체 역할 상태 (실제 인증 도입 전 Mock)
- `src/pages/` — 라우트별 더미 페이지 (기능 구현은 후속 태스크)

### 라우트

| 역할 | 경로 |
| --- | --- |
| 교사/원장 | `/teacher/dashboard`, `/teacher/plan`, `/teacher/quotes` |
| 공급업체 | `/supplier/dashboard`, `/supplier/products`, `/supplier/orders` |

루트(`/`)와 미정의 경로는 현재 역할의 대시보드로 리다이렉트되며, 현재 역할이
접근할 수 없는 영역의 URL은 해당 역할의 대시보드로 돌려보냅니다.

## ign8t MCP

백로그·스펙은 ign8t MCP로 관리합니다. 설정은 [`docs/ign8t-mcp-setup.md`](docs/ign8t-mcp-setup.md) 참고.

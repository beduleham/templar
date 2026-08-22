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
npm test         # vitest (견적 계산 엔진 단위 테스트)
```

## 구조

- `src/components/layout/` — 앱 셸(`AppShell`), 헤더, 사이드바, 모바일 드로어
- `src/config/navigation.ts` — 역할별 네비게이션 메뉴 정의
- `src/store/useRoleStore.ts` — 교사/원장 ↔ 공급업체 역할 상태 (실제 인증 도입 전 Mock)
- `src/lib/` — 견적 계산 엔진(순수 함수), PDF/Excel 생성 모듈
- `src/api/` — 백엔드 도입 전 Mock 데이터 레이어 (스펙의 API 응답 형태 유지)
- `src/pages/` — 라우트별 페이지

### 라우트

| 역할 | 경로 |
| --- | --- |
| 교사/원장 | `/teacher/dashboard`, `/teacher/plan`, `/teacher/quotes` |
| 공급업체 | `/supplier/dashboard`, `/supplier/products`, `/supplier/orders` |

루트(`/`)와 미정의 경로는 현재 역할의 대시보드로 리다이렉트되며, 현재 역할이
접근할 수 없는 영역의 URL은 해당 역할의 대시보드로 돌려보냅니다.

## 배포 (Production)

정적 SPA로 배포합니다:

```bash
npm run build        # dist/ 생성 (코드 스플리팅: PDF/Excel 엔진은 지연 로드)
```

- **호스팅**: 정적 호스팅(Vercel/Netlify/S3+CloudFront 등)에 `dist/`를 업로드.
  브라우저 라우터를 사용하므로 **모든 경로를 `index.html`로 리라이트**해야 합니다.
  리라이트가 불가능한 호스팅은 `ARTIFACT_BUILD=1 npm run build`(해시 라우터,
  단일 에셋 인라인, `dist-artifact/`)를 사용하세요.
- **한글 폰트**: PDF용 NanumGothic(TTF, OFL)은 번들 에셋으로 포함되어
  서버리스/컨테이너 환경에서도 별도 설치 없이 동작합니다.
- **점검 페이지**: 배포·점검 시 트래픽을 `public/maintenance.html`(정적)로
  라우팅하세요.
- **경화(hardening)**: 전역 Error Boundary가 렌더링 크래시를 복구 UI로
  전환하고, `src/lib/monitoring.ts`가 window 전역 에러를 수집합니다
  (Sentry 등 도입 시 `reportError` 내부만 교체).

### 백엔드 도입 시 체크리스트 (현재 미적용)

| 항목 | 내용 |
| --- | --- |
| 필수 환경 변수 | `NODE_ENV=production`, `DATABASE_URL`, `GEMINI_API_KEY`, `APP_URL`, `LOG_LEVEL` — 기동 시 누락되면 Fail-Fast 종료 |
| 헬스 체크 | `GET /api/health` — DB·Gemini 연결 상태 포함 200 응답 |
| DB | 스키마 마이그레이션 + 누리과정 가이드라인·교재 메타데이터 시딩 |
| AI 호출 | 10초 타임아웃 + 지수 백오프 재시도, 실패 시 Graceful Degradation |

## ign8t MCP

백로그·스펙은 ign8t MCP로 관리합니다. 설정은 [`docs/ign8t-mcp-setup.md`](docs/ign8t-mcp-setup.md) 참고.

#!/usr/bin/env bash
# ============================================================================
# 스키마·비즈니스 규칙·RLS를 실제 PostgreSQL에 올려 검증한다.
# Supabase 계정 없이 로컬 PostgreSQL 14+ 만 있으면 돌아간다.
#
#   ./scripts/db-test.sh
#   PGHOST=localhost PGUSER=postgres ./scripts/db-test.sh
# ============================================================================
set -euo pipefail

DB_NAME="${ARCHON_TEST_DB:-archon_schema_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql 을 찾을 수 없습니다. PostgreSQL 클라이언트를 설치하세요." >&2
  exit 1
fi

echo "▶ 테스트 데이터베이스 재생성: ${DB_NAME}"
dropdb --if-exists "${DB_NAME}"
createdb "${DB_NAME}"

run() {
  psql -v ON_ERROR_STOP=1 -q -d "${DB_NAME}" -f "$1" 2>&1
}

echo "▶ Supabase 셰임 적용"
run "${ROOT}/supabase/tests/00_local_shim.sql" | grep -v '^NOTICE' || true

echo "▶ 마이그레이션 적용"
for migration in "${ROOT}"/supabase/migrations/*.sql; do
  echo "  - $(basename "${migration}")"
  run "${migration}" | grep -v '^NOTICE' || true
done

echo "▶ 검증 실행"
OUTPUT="$(
  run "${ROOT}/supabase/tests/01_rules_test.sql"
  run "${ROOT}/supabase/tests/02_rls_test.sql"
  run "${ROOT}/supabase/tests/03_rag_test.sql"
)"

echo "${OUTPUT}" | grep -E 'PASS|FAIL' | sed 's/^psql:[^ ]* //; s/^NOTICE:  //'

PASSED="$(echo "${OUTPUT}" | grep -c 'PASS' || true)"
FAILED="$(echo "${OUTPUT}" | grep -c 'FAIL' || true)"

echo
echo "${PASSED} passed, ${FAILED} failed"

echo "▶ 시드 데이터 적용 확인"
dropdb --if-exists "${DB_NAME}_seed"
createdb "${DB_NAME}_seed"
psql -v ON_ERROR_STOP=1 -q -d "${DB_NAME}_seed" -f "${ROOT}/supabase/tests/00_local_shim.sql" >/dev/null
for migration in "${ROOT}"/supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "${DB_NAME}_seed" -f "${migration}" >/dev/null
done
psql -v ON_ERROR_STOP=1 -q -d "${DB_NAME}_seed" -f "${ROOT}/supabase/seed.sql" >/dev/null
psql -tA -d "${DB_NAME}_seed" -c \
  "select '  ' || title || ' (' || status || ')' from projects order by created_at"

if [ "${FAILED}" != "0" ]; then
  exit 1
fi

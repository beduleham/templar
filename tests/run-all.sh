#!/bin/sh
# 전체 회귀. 배포 직전에 한 번 돈다(§142).
#
# 고치는 동안에는 `node tests/pick.js` 로 바뀐 곳에 걸리는 것만 돌린다 —
# 전부는 30분, 고른 것은 보통 1분 안쪽이다.
#
# bot.js 는 검사가 아니라 여러 검사가 같이 쓰는 계측용 봇이고,
# pick.js 는 고르는 도구다. 둘 다 여기서 돌리면 안 된다.
# no-afk-clear 는 15분짜리 판을 끝까지 굴리므로 맨 뒤에 둔다.
cd "$(dirname "$0")/.." || exit 1
pass=0; fail=0
for f in $(ls tests/*.js | grep -v "bot.js\|pick.js\|no-afk-clear.js") tests/no-afk-clear.js; do
  s=$(date +%s)
  if out=$(node "$f" 2>&1); then
    pass=$((pass+1)); echo "OK   $f  $(( $(date +%s) - s ))s"
  else
    fail=$((fail+1)); echo "FAIL $f  $(( $(date +%s) - s ))s"; echo "$out" | tail -25
  fi
done
echo "=== 통과 $pass / 실패 $fail ==="
[ "$fail" = 0 ]

/* 회귀: 쿼터뷰가 실제로 쿼터뷰인가.

   지면만 눕히고 서 있는 것은 세운다 — 그 둘이 어긋나면 화면이 통째로 무너진다.
   이 테스트가 지키는 것 넷.

   1) 세로 거리가 눌린다. 같은 월드 거리를 가로로 가면 화면에서 그대로,
      세로로 가면 TILT 배로 줄어야 한다.
   2) 서 있는 것은 안 눌린다. 주인공 스프라이트의 화면 높이가 탑뷰 때와 같아야 한다.
   3) 깊이 정렬. 아래(y 가 큰) 몹이 위(y 가 작은) 몹을 가려야 한다.
   4) 스폰이 화면 안에서 튀어나오지 않는다. 지면을 눕히면 세로로 더 멀리 보이는데,
      예전처럼 반지름 하나로 스폰하면 45도 방향이 화면 안이 된다(실측 509 < 570). */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);

  const out = await pg.evaluate(() => {
    selectedClass = 0; Game.reset(); Game.state = 'playing';
    Game.updateSpawning = () => {};
    inputVector = () => ({ x: 0, y: 0 });
    player.weapons.length = 0;
    drawStanceWorld = () => {};
    for (const e of enemies) { e.active = false; e.dying = false; }

    // ── 1) 세로만 눌리는가 ────────────────────────────────
    const D = 200;
    const seen = (wx, wy) => {                    // 월드 한 점이 화면 어디에 찍히는가
      return [wx - cam.x, (wy - cam.y) * TILT];
    };
    const o = seen(player.x, player.y);
    const hx = seen(player.x + D, player.y), vy = seen(player.x, player.y + D);
    const dx = hx[0] - o[0], dy = vy[1] - o[1];

    // ── 4) 스폰 반경 ──────────────────────────────────────
    let inside = 0;
    for (let i = 0; i < 400; i++) {
      const e = Game.spawnEnemy('slime');
      if (!e) break;
      const sx = Math.abs(e.x - player.x), sy = Math.abs(e.y - player.y);
      if (sx < W / 2 && sy < HT / 2) inside++;     // 화면 안에서 튀어나왔다
      e.active = false;
    }

    // ── 3) 깊이 정렬 ─────────────────────────────────────
    for (const e of enemies) { e.active = false; e.dying = false; }
    for (let i = 0; i < 12; i++) {
      const e = Game.spawnEnemy('zombie', player.x + (i % 4) * 60 - 90, player.y + (i % 7) * 40 - 120);
      if (e) { e.spd = 0; e.hp = e.maxHp = 1e9; }
    }
    Game.time = 3.0;
    drawScene();
    /* 겹친 픽셀로 순서를 재려 했는데, 좀비가 어두운 초록이라 바닥 무늬와
       밝기가 겹쳐서 어느 쪽이 이겼는지 화면에서 가려낼 수가 없었다.
       drawDepth 가 쓰는 목록이 그린 뒤에도 남아 있으니 그걸 그대로 읽는다 —
       이게 곧 '그린 순서'다. */
    let sorted = depthList.length > 3, hasPlayer = false, kinds = 0;
    for (let i = 1; i < depthList.length; i++)
      if (depthList[i][0] < depthList[i - 1][0]) sorted = false;
    for (const d of depthList) { if (d[1] === 3) hasPlayer = true; kinds |= 1 << d[1]; }

    return { dx, dy, tilt: TILT, ratio: +(dy / dx).toFixed(3), inside,
             depthWorks: sorted, hasPlayer, kinds, listLen: depthList.length,
             heroH: player.r / 14 * 1.15 * CHAR_SCALE };
  });

  console.log(JSON.stringify(out));
  const fail = [];
  if (Math.abs(out.dx - 200) > 1) fail.push(`가로 거리가 ${out.dx} 로 바뀌었다 — 가로는 안 눌려야 한다`);
  if (Math.abs(out.ratio - out.tilt) > .01)
    fail.push(`세로/가로 비가 ${out.ratio} 다 — TILT(${out.tilt.toFixed(3)}) 여야 한다`);
  if (out.inside > 0) fail.push(`${out.inside} 마리가 화면 안에서 스폰됐다`);
  if (!out.depthWorks) fail.push(`그리는 순서가 월드 y 로 정렬되지 않았다 (${out.listLen}개)`);
  if (!out.hasPlayer) fail.push('주인공이 깊이 정렬에 안 들어가 있다 — 늘 맨 위에 그려진다');
  if (!(out.kinds & 4)) fail.push('몹이 깊이 정렬에 안 들어가 있다');
  if (errs.length) fail.push('페이지 오류: ' + errs[0]);
  console.log(fail.length ? 'FAIL\n' + fail.join('\n') : 'PASS');
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();

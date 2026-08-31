/* 회귀: 강철 처형자의 네 장이 '주기'가 아니라 '상태'에 걸려 있는가.

   이 보스는 걷기 2.6초 → 예비동작 1.0초 → 돌진 0.7초(900px/s) → 착지 충격파를
   돈다. 예고를 보고 비켜야 하는 보스라, 예비동작 중에 그림이 돌진 자세로
   바뀌면 예고가 거짓말이 된다. 그래서 돌진자(§64)와 같이 상태에 고정한다.

     걷기      e.anim %= .25     0·1 두 장만
     예비동작  e.anim = .3125    2번(도끼 치켜듦)
     돌진      e.anim = .4375    3번(내리찍음)

   상태가 바뀌는 그 한 프레임은 이전 값이 남아 샐 수 있다 — 60fps 에서 16ms 라
   보이지 않는다. 그래서 '전부'가 아니라 '압도적 다수'를 본다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);

  const r = await pg.evaluate(() => {
    Game.reset(); Game.state = 'playing';
    for (const e of enemies) e.active = false;
    const bs = Game.spawnEnemy('boss2', player.x + 500, player.y, RANKS.common);
    player.base.maxHp = 1e9; recomputeStats(); player.hp = 1e9;
    const idx = e => Math.floor(e.anim * 8) % 4;
    const by = [{}, {}, {}];                       // 상태별 프레임 히스토그램
    let frames = 0, died = false;
    for (let i = 0; i < 60 * 30; i++) {
      if (Game.state !== 'playing') Game.state = 'playing';
      player.hp = 1e9; bs.hp = bs.maxHp;
      update(1 / 60);
      if (!bs.active || bs.dying) { died = true; break; }
      frames++;
      const s = bs.state, k = idx(bs);
      by[s][k] = (by[s][k] || 0) + 1;
    }
    return { by, frames, died };
  });
  await b.close();

  const label = ["걷기", "예비동작", "돌진"];
  const want = { 1: 2, 2: 3 };                     // 예비동작→2번, 돌진→3번
  const bad = [];
  if (errs.length) bad.push("예외: " + errs.join(" / "));
  if (r.died) bad.push("보스가 도중에 죽어 관측이 끊겼다");

  console.log(`${r.frames}프레임(${(r.frames / 60).toFixed(1)}초) 관측`);
  r.by.forEach((hist, s) => {
    const tot = Object.values(hist).reduce((a, b) => a + b, 0);
    const line = Object.keys(hist).sort().map(k => `${k}번 ${hist[k]}회`).join(" · ");
    console.log(`  ${label[s]}(state ${s}) ${tot}프레임 — ${line}`);
    if (!tot) { bad.push(`${label[s]} 상태가 한 번도 안 나왔다`); return; }
    if (s === 0) {
      const walk = (hist[0] || 0) + (hist[1] || 0);
      if (walk / tot < .97) bad.push(`걷기에서 0·1 이외의 장이 ${tot - walk}프레임 나왔다`);
    } else {
      const hit = hist[want[s]] || 0;
      if (hit / tot < .97) bad.push(`${label[s]} 에서 ${want[s]}번이 ${(hit / tot * 100).toFixed(1)}% 뿐이다`);
    }
  });

  if (bad.length) { console.error("\n실패:\n  " + bad.join("\n  ")); process.exit(1); }
  console.log("\n통과");
})();

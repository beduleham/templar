/* 회귀: 역병 군주의 네 프레임이 페이즈 타이머를 따라가는가.

   이 보스는 3.4초마다 한 번씩 방출한다 — 졸개 8마리를 뿜거나, 독 웅덩이를
   뿌리거나, 넓은 범위기를 예고한다. 셋 다 '방출'이라 부풀었다 터지는 한 벌이
   전부를 덮는다. 그래서 네 장(수축·차오름·부풀음·터지기직전)을 걸음 속도가
   아니라 `e.anim = (3.4 - e.t1) / 3.4 * .5` 로 타이머에 묶었다.

   이 테스트가 지키는 것:
     1) 네 장이 고르게 나온다.
     2) 방출이 터지는 순간은 언제나 마지막 장(터지기 직전)이 끝나는 지점이다.
     3) 연속한 두 방출 사이가 3.4초다.

   주의 — 간격을 '전체 시간 / 방출 횟수' 로 재면 안 된다. 첫 방출은 스폰 때
   t1 = rnd(.4, 1.6) 에서 출발하므로 3.4초를 기다리지 않는다. 그 나눗셈은
   시드에 따라 오르내려서 멀쩡한 코드를 거짓 실패시킨다(tests/shaman-cast.js
   가 실제로 그렇게 한 번 터졌다). 연속한 두 방출 사이만 잰다.

   그리고 20초를 돌리는 테스트는 두 가지를 반드시 막아야 한다 — 적이 죽으면
   `dying` 이 되어 anim 이 얼어붙고, 레벨업 화면이 뜨면 `update()` 가 통째로
   멈춘다. 둘 다 짧게 재면 안 걸리고 길게 재면 걸린다. */
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
    const bs = Game.spawnEnemy('boss1', player.x + 700, player.y, RANKS.common);
    player.base.maxHp = 1e9; recomputeStats(); player.hp = 1e9;
    const idx = e => Math.floor(e.anim * 8) % 4;
    const out = { count: [0, 0, 0, 0], atFire: {}, at: [], frames: 0, died: false };
    for (let i = 0; i < 60 * 24; i++) {
      if (Game.state !== 'playing') Game.state = 'playing';
      player.hp = 1e9; bs.hp = bs.maxHp;
      const t0 = bs.t1;
      update(1 / 60);
      if (!bs.active || bs.dying) { out.died = true; break; }
      out.frames++; out.count[idx(bs)]++;
      if (bs.t1 > t0) { const k = idx(bs); out.atFire[k] = (out.atFire[k] || 0) + 1; out.at.push(out.frames); }
    }
    return out;
  });
  await b.close();

  const name = ["수축", "차오름", "부풀음", "터지기직전"];
  const pct = r.count.map(n => n / r.frames * 100);
  const gaps = r.at.slice(1).map((v, i) => (v - r.at[i]) / 60);
  const gLo = Math.min(...gaps), gHi = Math.max(...gaps);
  console.log(`${r.frames}프레임(${(r.frames / 60).toFixed(1)}초) 관측, 도중사망=${r.died}`);
  console.log("프레임 노출  " + pct.map((p, i) => `${i} ${name[i]} ${p.toFixed(1)}%`).join(" · "));
  console.log(`방출 ${r.at.length}회, 연속 간격 ${gLo.toFixed(2)}~${gHi.toFixed(2)}초`);
  console.log("방출이 터진 순간의 프레임: " + JSON.stringify(r.atFire));

  const bad = [];
  if (errs.length) bad.push("예외: " + errs.join(" / "));
  if (r.died) bad.push("보스가 도중에 죽어 관측이 끊겼다");
  pct.forEach((p, i) => { if (p < 18 || p > 32) bad.push(`${i}번(${name[i]}) 노출 ${p.toFixed(1)}% — 25% 에서 너무 벗어났다`); });
  if (gaps.length < 4) bad.push(`방출이 ${r.at.length}회뿐이라 간격을 못 잰다`);
  else if (gLo < 3.3 || gHi > 3.5) bad.push(`방출 간격 ${gLo.toFixed(2)}~${gHi.toFixed(2)}초 (3.4초여야 한다)`);
  const keys = Object.keys(r.atFire);
  if (keys.length !== 1 || keys[0] !== "0") bad.push("방출 순간의 프레임이 일정하지 않다: " + JSON.stringify(r.atFire));

  if (bad.length) { console.error("\n실패:\n  " + bad.join("\n  ")); process.exit(1); }
  console.log("\n통과");
})();

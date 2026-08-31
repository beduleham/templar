/* 회귀: 심연의 왕의 눈 뜨는 네 장이 주기를 따라가는가, 그리고 격노하면
   실제로 빨라지는가.

   이 왕은 2.4초마다 방사형 탄막(0·1·2단계)이나 순간이동(3단계)을 한다.
   눈꺼풀이 열린 정도가 곧 남은 시간이고, 마지막 장에서 촉수가 사방으로
   펼쳐지는 모양이 탄막을 미리 그려 보인다.

   체력 절반 아래로 내려가면 주기가 2.4 → 1.5초로 줄어든다. 4프레임으로는
   격노 변종을 따로 담을 수 없으므로, **재생 속도가 1.6배 빨라지는 것**이
   그림이 낼 수 있는 유일한 격노 신호다. 그래서 그 배수까지 잰다.

   격노로 넘어가는 그 한 프레임에 t1(2.4)이 cyc(1.5)보다 커서 anim 이 음수가
   되면, idx = floor(anim*8) % 4 이 -1 이 되어 아틀라스를 판 바깥에서 읽는다.
   Math.max(0, ...) 로 막아 뒀고 이 테스트가 그걸 지킨다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);

  const r = await pg.evaluate(() => {
    const run = (ragePct) => {
      Game.reset(); Game.state = 'playing';
      for (const e of enemies) e.active = false;
      const bs = Game.spawnEnemy('boss3', player.x + 600, player.y, RANKS.common);
      player.base.maxHp = 1e9; recomputeStats(); player.hp = 1e9;
      const idx = e => Math.floor(e.anim * 8) % 4;
      const o = { count: [0, 0, 0, 0], at: [], frames: 0, bad: 0, died: false };
      for (let i = 0; i < 60 * 24; i++) {
        if (Game.state !== 'playing') Game.state = 'playing';
        player.hp = 1e9;
        bs.hp = bs.maxHp * ragePct;              // 격노 여부를 고정한다
        const t0 = bs.t1;
        update(1 / 60);
        if (!bs.active || bs.dying) { o.died = true; break; }
        o.frames++;
        const k = idx(bs);
        if (k < 0 || k > 3) { o.bad++; continue; }   // 음수 anim = 판 바깥을 읽는다
        o.count[k]++;
        if (bs.t1 > t0) o.at.push(o.frames);
      }
      return o;
    };
    return { calm: run(.9), rage: run(.3) };
  });
  await b.close();

  const name = ["감김", "반쯤", "열림", "최대"];
  const bad = [];
  if (errs.length) bad.push("예외: " + errs.join(" / "));

  const gapOf = (o) => {
    const g = o.at.slice(1).map((v, i) => (v - o.at[i]) / 60);
    return { lo: Math.min(...g), hi: Math.max(...g), n: g.length };
  };
  const out = {};
  for (const [tag, o] of Object.entries(r)) {
    const label = tag === 'calm' ? '평소(체력 90%)' : '격노(체력 30%)';
    const pct = o.count.map(n => n / o.frames * 100);
    const g = gapOf(o);
    out[tag] = g;
    console.log(`${label}  ${o.frames}프레임`);
    console.log("  프레임 노출  " + pct.map((p, i) => `${i} ${name[i]} ${p.toFixed(1)}%`).join(" · "));
    console.log(`  발동 ${o.at.length}회, 연속 간격 ${g.lo.toFixed(2)}~${g.hi.toFixed(2)}초`);
    if (o.died) bad.push(`${label} 관측이 끊겼다`);
    if (o.bad) bad.push(`${label} 에서 프레임 번호가 범위를 벗어난 적이 ${o.bad}번 있다 (음수 anim)`);
    pct.forEach((p, i) => { if (p < 18 || p > 32) bad.push(`${label} ${i}번(${name[i]}) 노출 ${p.toFixed(1)}%`); });
    if (g.n < 4) bad.push(`${label} 발동이 ${o.at.length}회뿐이라 간격을 못 잰다`);
  }
  if (out.calm.lo < 2.3 || out.calm.hi > 2.5) bad.push(`평소 주기가 2.4초가 아니다`);
  if (out.rage.lo < 1.4 || out.rage.hi > 1.6) bad.push(`격노 주기가 1.5초가 아니다`);
  const speed = out.calm.lo / out.rage.hi;
  console.log(`\n격노하면 재생이 ${speed.toFixed(2)}배 빨라진다 — 4프레임으로 격노를 알리는 유일한 수단이다`);
  if (speed < 1.45) bad.push(`격노 가속이 ${speed.toFixed(2)}배뿐이다`);

  if (bad.length) { console.error("\n실패:\n  " + bad.join("\n  ")); process.exit(1); }
  console.log("\n통과");
})();

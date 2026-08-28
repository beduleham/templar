/* 회귀: 전직 계급이 화면에서 실제로 달라 보이는가, 그리고 난전을 가리지 않는가.

   전직 마디가 68개라 68벌을 그릴 수는 없다. 그래서 스프라이트는 그대로 두고
   네 겹(망토·후광·궤도·발밑 문양)을 런타임으로 겹친다. 이 테스트가 지키는 것:

   1) 계급마다 픽셀이 실제로 바뀐다 — 0→1→2→3→4 가 전부 서로 다른 그림이다.
   2) 4차 발밑 문양이 적보다 아래에 깔린다. 이 게임의 피해는 '몇 마리에게
      둘러싸였나'(포위 배수 최대 4.2배)를 눈으로 세는 데 걸려 있어서,
      문양이 적 위에 그려지면 그 읽기가 통째로 막힌다.
   3) 겹을 네 장 다 두른 상태로도 프레임이 무너지지 않는다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);

  const out = await pg.evaluate(() => {
    selectedClass = CLASSES.findIndex(c => c.key === 'mage');
    Game.reset(); Game.state = 'playing';
    Game.updateSpawning = () => {};
    inputVector = () => ({ x: 0, y: 0 });
    player.weapons.length = 0;
    drawStanceWorld = () => {};                 // 자세 표시가 계급 표시를 덮으면 잰 값이 흐려진다
    for (const e of enemies) { e.active = false; e.dying = false; }

    /* 실제 놀이에서 열리는 사슬만 쓴다 — 1~3차는 앞 마디를 부모로 삼고,
       4차만 직업을 부모로 삼는다(3차 최종형이 32종이라 직업당 3종으로 묶여 있다). */
    const chain = []; let from = 'mage';
    for (let t = 1; t <= 4; t++) {
      const c = ADVANCES.filter(a => a.tier === t && a.from === (t === 4 ? 'mage' : from));
      if (!c.length) return { err: `${t}차에서 사슬이 끊겼다 (from=${from})` };
      chain.push(c[0]); from = c[0].key;
    }

    const R = 46, box = { x: 640 - R, y: 380 - R, w: R * 2, h: R * 2 };
    const shot = () => {
      Game.time = 3.0;                          // 흔들림·회전을 같은 위상에 세운다
      drawWorld();
      const d = ctx.getImageData(box.x, box.y, box.w, box.h).data;
      let sum = 0, on = 0;
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i] * 65536 + d[i + 1] * 256 + d[i + 2];
        sum = (sum * 31 + v) >>> 0;
        if (d[i] + d[i + 1] + d[i + 2] > 90) on++;
      }
      return { h: sum, on };
    };

    const seen = [];
    for (let t = 0; t <= 4; t++) {
      player.advance.length = 0;
      for (let i = 0; i < t; i++) player.advance.push(chain[i]);
      seen.push(shot());
    }

    // 4차를 두른 채로 적 마흔에 둘러싸인다 — 문양이 적을 덮는지 본다
    const clear = seen[4].on;
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TAU * 3.7, r = 34 + (i % 6) * 10;
      const e = Game.spawnEnemy('slime', player.x + Math.cos(a) * r, player.y + Math.sin(a) * r);
      if (e) { e.spd = 0; e.hp = e.maxHp = 1e9; }
    }
    drawWorld();
    // 적 픽셀이 몇 칸이나 보이는지 — 슬라임 초록만 센다
    const d = ctx.getImageData(box.x, box.y, box.w, box.h).data;
    let green = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i + 1] > 110 && d[i + 1] > d[i] * 1.35 && d[i + 1] > d[i + 2] * 1.35) green++;

    const t0 = performance.now();
    for (let f = 0; f < 60; f++) drawWorld();
    const ms = (performance.now() - t0) / 60;

    return { hashes: seen.map(s => s.h), lit: seen.map(s => s.on), clear, green,
             ms: +ms.toFixed(2), total: box.w * box.h };
  });

  console.log(JSON.stringify(out));
  const fail = [];
  if (out.err) fail.push(out.err);
  else {
    const uniq = new Set(out.hashes);
    if (uniq.size !== 5) fail.push(`계급 다섯 단계 중 ${uniq.size} 가지만 서로 달랐다 — 겹이 안 보인다`);
    for (let t = 1; t <= 4; t++)
      if (out.lit[t] <= out.lit[t - 1])
        fail.push(`${t}차가 ${t - 1}차보다 밝은 칸이 늘지 않았다 (${out.lit[t - 1]} → ${out.lit[t]})`);
    if (out.green < out.total * .08)
      fail.push(`적에 둘러싸였는데 적 픽셀이 ${out.green} 칸뿐이다 — 문양이 난전을 덮고 있다`);
    if (out.ms > 22) fail.push(`네 겹을 두르면 한 프레임이 ${out.ms}ms 다`);
  }
  if (errs.length) fail.push('페이지 오류: ' + errs[0]);
  console.log(fail.length ? 'FAIL\n' + fail.join('\n') : 'PASS');
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();

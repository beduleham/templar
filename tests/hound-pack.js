/* 회귀: 사냥개 무리가 쌓이지 않는가.

   사람이 네 직업 전부로 5분 30초 전후에 둘러싸여 죽었고, 원인이 여기였다
   (2026-09-04 계측). 사냥개는 속도 248 로 플레이어보다 빨라 죽여야만 떨어지는데,
   못 잡으면 다음 무리가 30초 뒤에 또 오고 앞 무리는 그대로 남았다.

     곁의 사냥개   6:00 에 6마리 · 6:30 에 11~16 · 9:30 에 26마리
     버티는 시간   12초 → 2초 (30초 만에)

   설계 의도(「계속 도망만 칠 수는 없다」)는 옳다. 쌓이는 것이 문제였다.

   재는 것:
     1. 첫 무리가 6:30 전에는 안 나온다
     2. 새 무리가 오면 앞 무리는 물러간다 — 무한정 안 쌓인다
     3. 일반 스폰으로 나온 사냥개는 안 걷힌다 (무리 소속만 물러간다)
     4. 무리를 다 잡으면 값을 준다. 한 번만
     5. **실수의 값** — 6:00 에 가만히 서서 4초 이상 버틴다
        (이 자가 절벽을 잡는다. 12초에서 3.5초로 떨어진 것이 원래 문제였다)

   실행: node tests/hound-pack.js */
const { chromium } = require('playwright');
const { BOT } = require('../tests/bot.js');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  await pg.evaluate((S) => { (0, eval)(S); }, BOT);

  const fail = [], out = [];

  // ── 1~4. 구조 — 시각을 직접 옮겨 무리를 두 번 부른다
  const mech = await pg.evaluate(() => {
    const o = {};
    const hounds = () => enemies.filter(e => e.active && e.type.name === '사냥개');
    selectedClass = 0; Game.reset(); player.godMode = true;
    o.from = typeof HOUND_FROM !== 'undefined' ? HOUND_FROM : null;

    // 1. 이르면 안 나온다
    Game.time = 300.005; Game.updateSpawning(1 / 60);
    o.early = hounds().length;

    // 일반 스폰으로 나온 사냥개 하나 — 무리 소속이 아니다
    const loose = Game.spawnEnemy('hound', player.x + 300, player.y);
    o.looseId = loose && loose.id;

    // 2. 첫 무리
    Game.time = o.from + .005; Game.updateSpawning(1 / 60);
    const p1 = hounds().filter(e => e.houndPack);
    o.pack1 = p1.length; o.packId1 = Game.houndPack; o.left1 = Game.houndLeft;

    // 3. 다음 무리 — 앞 무리는 물러가고, 일반 스폰은 남는다
    Game.time = o.from + 30.005; Game.updateSpawning(1 / 60);
    const p2 = hounds().filter(e => e.houndPack);
    o.pack2 = p2.length;
    o.oldLeft = p2.filter(e => e.houndPack < Game.houndPack).length;
    o.looseAlive = enemies.some(e => e.active && e.id === o.looseId);

    // 4. 다 잡으면 값을 준다 — 한 번만
    const gem0 = pickups.filter(p => p.active).length;
    let flashes = 0;
    for (const e of hounds()) if (e.houndPack === Game.houndPack) {
      damageEnemy(e, e.hp + 1e6, player.x, player.y, 0, 'holy');
      if (Game.lmFlashText === '무리를 흩었다') { flashes++; Game.lmFlashText = ''; }
    }
    o.reward = { flashes, drop: pickups.filter(p => p.active).length - gem0, done: Game.houndDone };
    return o;
  });

  out.push(`구조   첫 무리 ${mech.from}초부터 · 무리 ${mech.pack1} → ${mech.pack2}마리 · 남은 옛 무리 ${mech.oldLeft}`);
  if (mech.from !== 390) fail.push(`HOUND_FROM 이 ${mech.from} — 390(6:30) 이어야 한다`);
  if (mech.early) fail.push(`${mech.from}초 전인 5:00 에 사냥개가 ${mech.early}마리 나왔다`);
  if (!(mech.pack1 >= 8)) fail.push(`첫 무리가 ${mech.pack1}마리뿐이다`);
  if (mech.oldLeft) fail.push(`새 무리가 왔는데 옛 무리 ${mech.oldLeft}마리가 남았다 — 쌓인다`);
  if (!mech.looseAlive) fail.push('일반 스폰으로 나온 사냥개까지 걷어갔다 — 무리 소속만 물러가야 한다');
  out.push(`보상   "무리를 흩었다" ${mech.reward.flashes}회 · 떨군 것 ${mech.reward.drop}`);
  if (mech.reward.flashes !== 1) fail.push(`무리 보상이 ${mech.reward.flashes}회 — 정확히 한 번이어야 한다`);
  if (mech.reward.drop < 1) fail.push('무리를 다 잡았는데 아무것도 안 나온다');

  // ── 5. 실수의 값 — 절벽이 돌아왔는지
  const cliff = await pg.evaluate(async () => {
    const res = [];
    for (const ci of [1, 2]) {                     // 전사 · 추적자 — 절벽이 가장 깊던 둘
      selectedClass = ci; Game.reset(); botInstall(); player.godMode = false;
      const pick = () => { let g = 0;
        while ((Game.state === 'levelup' || Game.state === 'advance') && g++ < 50) {
          const C = Game.choices, hpF = player.hp / player.stats.maxHp;
          Game.applyChoice((hpF < .4 && C.find(c => c.type === 'heal')) || C.find(c => c.type === 'passive') || C.find(c => c.type !== 'heal') || C[0]);
        } };
      for (let i = 0; i < 60 * 362 && Game.time < 360; i++) {
        if (Game.state === 'playing') { botTick(1 / 60, true); player.hp = player.stats.maxHp; }
        update(1 / 60); pick();
      }
      const hp0 = player.stats.maxHp; player.hp = hp0;
      const BT = botTick; botTick = () => {};       // 손을 뗀다
      let lived = 0, dogs = 0;
      for (let k = 0; k < 60 * 12; k++) {
        update(1 / 60); pick();
        lived = k / 60;
        dogs = Math.max(dogs, nearestEnemies(player.x, player.y, 110, 60).filter(e => e.type.name === '사냥개').length);
        if (player.hp <= 0 || Game.state !== 'playing') break;
      }
      botTick = BT; botRestore();
      res.push({ ci, lived: +lived.toFixed(1), dogs, alive: Game.alive, lv: player.level });
    }
    return res;
  });
  const NM = ['성기사', '전사', '추적자', '마법사'];
  for (const r of cliff) {
    out.push(`6:00   ${NM[r.ci]} 가만히 ${r.lived}초 버팀 · 곁의 사냥개 ${r.dogs} · 동시 적 ${r.alive} · Lv${r.lv}`);
    if (r.lived < 4) fail.push(`${NM[r.ci]}: 6:00 에 가만히 ${r.lived}초 만에 죽는다 — 4초 이상이어야 한다 (절벽이 돌아왔다)`);
    if (r.dogs > 12) fail.push(`${NM[r.ci]}: 곁의 사냥개가 ${r.dogs}마리 — 무리가 쌓이고 있다`);
  }

  fail.push(...errs);
  await b.close();
  console.log(out.join('\n'));
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  process.exit(fail.length ? 1 : 0);
})();

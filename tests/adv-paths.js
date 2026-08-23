const { chromium } = require('playwright');
const ADV_TIERS_EXPECTED = 4;   // 4차 초월까지
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1400, height: 820 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);

  // 각성 경로를 전부 통과시킨다.
  // 시간·징표 관문이 생긴 뒤로는 레벨만 올려서는 각성이 열리지 않는다 —
  // Game.time 을 관문 뒤로 밀고 징표도 단계만큼 채워야 한다.
  const res = await pg.evaluate(() => {
    const out = [];
    for (let cls = 0; cls < 4; cls++) {
      for (const p1 of [0,1]) for (const p2 of [0,1]) for (const p3 of [0,1]) for (const p4 of [0,1,2]) {
        selectedClass = cls; Game.reset();
        const base = { skill: curSkill().name, dmg: player.stats.damage, hp: player.stats.maxHp };
        const path = [];
        const picks = [p1, p2, p3, p4];
        for (let lv = 1; lv < 60; lv++) {
          player.sigils = 9;             // 단계만큼 소비되므로 넉넉히
          Game.time = RUN_TIME;          // 시간 관문 통과
          player.xp = player.xpNext; Game.levelUp();
          let g = 0;
          while ((Game.state === 'levelup' || Game.state === 'advance') && g++ < 6) {
            if (Game.state === 'advance') {
              const t = player.advance.length;
              const c = Game.choices[Math.min(picks[t] ?? 0, Game.choices.length - 1)];
              path.push(c.name);
              Game.applyChoice(c);
            } else Game.applyChoice(Game.choices[0]);
          }
        }
        // 각성 상태에서 몇 프레임 굴려 런타임 예외를 잡는다
        for (let i = 0; i < 60; i++) Game.spawnEnemy('zombie', player.x + rnd(-200,200), player.y + rnd(-200,200));
        player.res = 100; useSkill();
        for (let i = 0; i < 120; i++) { if (Game.state !== 'playing') Game.state = 'playing'; update(1/60); }
        out.push({ cls: player.cls.name, path, tiers: player.advance.length,
                   skill: curSkill().name,
                   dmgX: +(player.stats.damage / base.dmg).toFixed(2),
                   hpX: +(player.stats.maxHp / base.hp).toFixed(2) });
      }
    }
    return out;
  });
  const full = res.filter(r => r.tiers === ADV_TIERS_EXPECTED).length;
  console.log(`${ADV_TIERS_EXPECTED}차까지 도달한 경로:`, full, '/', res.length);
  const seen = new Set();
  for (const r of res) { const k = r.path.join('→'); if (!seen.has(k)) { seen.add(k); } }
  console.log('고유 3차형:', new Set(res.map(r => r.path[2])).size, '종');
  console.log('고유 최종형:', new Set(res.map(r => r.path[ADV_TIERS_EXPECTED - 1])).size, '종');
  // 대표 몇 개만 출력
  for (const r of res.filter((_,i) => i % 4 === 0))
    console.log(` ${r.cls}: ${r.path.join(' → ')}  |  스킬 ${r.skill} · 피해 ×${r.dmgX} · 체력 ×${r.hpX}`);
  const dmg = res.map(r => r.dmgX), hp = res.map(r => r.hpX);
  console.log('최종 각성 배수 — 피해 ×' + Math.min(...dmg).toFixed(1) + '~' + Math.max(...dmg).toFixed(1)
            + ' · 체력 ×' + Math.min(...hp).toFixed(1) + '~' + Math.max(...hp).toFixed(1));
  console.log(errs.length ? errs.slice(0,5).join('\n') : 'no errors');
  await b.close();
  process.exit(full === res.length && !errs.length ? 0 : 1);
})();

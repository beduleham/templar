const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1400, height: 820 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);
  await pg.keyboard.press('2');
  await pg.waitForTimeout(300);

  // 모든 몬스터 종류를 실제로 굴려본다
  const r = await pg.evaluate(() => {
    const log = [];
    Game.time = 600;
    player.base.maxHp = 1e7; recomputeStats(); player.hp = 1e7;
    const kinds = Object.keys(ENEMY_TYPES);
    log.push('몬스터 종류: ' + kinds.length + '종 — ' + kinds.join(', '));
    for (const k of kinds) {
      for (const rk of [RANKS.common, RANKS.elite, RANKS.rare]) {
        const e = Game.spawnEnemy(k, player.x + rnd(-300,300), player.y + rnd(-300,300), rk);
        if (!e) { log.push('!! 스폰 실패 ' + k); continue; }
      }
    }
    let n = 0; for (const e of enemies) if (e.active) n++;
    log.push('스폰 ' + n + '마리 (등급 3종 × ' + kinds.length + ')');
    // 300프레임 굴려 행동·탄·장판이 예외 없이 도는지
    for (let i = 0; i < 300; i++) { player.hp = 1e7; update(1/60); }
    log.push('300프레임 후 — 적 탄 ' + eshots.filter(p=>p.active).length
           + ' · 장판 ' + hazards.filter(h=>h.active).length
           + ' · 살아있는 적 ' + enemies.filter(e=>e.active).length);
    // 등급별 스탯이 실제로 갈리는지
    const z = (rk) => { const e = Game.spawnEnemy('zombie', 9e4, 9e4, rk); const v = {hp: Math.round(e.maxHp), dmg: Math.round(e.dmg), xp: e.type.xp * rk.xp, r: +e.r.toFixed(1)}; e.active = false; return v; };
    log.push('좀비 등급별: 일반 ' + JSON.stringify(z(RANKS.common))
           + ' / 정예 ' + JSON.stringify(z(RANKS.elite))
           + ' / 희귀 ' + JSON.stringify(z(RANKS.rare)));
    // 보스 3종
    for (let i = 0; i < 3; i++) {
      const bk = BOSS_ORDER[i];
      const e = Game.spawnEnemy(bk, player.x + 300, player.y);
      log.push('보스' + (i+1) + ' ' + e.type.title + ' — 체력 ' + Math.round(e.maxHp).toLocaleString('ko-KR')
             + ' 피해 ' + Math.round(e.dmg));
      for (let f = 0; f < 400; f++) { player.hp = 1e7; update(1/60); }
      log.push('   400프레임 구동 후 적 탄 ' + eshots.filter(p=>p.active).length
             + ' · 장판 ' + hazards.filter(h=>h.active).length + ' · 총 적 ' + enemies.filter(x=>x.active).length);
      for (const x of enemies) if (x.active && x.boss) killEnemy(x, 'physical');
    }
    return log;
  });
  console.log(r.join('\n'));
  await pg.screenshot({ path: 'mob-play.png' });
  console.log(errs.length ? errs.slice(0,5).join('\n') : 'no errors');
  await b.close();
})();

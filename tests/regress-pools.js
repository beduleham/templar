const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1400, height: 820 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);
  await pg.keyboard.press('4');
  await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => {
    Game.time = 600; player.level = 42;
    player.base.maxHp = 1e7; recomputeStats(); player.hp = 1e7;
    const log = [];
    let xpBefore = 0;
    for (let n = 0; n < 1400; n++) {
      const a = Math.random()*6.28, r2 = 600 + Math.random()*900;
      const e = Game.spawnEnemy('bat', player.x + Math.cos(a)*r2, player.y + Math.sin(a)*r2);
      if (e) { e.hp = 1; killEnemy(e, 'physical'); }
    }
    const sumXp = () => gems.reduce((a,g) => a + (g.active ? g.value : 0), 0);
    log.push('보석 ' + gems.filter(g=>g.active).length + '/' + gems.length
           + ' · 획득물 ' + pickups.filter(p=>p.active).length + '/' + pickups.length);
    // 포화 상태에서 추가 처치가 경험치를 남기는가 (총량 기준)
    xpBefore = sumXp();
    const e2 = Game.spawnEnemy('brute', player.x + 40, player.y);
    if (e2) killEnemy(e2, 'physical');
    const gained = sumXp() - xpBefore;
    log.push('포화 상태에서 추가 처치 → 경험치 총량 +' + gained + (gained > 0 ? '  OK' : '  실패'));
    // 근처에 새 보석이 생겼는가 (화면에서 보이는가)
    const near = gems.filter(g => g.active && Math.hypot(g.x-player.x, g.y-player.y) < 200).length;
    log.push('플레이어 200px 안 보석 ' + near + '개' + (near > 0 ? '  OK' : '  실패'));
    // 징표
    const g = Game.spawnEnemy('guardian', player.x + 60, player.y);
    if (g) { g.sigilKey = 'test'; killEnemy(g, 'physical'); }
    const s1 = pickups.filter(p=>p.active && p.kind==='sigil').length;
    log.push('파수꾼 → 징표 ' + s1 + '개' + (s1 > 0 ? '  OK' : '  실패'));
    const bo = Game.spawnEnemy('boss1', player.x + 90, player.y);
    if (bo) killEnemy(bo, 'physical');
    const s2 = pickups.filter(p=>p.active && p.kind==='sigil').length;
    log.push('보스 → 징표 누적 ' + s2 + '개' + (s2 > s1 ? '  OK' : '  실패'));
    // 징표가 밀려나지 않는지: 이후 대량 처치
    for (let n = 0; n < 400; n++) {
      const e = Game.spawnEnemy('bat', player.x + rnd(-900,900), player.y + rnd(-900,900));
      if (e) { e.hp = 1; killEnemy(e, 'physical'); }
    }
    const s3 = pickups.filter(p=>p.active && p.kind==='sigil').length;
    log.push('400회 추가 처치 후 징표 ' + s3 + '개 유지' + (s3 >= s2 ? '  OK' : '  실패'));
    return { log, pass: gained > 0 && near > 0 && s1 > 0 && s2 > s1 && s3 >= s2 };
  });
  console.log(r.log.join('\n'));
  console.log(errs.length ? errs.join('\n') : 'no errors');
  console.log(r.pass && !errs.length ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(r.pass && !errs.length ? 0 : 1);
})();

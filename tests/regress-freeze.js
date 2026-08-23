const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1400, height: 820 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);

  // 신고된 시나리오 그대로: 마법사 → 번개 무기 획득(감전 폭풍 해금) → 곧바로 레벨업 화면
  await pg.keyboard.press('4');
  await pg.waitForTimeout(300);
  const st = await pg.evaluate(() => {
    Game.time = 200;
    addWeapon('bolt');                       // 냉기(마법 화살) + 뇌전 → 감전 폭풍 해금
    const flashed = Game.comboFlash > 0;
    player.xp = player.xpNext; Game.levelUp();   // 배너가 살아 있는 채로 레벨업 화면 진입
    return { flashed, combos: [...player.combos], state: Game.state, flash: +Game.comboFlash.toFixed(1) };
  });
  console.log('해금 직후:', JSON.stringify(st));

  // 레벨업 화면이 실제로 그려지는지 — 캔버스 중앙 상단에 "LEVEL UP!" 픽셀이 있어야 한다
  await pg.waitForTimeout(700);
  const drawn = await pg.evaluate(() => {
    const dpr = canvas.width / 1280;
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let bright = 0;
    for (let y = 90; y < 130; y++) for (let x = 500; x < 780; x++) {
      const i = (Math.round(y * dpr) * canvas.width + Math.round(x * dpr)) * 4;
      if (d[i] + d[i+1] + d[i+2] > 380) bright++;
    }
    return { titlePixels: bright, state: Game.state, flash: +Game.comboFlash.toFixed(2) };
  });
  console.log('레벨업 화면 렌더:', JSON.stringify(drawn));

  // 선택 후에도 정상 진행되는지
  await pg.keyboard.press('1');
  await pg.waitForTimeout(500);
  const after = await pg.evaluate(() => ({ state: Game.state, t: +Game.time.toFixed(1), lv: player.level }));
  console.log('선택 후:', JSON.stringify(after));

  const ok = drawn.titlePixels > 200 && after.state === 'playing' && errs.length === 0;
  console.log(errs.length ? '에러:\n' + errs.slice(0, 3).join('\n') : 'no errors');
  console.log(ok ? 'PASS — 레벨업 화면이 그려지고 게임이 계속 진행된다' : 'FAIL');
  await b.close();
  process.exit(ok ? 0 : 1);
})();

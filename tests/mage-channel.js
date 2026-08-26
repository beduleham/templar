/* 마법사의 「영창」이 실제로 손에 들어오는가.

   마법사는 '멈춰서 영창하면 화력이 최고'인 직업이다. 그런데 재 보니
   그 화력이 실제로는 없었다.

     · 3단계를 쌓는 데 2.4초가 드는데, 감쇠가 3.4/초라 0.88초만 움직이면 통째로 날아갔다.
       적을 피해 한 발 물러서는 것만으로 전부 잃는다는 뜻이다.
     · 피해 배수가 floor(단계) 로 끊겨 0.99 단계가 0 과 똑같았다. 쌓는 동안 보상이 없다.
     · 결과: 2초 리듬으로 절반을 멈춰 서 있어도 실현 배수가 ×1.11 이었다. 설계값은 ×1.78 이다.

   또 하나 재고 알았다 — 1분이 지나면 반경 210 안에 적이 없는 시간이 0% 다.
   '거리를 벌리고 멈춘다'가 성립하지 않으므로, 멈추는 값은 적 한가운데서 치러야 한다.
   그래서 영창이 스스로를 지키게 했다(단계당 -9%).

   이 테스트는 승패를 보지 않는다. 승패는 표본이 적어 흔들린다 —
   실제로 코드를 하나도 안 고친 성기사가 9:42 에서 15:00 으로 '좋아진' 적이 있다.
   대신 리듬을 고정하고 실현 배수를 직접 잰다. 이건 흔들리지 않는다.

   실행: node tests/mage-channel.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 15000 });

  const r = await pg.evaluate(() => {
    Sfx.on = false; Music.on = false; Opt.sfx = 0; Opt.music = 0;
    const real = inputVector;
    let vx = 0, vy = 0;
    inputVector = () => ({ x: vx, y: vy });

    const mageIdx = CLASSES.findIndex(c => c.key === 'mage');
    // 정해진 리듬으로 굴리며 실현된 배수를 잰다
    const duty = (period, f, secs) => {
      Game.reset(mageIdx);
      player.base.maxHp = 1e7; recomputeStats(); player.hp = player.stats.maxHp;
      let dmg = 0, armor = 0, n = 0, maxCh = 0;
      for (let i = 0; i < 60 * secs; i++) {
        const t = (i % Math.round(period * 60)) / 60;
        vx = t < f * period ? 0 : 1; vy = 0;
        if (Game.state === 'levelup' || Game.state === 'advance') { Game.applyChoice(Game.choices[0]); continue; }
        if (Game.state !== 'playing') Game.state = 'playing';
        update(1 / 60);
        player.hp = player.stats.maxHp;
        dmg += player.dynDmg; armor += player.dynArmor; n++;
        maxCh = Math.max(maxCh, player.channel);
      }
      return { dmg: +(dmg / n).toFixed(3), armor: +(armor / n).toFixed(3), maxCh: +maxCh.toFixed(2) };
    };

    const out = { r2: duty(2, .5, 60), r4: duty(4, .5, 60), still: duty(10, 1, 20) };

    // 문턱 효과는 정수 단계로 갈려야 한다 — 서리막(2단계) · 관통(3단계)
    Game.reset(mageIdx);
    player.base.maxHp = 1e7; recomputeStats(); player.hp = player.stats.maxHp;
    vx = 0; vy = 0;
    const veil = [];
    for (let i = 0; i < 60 * 4; i++) {
      if (Game.state !== 'playing') Game.state = 'playing';
      update(1 / 60);
      player.hp = player.stats.maxHp;
      veil.push({ ch: +player.channel.toFixed(2), veil: Math.round(player.frostVeil) });
    }
    out.veilAt1 = veil.find(v => v.ch >= 1 && v.ch < 1.9);
    out.veilAt2 = veil.find(v => v.ch >= 2.1);

    // 움직여도 한 번에 다 잃지는 않는가
    Game.reset(mageIdx);
    player.base.maxHp = 1e7; recomputeStats(); player.hp = player.stats.maxHp;
    vx = 0; vy = 0;
    for (let i = 0; i < 60 * 4; i++) { if (Game.state !== 'playing') Game.state = 'playing'; update(1 / 60); player.hp = player.stats.maxHp; }
    const full = player.channel;
    vx = 1;
    for (let i = 0; i < 60; i++) { if (Game.state !== 'playing') Game.state = 'playing'; update(1 / 60); player.hp = player.stats.maxHp; }
    out.afterMove = { from: +full.toFixed(2), to: +player.channel.toFixed(2) };

    inputVector = real;
    return out;
  });

  console.log(`  2초 리듬·절반 정지   피해 ×${r.r2.dmg}  방어 ×${r.r2.armor}  (최대 단계 ${r.r2.maxCh})`);
  console.log(`  4초 리듬·절반 정지   피해 ×${r.r4.dmg}  방어 ×${r.r4.armor}  (최대 단계 ${r.r4.maxCh})`);
  console.log(`  계속 정지          피해 ×${r.still.dmg}  방어 ×${r.still.armor}`);
  console.log(`  1초 움직인 뒤 단계   ${r.afterMove.from} → ${r.afterMove.to}`);
  console.log(`  서리막  1단계 ${r.veilAt1 ? r.veilAt1.veil : '?'}  ·  2단계 ${r.veilAt2 ? r.veilAt2.veil : '?'}`);

  const checks = [
    // 옛 값은 ×1.11 이었다. 리듬을 타는 플레이가 설계값(×1.78)의 8할에는 닿아야 한다
    ['2초 리듬에서 배수가 산다', r.r2.dmg >= 1.4],
    ['4초 리듬에서도 산다', r.r4.dmg >= 1.35],
    ['계속 멈추면 최대에 가깝다', r.still.dmg >= 1.7],
    ['영창이 방어를 준다', r.still.armor <= .78 && r.r2.armor < 1],
    ['한 걸음에 다 잃지 않는다', r.afterMove.to >= r.afterMove.from - 1.4 && r.afterMove.to < r.afterMove.from],
    ['서리막은 2단계부터', r.veilAt1 && r.veilAt1.veil === 0 && r.veilAt2 && r.veilAt2.veil > 0],
  ];
  console.log('');
  for (const [what, ok] of checks) console.log(`  ${what.padEnd(20)} ${ok ? 'OK' : '실패'}`);
  console.log(errs.length ? errs.slice(0, 4).join('\n') : 'no errors');

  const pass = checks.every(c => c[1]) && !errs.length;
  console.log(pass ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();

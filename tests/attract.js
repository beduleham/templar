/* 어트랙트 데모가 '진짜'를 오염시키지 않는가.

   메뉴 뒤에서 실제 시뮬레이션을 굴리는 이상, 데모가 남기는 흔적이 진짜 기록과
   섞이면 안 된다. 조용히 망가지는 종류의 버그라 눈으로는 못 잡는다.

   확인하는 것:
     1. 최고 기록(localStorage ts_best)이 데모로 갱신되지 않는가
     2. 영혼(Meta.souls)이 데모로 늘지 않는가
     3. 데모가 소리를 내지 않는가
     4. 메뉴 상태가 데모 때문에 playing 으로 새지 않는가
     5. 화면 흔들림·음악 모드가 메뉴에 새지 않는가
     6. 데모가 실제로 굴러가긴 하는가 (적이 죽고 시간이 흐른다)

   실행: node tests/attract.js */
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
  await pg.waitForTimeout(300);

  const r = await pg.evaluate(() => {
    /* 소리를 '호출 횟수'로 세면 안 된다 — 막힌 호출까지 세어 버린다.
       실제로 울린 것만 세려면 오디오 노드가 생겼는지를 봐야 하고,
       그래야 play() 를 거치지 않는 경로가 생겨도 걸린다. */
    Sfx.on = true; Sfx.init();
    window.__sounds = 0;
    const realOsc = Sfx.ctx.createOscillator.bind(Sfx.ctx);
    Sfx.ctx.createOscillator = function () { window.__sounds++; return realOsc(); };

    const before = {
      best: Game.bestTime,
      stored: localStorage.getItem('ts_best'),
      souls: Meta.souls,
      state: Game.state,
    };

    // 시작 화면에서 데모를 오래 굴린다. 죽고 새 판이 깔리는 것까지 보려면 넉넉해야 한다.
    Game.state = 'intro';
    let kills = 0, shakeLeak = 0, stateLeak = 0, musicLeak = 0;
    for (let f = 0; f < 60 * 100; f++) {
      const k0 = Game.kills;
      if (!Attract.on) Attract.start();
      Attract.update(1 / 60);
      if (Game.kills > k0) kills += Game.kills - k0;
      if (Game.state !== 'intro') stateLeak++;
      if (cam.shake > 0) shakeLeak++;
      if (Music.mode !== 'menu') musicLeak++;
    }

    const after = {
      best: Game.bestTime,
      stored: localStorage.getItem('ts_best'),
      souls: Meta.souls,
      state: Game.state,
    };
    return { before, after, sounds: window.__sounds, kills, stateLeak, shakeLeak, musicLeak,
             demoTime: Math.round(Game.time), restarts: Attract.life < 75 };
  });

  /* 미룬 소리(레벨업·사망·각성 팡파레)는 시뮬레이션이 끝난 뒤에 울린다.
     루프 안에서만 세면 그 누출을 놓치므로, 예약이 다 터질 때까지 기다렸다 다시 센다. */
  await pg.waitForTimeout(1200);
  r.soundsAfter = await pg.evaluate(() => window.__sounds);

  const checks = [
    ['최고 기록 안 바뀜', r.before.best === r.after.best && r.before.stored === r.after.stored],
    ['영혼 안 늘어남', r.before.souls === r.after.souls],
    ['소리 안 남', r.sounds === 0 && r.soundsAfter === 0],
    ['메뉴 상태 유지', r.stateLeak === 0 && r.after.state === 'intro'],
    ['화면 안 흔들림', r.shakeLeak === 0],
    ['음악 모드 유지', r.musicLeak === 0],
    ['데모가 실제로 굴러감', r.kills > 0],
  ];
  for (const [what, ok] of checks) console.log(`  ${what.padEnd(16)} ${ok ? 'OK' : '실패'}`);
  console.log(`  (데모 처치 ${r.kills} · 울린 소리 ${r.sounds}→${r.soundsAfter} · 상태 누출 ${r.stateLeak}프레임)`);
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no errors');

  const pass = checks.every(c => c[1]) && !errs.length;
  console.log(pass ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();

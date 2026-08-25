/* 설정이 저장되고, 실제로 효과가 있는가.

   여태 설정이라고는 M(소리 전체 끄기) 하나였다. 음악만 끄고 효과음은 듣는다든가,
   화면 흔들림이 불편하다든가 — 어느 것도 손댈 수가 없었다.

   설정은 조용히 죽기 쉽다. 값은 바뀌고 저장도 되는데 정작 쓰는 쪽이 안 보고 있으면,
   화면에는 아무 이상이 없고 사용자만 '왜 안 되지' 하게 된다. 그래서 값이 아니라
   결과를 잰다 — 소리가 실제로 나는지, 화면이 실제로 흔들리는지.

   실행: node tests/options.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 15000 });

  const r = await pg.evaluate(() => {
    const out = {};
    Sfx.on = true; Sfx.init();
    // 실제로 울린 소리만 센다 (호출 횟수가 아니라 오디오 노드 생성)
    let osc = 0;
    const realOsc = Sfx.ctx.createOscillator.bind(Sfx.ctx);
    Sfx.ctx.createOscillator = function () { osc++; return realOsc(); };

    // 1. 효과음 0 이면 소리가 안 난다
    Opt.sfx = 0; Opt.apply();
    osc = 0; for (let i = 0; i < 5; i++) Sfx.play(440, .05);
    out.mutedGain = Sfx.master.gain.value;
    Opt.sfx = 4; Opt.apply();
    osc = 0; for (let i = 0; i < 5; i++) Sfx.play(440, .05);
    out.loudCalls = osc;
    out.loudGain = Sfx.master.gain.value;

    // 2. 음악 음량이 반영되는가
    Music.mode = 'play';
    Opt.music = 0; out.musicOff = Music.vol();
    Opt.music = 2; out.musicHalf = Music.vol();
    Opt.music = 4; out.musicFull = Music.vol();

    /* 3. 화면 흔들림 — 값이 아니라 '화면이 옮겨졌는가'를 본다.
       translate 를 전부 세면 안 된다. 월드를 화면으로 옮기는 호출이 1,000px 씩 나와
       흔들림을 꺼도 켠 것과 같은 수가 나온다 — 한 프레임의 '첫' translate 만이 흔들림이다. */
    const shakeShift = () => {
      selectedClass = 0; Game.reset(); Game.state = 'playing';
      let maxOff = 0, first = true;
      const realT = ctx.translate.bind(ctx);
      ctx.translate = function (x, y) {
        if (first) { maxOff = Math.max(maxOff, Math.abs(x), Math.abs(y)); first = false; }
        return realT(x, y);
      };
      for (let i = 0; i < 30; i++) { cam.shake = 40; first = true; frame(performance.now()); }
      ctx.translate = realT;
      return Math.round(maxOff);
    };
    Opt.shake = 0; out.shakeOff = shakeShift();
    Opt.shake = 2; out.shakeOn = shakeShift();

    // 4. 피해 숫자 · 이름표
    const countNums = () => {
      selectedClass = 0; Game.reset(); Game.state = 'playing';
      for (const o of numbers) o.active = false;
      const e = Game.spawnEnemy('zombie', player.x + 60, player.y);
      e.hp = 1e9; damageEnemy(e, 10, player.x, player.y, 0, 'physical');
      return numbers.filter(o => o.active).length;
    };
    Opt.numbers = 0; out.numsOff = countNums();
    Opt.numbers = 1; out.numsOn = countNums();

    let labels = 0;
    const realFill = ctx.fillText.bind(ctx);
    const countLabels = () => {
      selectedClass = 0; Game.reset(); Game.state = 'playing';
      for (let i = 0; i < 6; i++) Game.spawnEnemy('zombie', player.x + 60 + i * 30, player.y);
      labels = 0;
      ctx.fillText = function (t) { if (t === '좀비') labels++; return realFill.apply(null, arguments); };
      frame(performance.now());
      ctx.fillText = realFill;
      return labels;
    };
    Opt.names = 0; out.namesOff = countLabels();
    Opt.names = 1; out.namesOn = countLabels();

    // 5. 저장되는가
    Opt.sfx = 1; Opt.music = 3; Opt.shake = 0; Opt.names = 0; Opt.numbers = 0; Opt.save();
    const stored = JSON.parse(localStorage.getItem('ts_opt') || '{}');
    out.stored = stored;
    Opt.sfx = 9; Opt.music = 9; Opt.load();       // 다시 읽으면 저장한 값으로 돌아온다
    out.reloaded = { sfx: Opt.sfx, music: Opt.music, shake: Opt.shake };

    // 6. 기록 지우기는 두 번 눌러야 한다
    Meta.souls = 500; Meta.levels = { vigor: 2 }; Meta.save(); Game.bestTime = 321;
    Game.wipeArm = 0; Game.wipeAsk();
    out.wipe1 = { souls: Meta.souls, best: Game.bestTime, armed: Game.wipeArm > 0 };
    Game.wipeAsk();
    out.wipe2 = { souls: Meta.souls, best: Game.bestTime, lv: Meta.lv('vigor'),
                  stored: localStorage.getItem('ts_souls') };

    Opt.sfx = 4; Opt.music = 4; Opt.shake = 2; Opt.names = 1; Opt.numbers = 1; Opt.apply();
    return out;
  });

  const checks = [
    ['효과음 0 이면 음량 0', r.mutedGain === 0],
    ['효과음 4 면 소리 남', r.loudGain > 0 && r.loudCalls === 5],
    ['음악 0 이면 무음', r.musicOff === 0],
    ['음악 절반이 절반', Math.abs(r.musicHalf * 2 - r.musicFull) < 1e-6],
    ['흔들림 0 이면 안 흔들림', r.shakeOff === 0],
    ['흔들림 기본이면 흔들림', r.shakeOn > 5],
    ['피해 숫자 끄면 안 뜸', r.numsOff === 0 && r.numsOn > 0],
    ['이름표 끄면 안 뜸', r.namesOff === 0 && r.namesOn > 0],
    ['저장됨', r.stored.sfx === 1 && r.stored.music === 3 && r.stored.shake === 0],
    ['다시 읽으면 그대로', r.reloaded.sfx === 1 && r.reloaded.music === 3 && r.reloaded.shake === 0],
    ['기록 한 번은 안 지워짐', r.wipe1.souls === 500 && r.wipe1.best === 321 && r.wipe1.armed],
    ['두 번이면 지워짐', r.wipe2.souls === 0 && r.wipe2.best === 0 && r.wipe2.lv === 0 && !r.wipe2.stored],
  ];
  for (const [what, ok] of checks) console.log(`  ${what.padEnd(20)} ${ok ? 'OK' : '실패'}`);
  console.log(`  (흔들림 ${r.shakeOff} → ${r.shakeOn}px · 이름표 ${r.namesOff} → ${r.namesOn}개`
    + ` · 숫자 ${r.numsOff} → ${r.numsOn}개)`);
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no errors');

  const pass = checks.every(c => c[1]) && !errs.length;
  console.log(pass ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();

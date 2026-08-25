/* 어느 화면 크기에서도 UI 가 화면 밖으로 나가지 않는가.

   왜 필요한가: 논리 해상도를 1280×720 으로 고정하고 있었다. 세로로 든 폰(390×844)
   에서는 390×219 짜리 띠가 됐고, 직업 카드 네 장 중 가운데 두 장만 보였다.
   고르는 화면인데 고를 수가 없었다.

   비율을 따라가게 고치는 과정에서 더 나쁜 것도 냈다 — 카드 높이를 검사하는 코드에서
   아직 선언되지 않은 변수를 읽어(TDZ) 직업 선택 화면이 통째로 빈 화면이 됐다.
   문법도 통과하고 다른 테스트도 전부 통과했다. 페이지 예외를 아무도 안 봤기 때문이다.

   방식: panel() 과 fillText() 를 감싸 '이번 프레임에 어디에 그렸는지'를 모은 뒤,
   전부 캔버스 안에 있는지 본다. 화면마다 좌표를 따로 적지 않으므로 배치를 바꿔도 안 깨진다.

   실행: node tests/layout.js */
const { chromium } = require('playwright');

const SIZES = [
  ['폰 세로', 390, 844], ['폰 가로', 844, 390], ['작은 폰', 360, 640],
  ['태블릿 세로', 820, 1180], ['노트북', 1440, 900], ['와이드', 2560, 1080],
];
const SCREENS = ['intro', 'title', 'altar', 'options', 'levelup', 'advance', 'dead', 'paused'];

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let ok = true;

  for (const [label, vw, vh] of SIZES) {
    const ctxb = await b.newContext({ viewport: { width: vw, height: vh }, hasTouch: true });
    const pg = await ctxb.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
    await pg.goto('file:///home/user/templar/game/index.html');
    await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 15000 });

    const r = await pg.evaluate(({ screens }) => {
      const out = { W, H, bad: [], blank: [] };
      // 그리는 위치를 모은다. panel 은 모든 카드가 쓰고, fillText 는 모든 글자가 쓴다.
      const boxes = [];
      /* 좌표계가 옮겨져 있을 수 있다 — 레벨업·전직 화면은 카드를 통째로 줄여 그린다.
         그래서 넘긴 좌표가 아니라 변환을 먹인 화면 좌표로 재야 한다.
         (처음엔 panel 에 변환을 안 먹여서, 멀쩡한 카드가 화면 밖이라고 나왔다) */
      const map = (x, y) => { const t = ctx.getTransform(); return { x: x * t.a + y * t.c + t.e, y: x * t.b + y * t.d + t.f, k: t.a }; };
      const _panel = panel, _text = ctx.fillText.bind(ctx);
      panel = function (x, y, w, h) {
        const p = map(x, y);
        boxes.push({ k: 'panel', x: p.x, y: p.y, w: w * p.k, h: h * p.k });
        return _panel.apply(null, arguments);
      };
      ctx.fillText = function (t, x, y) {
        const p = map(x, y), w = ctx.measureText(t).width * p.k;
        // 글꼴 크기를 뽑아 글자 상자를 만든다. 기준선(baseline)에 따라 위아래가 달라진다.
        const fs = (parseFloat((ctx.font.match(/(\d+(?:\.\d+)?)px/) || [0, 14])[1]) || 14) * p.k;
        const bl = ctx.textBaseline;
        const top = bl === 'top' || bl === 'hanging' ? p.y
          : bl === 'bottom' || bl === 'alphabetic' ? p.y - fs * .82 : p.y - fs * .58;
        const half = ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0;
        boxes.push({ k: 'text', t: String(t).slice(0, 22), x: p.x - half, y: top, w, h: fs * 1.16 });
        return _text.apply(null, arguments);
      };

      const setups = {
        intro:   () => { Game.state = 'intro'; },
        title:   () => { Game.state = 'title'; },
        altar:   () => { Meta.souls = 900; Game.introFrom = 'title'; Game.state = 'altar'; },
        levelup: () => { selectedClass = 0; Game.reset(); player.xp = player.xpNext; Game.levelUp(); },
        advance: () => { selectedClass = 0; Game.reset(); player.sigils = 9; Game.time = RUN_TIME;
                         for (let i = 0; i < 12; i++) { player.xp = player.xpNext; Game.levelUp();
                           while (Game.state === 'levelup') Game.applyChoice(Game.choices[0]); }
                         Game.checkAdvance(); },
        dead:    () => { selectedClass = 0; Game.reset(); Game.time = 300; Game.kills = 9000;
                         Game.state = 'dead'; Game.endRun(); },
        options: () => { Game.optFrom = 'intro'; Game.state = 'options'; Game.wipeArm = 2; },
        paused:  () => { selectedClass = 0; Game.reset(); Game.state = 'paused'; Game.quitArm = 2; },
      };

      for (const sc of screens) {
        setups[sc]();
        if (sc === 'advance' && Game.state !== 'advance') continue;   // 열리지 않으면 건너뛴다
        boxes.length = 0;
        mouse.x = -99; mouse.y = -99;                                  // 마우스가 카드를 고르지 않게
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        frame(performance.now());
        // 빈 화면이 아닌가 (TDZ 로 통째로 안 그려지는 사고를 잡는다)
        const d = ctx.getImageData(0, 0, W, H).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 400)
          if (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114 > 60) lit++;
        if (lit < 40) out.blank.push({ sc, lit });
        for (const x of boxes) {
          const over = x.x < -2 || x.y < -2 || x.x + x.w > W + 2 || x.y + x.h > H + 2;
          if (over) out.bad.push({ sc, ...x, x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.w) });
        }
      }
      panel = _panel; ctx.fillText = _text;
      return out;
    }, { screens: SCREENS });

    // 터치 버튼이 실제로 먹히는가 — 세로 화면에서만 확인하면 충분하다
    let touchOk = '—';
    if (label === '폰 세로') {
      await pg.evaluate(() => {
        selectedClass = 0; Game.reset(); Game.state = 'playing';
        touch.seen = true; player.res = RES_MAX; frame(performance.now());
        window.__btn = touchBtns()[0];
        window.__before = player.res;
      });
      const btn = await pg.evaluate(() => {
        const s = Math.min(innerWidth / W, innerHeight / H);
        return { x: __btn.x * s, y: __btn.y * s };
      });
      await pg.touchscreen.tap(btn.x, btn.y);
      const fired = await pg.evaluate(() => player.res < window.__before);
      touchOk = fired ? 'OK' : '실패';
      if (!fired) ok = false;
    }

    const bad = r.bad.filter(x => x.k === 'panel' || x.w > 8);   // 아주 짧은 글자는 무시
    if (bad.length || r.blank.length || errs.length) ok = false;
    console.log(`  ${label.padEnd(7)} ${String(vw).padStart(4)}x${vh} → ${r.W}x${r.H}`
      + `  화면 밖 ${String(bad.length).padStart(2)}  빈 화면 ${r.blank.length}  터치 ${touchOk}`
      + (errs.length ? '  ' + errs[0].slice(0, 60) : ''));
    for (const x of bad.slice(0, 4))
      console.log(`      [${x.sc}] ${x.k} "${x.t || ''}" (${x.x},${x.y}) 폭 ${x.w}`);
    for (const x of r.blank) console.log(`      [${x.sc}] 거의 빈 화면 (밝은 표본 ${x.lit})`);
    await ctxb.close();
  }

  console.log(ok ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(ok ? 0 : 1);
})();

/* 회귀: 첫 화면이 목업대로 서 있는가.

   회화 배경(§106)을 깔고도 화면이 예전 배치 그대로여서, 그림은 어둡고 버튼은 기사의
   가슴 한복판에 있었다. 목업의 뼈대는 셋이다 — **왼쪽 직업 목록 · 오른쪽 설명 ·
   가운데 아래 버튼**. 가운데를 비워 두는 것이 요점이고, 그래야 그림을 당겨 넣은
   뜻이 산다(§108).

   재는 것:
     1. 넓은 화면에서 왼쪽 목록의 문장 넷 · 오른쪽 설명판 · 세로 버튼 셋이 다 있다
     2. 버튼이 화면 아래쪽에 있다 — 맨 위 버튼이 55% 아래 (인물을 안 가린다)
     3. 직업 줄을 누르면 그 직업이 골라진 채 직업 선택으로 넘어간다
     4. 배경이 당겨져 있다 — 그린 크기가 화면보다 크고, 인물 띠가 밝다
     5. 좁은 화면은 예전 배치로 떨어진다 (거기서는 글자가 그림 위에 바로 앉는다)

   실행: node tests/intro-layout.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const fail = [], out = [];

  // ── 넓은 화면
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  await pg.waitForFunction('Bg.ready', null, { timeout: 20000 }).catch(() => {});

  const g = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    Game.state = 'intro'; await wait(120);
    const AR = uiArt, S9 = drawSlice9, PL = uiPlate, BD = Bg.draw;
    const crest = [], frames = [], plates = [], bg = [];
    window.uiArt = (k, cx, cy, h, a) => { if (k.startsWith('ui_crest_')) crest.push([k, cx, cy, h]); return AR(k, cx, cy, h, a); };
    window.drawSlice9 = (k, x, y, w, h, ...a) => { if (k === 'ui_panel') frames.push([x, y, w, h]); return S9(k, x, y, w, h, ...a); };
    window.uiPlate = (x, y, w, h, st) => { plates.push([x, y, w, h]); return PL(x, y, w, h, st); };
    Bg.draw = function (soft) {
      const iw = this.img.width, ih = this.img.height;
      const k = Math.max(W / iw, H / ih) * this.zoom;
      bg.push([iw * k, ih * k, soft === true]);
      return BD.call(this, soft);
    };
    await wait(120);
    const shot = { crest: crest.slice(), frames: frames.slice(), plates: plates.slice(), bg: bg.slice(), wide: introWide() };
    window.uiArt = AR; window.drawSlice9 = S9; window.uiPlate = PL; Bg.draw = BD;
    return shot;
  });

  const kinds = new Set(g.crest.map(c => c[0]));
  if (!g.wide) fail.push('1280x720 인데 넓은 배치로 안 간다');
  if (kinds.size !== 4) fail.push(`왼쪽 목록에 문장이 ${kinds.size}종 — 넷이어야 한다`);
  const framesPer = Math.round(g.frames.length / Math.max(1, g.bg.length));
  const platesPer = Math.round(g.plates.length / Math.max(1, g.bg.length));
  out.push(`목록 문장 ${kinds.size}종 · 금틀 ${framesPer}장/판 · 버튼 ${platesPer}장/판`);
  if (framesPer !== 2) fail.push(`판 하나에 금틀 ${framesPer}개 — 왼쪽 목록과 오른쪽 설명 둘이어야 한다`);
  if (platesPer !== 3) fail.push(`판 하나에 버튼 ${platesPer}개 — 시작·제단·설정 셋이어야 한다`);

  // 2. 버튼이 아래쪽에 있다
  const topBtn = Math.min(...g.plates.map(p => p[1]));
  out.push(`맨 위 버튼 y=${topBtn} (화면 720의 ${(topBtn / 720 * 100).toFixed(0)}%)`);
  if (!(topBtn >= 720 * .55)) fail.push(`맨 위 버튼이 y=${topBtn} — 화면의 55%(396) 아래여야 인물을 안 가린다`);

  // 4. 배경이 당겨져 있다
  const [dw, dh, soft] = g.bg[0] || [0, 0, false];
  out.push(`배경 ${Math.round(dw)}x${Math.round(dh)} (화면 1280x720) · 인트로 겹 ${soft ? '얕게' : '깊게'}`);
  if (!(dw > 1280 * 1.3 && dh > 720 * 1.3)) fail.push(`배경을 ${Math.round(dw)}x${Math.round(dh)} 로만 그린다 — 1.3배 넘게 당겨야 인물이 커진다`);
  if (!soft) fail.push('넓은 첫 화면인데 배경을 깊게 눌렀다 — 판마다 제 바탕이 있으므로 얕게 눌러야 한다');

  // 인물 띠가 밝다 — 통째로 누르면 0 에 가까워진다
  const mid = await pg.evaluate(() => {
    const cv = document.getElementById('game');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const W2 = cv.width, H2 = cv.height, v = [];
    for (let y = Math.round(H2 * .38); y < H2 * .58; y += 2)
      for (let x = Math.round(W2 * .38); x < W2 * .62; x += 2) {
        const i = (y * W2 + x) * 4;
        v.push(.2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]);
      }
    v.sort((a, b) => a - b);
    return { p90: v[Math.floor(v.length * .9)], med: v[Math.floor(v.length * .5)] };
  });
  out.push(`인물 띠 밝기 중앙 ${mid.med.toFixed(0)} · 90분위 ${mid.p90.toFixed(0)}`);
  /* 바는 지금 나가는 화면(70)에서 재서 정했다. '조금 어두워졌다'가 아니라
     '문지르는 겹이 다시 그림을 통째로 삼켰다'를 잡는 자리다. */
  if (mid.p90 < 45) fail.push(`인물 띠의 90분위가 ${mid.p90.toFixed(0)} — 45 넘게 밝아야 그림이 보인다 (관측 70)`);

  // 3. 직업 줄 클릭
  const rogue = g.crest.find(c => c[0] === 'ui_crest_rogue');
  if (!rogue) fail.push('목록에 추적자 문장이 없다');
  else {
    const r = await pg.evaluate(async ([cx, cy]) => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      Game.state = 'intro'; await wait(80);
      mouse.x = cx; mouse.y = cy; await wait(60);
      mouse.clicked = true; await wait(120);
      const o = { state: Game.state, cls: CLASSES[selectedClass].key };
      Game.state = 'intro'; mouse.x = -99; mouse.y = -99; await wait(60);
      return o;
    }, [rogue[1], rogue[2]]);
    out.push(`추적자 줄 클릭 → ${r.state} / ${r.cls}`);
    if (r.state !== 'title') fail.push(`직업 줄을 눌렀는데 ${r.state} 로 갔다 — 직업 선택이어야 한다`);
    if (r.cls !== 'rogue') fail.push(`추적자 줄을 눌렀는데 ${r.cls} 가 골라졌다`);
  }
  fail.push(...errs);
  await pg.close();

  // ── 5. 좁은 화면은 예전 배치
  const pg2 = await b.newPage({ viewport: { width: 420, height: 860 } });
  pg2.on('pageerror', e => fail.push('PAGEERROR(세로): ' + e.message));
  await pg2.goto('file:///home/user/templar/game/index.html');
  await pg2.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  const narrowWide = await pg2.evaluate(() => introWide());
  if (narrowWide) fail.push('420x860 인데 넓은 배치로 간다 — 목록과 설명이 들어갈 자리가 없다');
  out.push(`세로 420x860 → ${narrowWide ? '넓은' : '예전'} 배치`);
  await pg2.close();

  await b.close();
  console.log(out.join('\n'));
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  process.exit(fail.length ? 1 : 0);
})();

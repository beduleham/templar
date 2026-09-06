/* 회귀: 메뉴 UI 손그림이 제 모습으로 붙어 있는가.

   이 묶음은 네 번 어긋났고 넷 다 눈으로만 잡혔다(§107).
     초록 판     — 로고 시트만 배경이 짙은 초록이라 마젠타·순초록 규칙에 안 걸렸다.
                   그대로 실려 제목 뒤에 초록 사각형이 떴다.
     초록 테     — 키를 뺀 자리에 초록기가 남아 문장 둘레에 테를 둘렀다.
     늘어난 장식 — 가름줄은 장식이 가운데 있는데 삼등분해 늘려 마름모가 뭉갰다.
     찌그러진 글자 — 로고를 칸 크기로 그냥 늘리면 비율이 틀어진다.

   재는 것:
     1. 부품 열셋이 다 아틀라스에 있다
     2. 부품 안에 초록이 남아 있지 않다 (알파 있는 픽셀 중 0.2% 미만)
     3. 첫 화면에도 초록이 없다 — 화면 픽셀의 0.05% 미만
     4. 로고는 비율을 지킨다 — 원본 2.06 과 3% 안
     5. 가름줄은 삼등분으로 그리지 않는다
     6. 직업 선택에서 문장 넷이 그려지고, 고른 카드에만 금 액자가 둘린다

   실행: node tests/ui-parts.js */
const { chromium } = require('playwright');

const PARTS = ['ui_btn', 'ui_btn_hover', 'ui_btn_sel', 'ui_btn_short', 'ui_panel', 'ui_inset',
  'ui_divider', 'ui_crest_paladin', 'ui_crest_warrior', 'ui_crest_rogue', 'ui_crest_mage',
  'ui_corner', 'ui_logo',
  'ui_bar', 'ui_slot', 'ui_skillframe', 'ui_rail'];               // §115 — 게임 안 HUD 틀
/* HUD 틀은 **속이 뚫려야** 한다 — 게임이 그 안에 체력·아이콘을 그린다. 초록 키가
   안쪽 창을 남기면 체력이 틀 뒤로 숨는다. 가운데 40% 의 알파를 재서 잡는다. */
const HOLLOW = ['ui_bar', 'ui_slot', 'ui_skillframe', 'ui_rail'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const fail = [], out = [];

  // 1~2. 부품이 다 있고, 그 안에 초록이 안 남았다
  const r = await pg.evaluate((PARTS) => {
    const miss = PARTS.filter(k => !Sprites.frames[k]);
    if (miss.length) return { miss };
    const cv = document.createElement('canvas');
    const cx = cv.getContext('2d', { willReadFrequently: true });
    let ink = 0, green = 0, worst = { k: '', pct: 0 };
    const size = {};
    for (const k of PARTS) {
      const f = Sprites.frames[k];
      size[k] = [f.w, f.h];
      cv.width = f.w; cv.height = f.h;
      cx.clearRect(0, 0, f.w, f.h);
      cx.drawImage(Sprites.atlas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      const d = cx.getImageData(0, 0, f.w, f.h).data;
      let i0 = 0, g0 = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 40) continue;
        i0++;
        if (d[i + 1] - Math.max(d[i], d[i + 2]) > 60) g0++;
      }
      ink += i0; green += g0;
      const pct = i0 ? g0 / i0 * 100 : 0;
      if (pct > worst.pct) worst = { k, pct };
    }
    return { size, greenPct: green / Math.max(1, ink) * 100, worst };
  }, PARTS);
  if (r.miss) { fail.push(`아틀라스에 없는 부품: ${r.miss.join(', ')}`); }
  else {
    out.push(`부품   ${PARTS.length}개 · 남은 초록 ${r.greenPct.toFixed(3)}% (최악 ${r.worst.k} ${r.worst.pct.toFixed(2)}%)`);
    if (r.greenPct > .2) fail.push(`부품에 초록이 ${r.greenPct.toFixed(2)}% 남았다 — 배경이 안 빠졌다`);
    if (r.worst.pct > 1.5) fail.push(`${r.worst.k} 에 초록이 ${r.worst.pct.toFixed(2)}% 남았다`);
    // 4. 로고 비율
    const [lw, lh] = r.size.ui_logo;
    const ratio = lw / lh;
    out.push(`로고   ${lw}x${lh} · 가로세로 ${ratio.toFixed(3)}`);
    if (Math.abs(ratio / 2.061 - 1) > .03) fail.push(`로고 비율이 ${ratio.toFixed(3)} — 원본 2.061 에서 벗어났다`);
  }

  // 3. 첫 화면에 초록이 없다
  await pg.evaluate(() => { Game.state = 'intro'; });
  await pg.waitForTimeout(300);
  const scr = await pg.evaluate(() => {
    const cv = document.getElementById('game');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let g = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { n++; if (d[i + 1] - Math.max(d[i], d[i + 2]) > 40) g++; }
    return g / n * 100;
  });
  out.push(`첫화면 초록 ${scr.toFixed(4)}%`);
  if (scr > .05) fail.push(`첫 화면에 초록이 ${scr.toFixed(3)}% — 로고 뒤 판이 안 빠졌다`);

  // 5~6. 어떻게 그리는가 — 부르는 자리를 세어 본다
  const calls = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const S9 = drawSlice9, SH = drawSliceH, AR = uiArt;
    const s9 = [], sh = [], ar = [];
    window.drawSlice9 = (k, ...a) => { s9.push(k); return S9(k, ...a); };
    window.drawSliceH = (k, ...a) => { sh.push(k); return SH(k, ...a); };
    window.uiArt = (k, ...a) => { ar.push(k); return AR(k, ...a); };
    Game.state = 'title'; selectedClass = 1; await wait(200);
    const title = { s9: s9.slice(), sh: sh.slice(), ar: ar.slice() };
    s9.length = sh.length = ar.length = 0;
    Game.state = 'altar'; await wait(200);
    const altar = { s9: s9.slice(), sh: sh.slice(), ar: ar.slice() };
    window.drawSlice9 = S9; window.drawSliceH = SH; window.uiArt = AR;
    Game.state = 'intro';
    return { title, altar };
  });
  /* HUD 틀 — 가운데가 뚫렸는가, 그리고 판에서 실제로 쓰이는가 */
  const hud = await pg.evaluate((HOLLOW) => {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    const holes = {};
    for (const k of HOLLOW) {
      const f = Sprites.frames[k];
      c.width = f.w; c.height = f.h; g.clearRect(0, 0, f.w, f.h);
      g.drawImage(Sprites.atlas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      const x0 = Math.floor(f.w * .3), x1 = Math.ceil(f.w * .7), y0 = Math.floor(f.h * .3), y1 = Math.ceil(f.h * .7);
      const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      let solid = 0, n = 0;
      for (let i = 3; i < d.length; i += 4) { n++; if (d[i] > 40) solid++; }
      holes[k] = solid / n * 100;
    }
    const S9 = drawSlice9, SH = drawSliceH, used = new Set();
    window.drawSlice9 = (k, ...a) => { used.add(k); return S9(k, ...a); };
    window.drawSliceH = (k, ...a) => { used.add(k); return SH(k, ...a); };
    selectedClass = 1; Game.reset(); Game.state = 'playing'; player.items = ['bomb', null, null];
    for (let i = 0; i < 3; i++) frame(performance.now() + 5000 + i * 16.7);
    window.drawSlice9 = S9; window.drawSliceH = SH;
    Game.state = 'title';
    return { holes, used: [...used] };
  }, HOLLOW);
  out.push('HUD 틀 가운데 막힘 ' + HOLLOW.map(k => `${k.slice(3)} ${hud.holes[k].toFixed(1)}%`).join(' · '));
  for (const k of HOLLOW) {
    if (hud.holes[k] > 3) fail.push(`${k} 의 가운데가 ${hud.holes[k].toFixed(1)}% 막혀 있다 — 틀 안에 그리는 체력이 안 보인다`);
    if (!hud.used.includes(k)) fail.push(`${k} 이 판에서 안 그려진다 — HUD 가 예전 칩으로 떨어졌다`);
  }

  const crests = calls.title.ar.filter(k => k.startsWith('ui_crest_'));
  const frames = calls.title.s9.filter(k => k === 'ui_panel');
  const insets = calls.title.s9.filter(k => k === 'ui_inset');
  /* 200ms 동안 여러 판이 그려지므로 낱개가 아니라 **한 판당 몇 장인가**로 잰다.
     카드 넷 중 하나만 금 액자, 넷 다 창틀이므로 창틀은 액자의 네 배여야 한다. */
  out.push(`직업선택 문장 ${new Set(crests).size}종 · 금액자 ${frames.length} · 창틀 ${insets.length}`);
  if (new Set(crests).size !== 4) fail.push(`직업 문장이 ${new Set(crests).size}종만 그려진다 — 넷이어야 한다`);
  if (!frames.length) fail.push('고른 카드에 금 액자가 안 둘린다');
  if (insets.length !== frames.length * 4) fail.push(`한 판에 금 액자 ${frames.length} · 창틀 ${insets.length} — 창틀은 카드 넷, 액자는 고른 하나여야 한다`);
  if (crests.length !== insets.length) fail.push(`문장 ${crests.length} · 창틀 ${insets.length} — 카드마다 하나씩이어야 한다`);
  const divSliced = [...calls.title.sh, ...calls.altar.sh].includes('ui_divider');
  if (divSliced) fail.push('가름줄을 삼등분해 늘렸다 — 가운데 마름모가 뭉갠다');
  if (!calls.altar.ar.includes('ui_divider')) fail.push('제단 머리에 가름줄이 없다');

  fail.push(...errs);
  await b.close();
  console.log(out.join('\n'));
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  process.exit(fail.length ? 1 : 0);
})();

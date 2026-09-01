/* 회귀: HUD 의 글자들이 서로를 뭉개지 않는가.

   ── 무엇이 문제였나

   붐비는 판 한 프레임을 찍어 글자 상자를 전부 재 보니, 겹친 쌍이 256개였다.
   갈래로 나누니 원인이 하나가 아니었다.

     204쌍  피해 숫자끼리 — 타격마다 같은 자리에 새로 띄우고(`rnd(-6,6)` 은
            글자 폭보다 좁다) 전부 같은 속도로 곧게 올라가 영영 안 갈라졌다.
      51쌍  몹 이름표 ↔ 피해 숫자 — 이름표는 다른 이름표만 피하고
            숫자는 몰랐다. 둘 다 몹 머리 위 같은 자리를 노린다.
       1쌍  지형지물 표지 ↔ 아래 슬롯 — 표지가 화면 가장자리 46~58px 링에
            붙는데 HUD 판이 정확히 그 링 위에 있다.

   그리고 위 중앙 띠는 따로다. 시계·보스 체력·미션·전직 알림·토스트 다섯이
   각자 y 를 박아 두고 있었는데, **미션 배너에 상태가 둘**이라(막 뜨면 150,
   가라앉으면 82) 82 일 때 보스 체력바(64~80)와 전직 알림(108·128)을 통째로
   뚫고 지나갔다.

   ── 장면을 고정해야 한다

   살아 있는 판을 굴려 재면 스폰·치명타·무기 굴림이 매번 달라, 같은 코드로도
   33쌍과 106쌍이 나온다. 앞뒤를 견줄 수 없다. 그래서 씨앗을 고정하고 적을
   격자로 세워 정해진 피해를 넣는다.

   ── 미션 상태를 둘 다 봐야 한다

   처음 검사는 큰 상태만 보고 「겹침 없음」을 냈다. 그 사이 화면에서는 세 줄이
   겹쳐 있었다. 상태가 있는 채널은 상태마다 재야 한다.

   실행: node tests/hud-overlap.js */
const { chromium } = require('playwright');

const CAPTURE = `(() => {
  const boxes = [];
  const map = (x, y) => { const t = ctx.getTransform();
    return { x: x*t.a + y*t.c + t.e, y: x*t.b + y*t.d + t.f, k: t.a }; };
  const _t = ctx.fillText.bind(ctx);
  ctx.fillText = function (t, x, y) {
    const p = map(x, y), w = ctx.measureText(t).width * p.k;
    const fs = (parseFloat((ctx.font.match(/(\\d+(?:\\.\\d+)?)px/) || [0,14])[1]) || 14) * p.k;
    const bl = ctx.textBaseline;
    const top = bl === 'top' || bl === 'hanging' ? p.y
              : bl === 'bottom' || bl === 'alphabetic' ? p.y - fs*.82 : p.y - fs*.58;
    const half = ctx.textAlign === 'center' ? w/2 : ctx.textAlign === 'right' ? w : 0;
    if (String(t).trim()) boxes.push({ t: String(t).slice(0,26), x: p.x-half, y: top, w, h: fs*1.16, fs: +fs.toFixed(0) });
    return _t.apply(null, arguments);
  };
  frame(performance.now());
  ctx.fillText = _t;
  return boxes;
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  let bad = 0;

  // ── 1. 붐비는 고정 장면에서 겹친 쌍
  {
    const pg = await b.newPage({ viewport: { width: 1440, height: 860 } });
    pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await pg.goto('file:///home/user/templar/game/index.html');
    await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
    const r = await pg.evaluate(async (CAP) => {
      let seed = 12345;
      Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const step = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      selectedClass = 0; Game.reset(); Game.state = 'playing';
      player.base.maxHp = 1e9; recomputeStats(); player.hp = 1e9;
      Game.time = 430;
      for (const e of enemies) e.active = false;
      const KINDS = ['zombie','ghost','archer','hound','brute','shield'], E = [];
      for (let i = 0; i < 28; i++) {
        const a = i/28*TAU*3, rr = 70 + (i%5)*34;
        const e = Game.spawnEnemy(KINDS[i%6], player.x+Math.cos(a)*rr, player.y+Math.sin(a)*rr, RANKS.common);
        if (e) { e.think = () => {}; e.spd = 0; e.hp = 1e9; e.maxHp = 1e9; E.push(e); }
      }
      const keep = new Set(E);
      for (let f = 0; f < 24; f++) {
        for (const e of enemies) if (!keep.has(e)) e.active = false;
        for (const e of E) { e.spd = 0; e.hp = 1e9;
          damageEnemy(e, 14 + (f%4)*9, e.x+20, e.y, 0, ['physical','fire','holy'][f%3]); }
        if (Game.state !== 'playing') Game.state = 'playing';
        await step();
      }
      for (const e of enemies) if (!keep.has(e)) e.active = false;
      const boxes = eval(CAP);
      const kind = q => /^-?\d[\d,]*$/.test(q.t) ? '피해 숫자'
        : q.fs <= 10 && /m$/.test(q.t) ? '지형 표지'
        : q.fs <= 10 ? '몹 이름표'
        : q.y < 210 && q.x + q.w > W*.25 && q.x < W*.75 ? '위 중앙'
        : q.x < 340 && q.y < 210 ? '왼쪽 위' : q.y > H-130 ? '아래 줄' : '기타';
      const pairs = {}; let n = 0;
      for (let i = 0; i < boxes.length; i++) for (let j = i+1; j < boxes.length; j++) {
        const A = boxes[i], B = boxes[j];
        const w = Math.min(A.x+A.w, B.x+B.w) - Math.max(A.x, B.x);
        const h = Math.min(A.y+A.h, B.y+B.h) - Math.max(A.y, B.y);
        if (w <= 0 || h <= 0) continue;
        if (w*h / Math.min(A.w*A.h, B.w*B.h) <= .20) continue;
        n++;
        const k = [kind(A), kind(B)].sort().join(' ↔ ');
        pairs[k] = (pairs[k] || 0) + 1;
      }
      // 화면 밖으로 나간 글자 — 표지를 HUD 밖으로 밀다 잘리는 사고를 잡는다
      const off = boxes.filter(q => q.y < -2 || q.y + q.h > H + 2 || q.x < -2 || q.x + q.w > W + 2)
                       .map(q => `${q.t} @ ${Math.round(q.x)},${Math.round(q.y)}`);
      return { texts: boxes.length, overlaps: n, pairs, off };
    }, CAPTURE);
    console.log(`붐비는 고정 장면 — 글자 ${r.texts}개 · 겹침 ${r.overlaps}쌍`);
    for (const [k, v] of Object.entries(r.pairs).sort((a,b) => b[1]-a[1])) console.log(`    ${String(v).padStart(4)}  ${k}`);
    /* 자는 고친 뒤의 값에서 잡는다. 남은 겹침은 촘촘히 붙은 적들의 숫자가
       떠오르며 스치는 것이라 0 이 될 수 없다(4~6쌍에서 오르내린다). */
    if (r.overlaps > 14) { console.log(`!! 겹침이 ${r.overlaps}쌍이다 (고친 뒤 4~6쌍이었다)`); bad++; }
    const nm = r.pairs['몹 이름표 ↔ 피해 숫자'] || 0;
    if (nm > 3) { console.log(`!! 이름표가 피해 숫자를 다시 덮는다 (${nm}쌍)`); bad++; }
    if (r.off.length) { console.log('!! 화면 밖으로 나간 글자: ' + r.off.join(' · ')); bad++; }
    await pg.close();
  }

  // ── 2. 위 중앙 띠 — 채널을 다 켜고, 미션 두 상태 × 세 해상도
  for (const BIG of [true, false])
  /* 뷰포트를 셋 골라도 논리 화면이 비슷하게 나온다(캔버스가 넓이를 맞춰 늘린다).
     좁은 화면은 미션 배너의 기준 y 가 달라지므로(narrow() → 152) 반드시 넣는다. */
  for (const [vw, vh] of [[1440,860],[844,390],[390,844]]) {
    const pg = await b.newPage({ viewport: { width: vw, height: vh } });
    pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await pg.goto('file:///home/user/templar/game/index.html');
    await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
    const r = await pg.evaluate(async ({ CAP, BIG }) => {
      const step = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      selectedClass = 0; Game.reset(); Game.state = 'playing';
      player.base.maxHp = 1e9; recomputeStats(); player.hp = 1e9; Game.time = 430;
      for (const e of enemies) e.active = false;
      const boss = Game.spawnEnemy('boss1', player.x + 2200, player.y + 600, RANKS.common);
      if (boss) { boss.think = () => {}; boss.spd = 0; boss.hp = 16141; boss.maxHp = 32000; }
      await step();
      Game.advancePending = 1;
      Game.lmFlash = 3; Game.lmFlashText = '봉인이 풀렸다 — 파수꾼을 쓰러뜨려라';
      Mission.flash = BIG ? 1.5 : 0;
      if (Game.state !== 'playing') Game.state = 'playing';
      await step();
      Mission.flash = BIG ? 1.5 : 0;
      const boxes = eval(CAP);
      // 중앙에 쓰는 것만 — 왼쪽 위 조합 줄이 좁은 화면에서 이 구간에 들어온다
      const band = boxes.filter(q => q.y < 300 && q.fs > 10 && q.x + q.w > W*.3 && q.x < W*.7)
                        .sort((a,b) => a.y - b.y);
      const ov = [];
      for (let i = 0; i < band.length; i++) for (let j = i+1; j < band.length; j++) {
        const A = band[i], B = band[j];
        const w = Math.min(A.x+A.w, B.x+B.w) - Math.max(A.x, B.x);
        const h = Math.min(A.y+A.h, B.y+B.h) - Math.max(A.y, B.y);
        if (w > 1 && h > .5) ov.push(`${A.t} ↔ ${B.t} (세로 ${h.toFixed(1)}px)`);
      }
      return { W, H, rows: band.length, ov };
    }, { CAP: CAPTURE, BIG });
    const tag = `${r.W}×${r.H} 미션${BIG ? '큼' : '평상'}`;
    if (r.ov.length) { console.log(`!! ${tag} — 띠에서 겹침 ${r.ov.length}쌍\n     ${r.ov.join('\n     ')}`); bad++; }
    else console.log(`${tag} — 띠 ${r.rows}줄, 겹침 없음`);
    await pg.close();
  }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

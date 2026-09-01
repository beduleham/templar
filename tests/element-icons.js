/* 회귀: 여섯 속성을 색이 아니라 모양으로 가를 수 있는가.

   오래도록 여섯이 표 한 장(`element`)을 색만 바꿔 나눠 썼다. 화면 아홉 군데에
   찍히는, 이 게임에서 가장 자주 보는 표인데 모양이 하나였다 — '무슨 속성인가'를
   색으로만 물어본 셈이다. 색약이면 아예 못 읽고, 알림 글씨나 밝은 이펙트 위에
   얹히면 색조차 안 통한다.

   그래서 **색을 지우고 잰다.** 여섯을 전부 같은 흰색으로 그린 뒤 실루엣이
   서로 다른지 본다. 색을 살려 두고 재면 여섯 장이 다르다는 답이 늘 나오는데,
   그건 고치기 전에도 참이었다 — 물어야 할 것을 안 묻는 지표다.
   (§68 파수꾼 다리 간격 · §75 아치 구멍과 같은 자리다.)

   ── 얼마나 달라야 다른가

   기준을 지어내면 안 된다. 처음에 겹침 62%를 바닥으로 잡았다가 멀쩡한 짝
   (불꽃↔십자 75%)을 실패로 읽었다. 겹침(IoU)은 '덩어리 안에 가는 모양이
   들어가면' 무조건 높게 나오는데, 그건 눈에는 가장 잘 갈리는 짝이다.

   그래서 **이미 쓰는 표 34장에서 자를 뽑는다.** 아무도 헷갈린다고 하지 않는
   짝들이 실제로 얼마나 겹치는지 세어, 그 99분위를 넘을 때만 실패로 본다.
   (재보니 중앙값 0.59, 95분위 0.78, 99분위 0.85 — aura↔sigil 이 0.94 다.)
   처음 잡힌 불꽃↔핏방울 0.90 은 그 분포에서도 이상치라 진짜 문제였다.
   채움률도 같다 — 쓰던 표의 최소~최대 안에 들면 옆에 놓아도 무게가 맞는다.

   실행: node tests/element-icons.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const r = await pg.evaluate(() => {
    const keys = Object.keys(ELEMENTS);
    const out = { keys, missing: [], masks: {}, fill: {}, ref: {} };

    // 여섯을 전부 흰색으로, 같은 자리에, 같은 크기로 그려 실루엣만 남긴다
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    for (const k of keys) {
      const E = ELEMENTS[k];
      if (!E.px || !MENU_ICONS[E.px]) { out.missing.push(k); continue; }
      const rows = MENU_ICONS[E.px];
      let m = '', n = 0;
      for (const row of rows) for (const ch of row) { const on = ch !== '.'; m += on ? '#' : '.'; if (on) n++; }
      out.masks[k] = m;
      out.fill[k] = +(n / (rows.length * rows[0].length) * 100).toFixed(1);
    }
    /* 자를 로스터에서 뽑는다 — 속성 여섯을 뺀 나머지 16px 표 전부.
       이 짝들은 이미 화면에 함께 나와 있고 아무도 헷갈린다고 하지 않는다. */
    const elemPx = new Set(keys.map(k => ELEMENTS[k].px));
    const ref = Object.keys(MENU_ICONS)
      .filter(k => MENU_ICONS[k].length === 16 && !elemPx.has(k));
    const bits = k => MENU_ICONS[k].join('').split('').map(ch => ch !== '.');
    const iou = (a, b) => { let i = 0, u = 0;
      for (let x = 0; x < a.length; x++) { if (a[x] && b[x]) i++; if (a[x] || b[x]) u++; }
      return i / Math.max(1, u); };
    const rv = [];
    for (let i = 0; i < ref.length; i++) for (let j = i + 1; j < ref.length; j++)
      rv.push(iou(bits(ref[i]), bits(ref[j])));
    rv.sort((a, b) => a - b);
    const fills = ref.map(k => bits(k).filter(Boolean).length / 256 * 100);
    out.bar = {
      n: ref.length, pairs: rv.length,
      med: +rv[Math.floor(rv.length * .5)].toFixed(3),
      q95: +rv[Math.floor(rv.length * .95)].toFixed(3),
      q99: +rv[Math.floor(rv.length * .99)].toFixed(3),
      fillLo: +Math.min(...fills).toFixed(1), fillHi: +Math.max(...fills).toFixed(1),
    };

    // 화면에 실제로 그려 보고, 그린 자리가 비지 않았는지 본다
    out.drawn = {};
    for (const k of keys) {
      const E = ELEMENTS[k];
      g.clearRect(0, 0, 64, 64);
      const real = ctx;
      // drawMenuIcon 은 전역 ctx 를 쓴다 — 별도 캔버스로 바꿔 끼울 수 없으므로
      // 실제 캔버스 구석에 그린 뒤 그 자리를 읽는다.
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 40, 40);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 40, 40);
      const ok = drawMenuIcon(E.px, 20, 20, '#ffffff', 2);
      const d = ctx.getImageData(0, 0, 40, 40).data;
      ctx.restore();
      let lit = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 90) lit++;
      out.drawn[k] = { ok: !!ok, lit };
    }
    // 아직 공용 표를 부르는 자리가 남아 있는가
    out.shared = { draw: 0, text: 0 };
    return out;
  });

  let bad = 0;
  if (r.missing.length) { console.log('!! 표가 없는 속성: ' + r.missing.join(', ')); bad++; }

  // 색을 지운 실루엣이 서로 다른가
  const seen = new Map();
  for (const [k, m] of Object.entries(r.masks)) {
    if (seen.has(m)) { console.log(`!! ${k} 와 ${seen.get(m)} 의 실루엣이 같다 — 색으로만 갈린다`); bad++; }
    else seen.set(m, k);
  }
  console.log(`색을 지운 실루엣: ${seen.size} / ${r.keys.length} 가지`);

  // 서로 얼마나 다른가 — 가장 닮은 쌍이 얼마나 겹치는지
  const ks = Object.keys(r.masks);
  let worst = { p: '', v: 0 };
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const a = r.masks[ks[i]], b2 = r.masks[ks[j]];
    let inter = 0, uni = 0;
    for (let x = 0; x < a.length; x++) {
      const A = a[x] === '#', B = b2[x] === '#';
      if (A && B) inter++;
      if (A || B) uni++;
    }
    const iou = inter / Math.max(1, uni);
    if (iou > worst.v) worst = { p: ks[i] + '↔' + ks[j], v: iou };
  }
  const B = r.bar;
  console.log(`자 — 쓰던 표 ${B.n}장 ${B.pairs}쌍: 중앙 ${B.med} · 95분위 ${B.q95} · 99분위 ${B.q99}`);
  console.log(`가장 닮은 속성 쌍: ${worst.p} — 실루엣 겹침 ${(worst.v * 100).toFixed(0)}%`);
  if (worst.v > B.q99) { console.log(`!! 쓰던 표들의 99분위(${B.q99})보다 닮았다`); bad++; }

  // 무게가 옆의 표들과 맞는가
  console.log(`채움률(%) ${JSON.stringify(r.fill)} — 쓰던 범위 ${B.fillLo}~${B.fillHi}`);
  for (const [k, v] of Object.entries(r.fill))
    if (v < B.fillLo || v > B.fillHi) { console.log(`!! ${k} 채움률 ${v}% 가 쓰던 범위 밖이다`); bad++; }

  // 실제로 화면에 그려지는가 (표만 있고 안 그려지는 사고를 잡는다)
  const lits = Object.values(r.drawn).map(d => d.lit);
  for (const [k, d] of Object.entries(r.drawn))
    if (!d.ok || d.lit < 12) { console.log(`!! ${k} 가 화면에 안 그려진다 (밝은 칸 ${d.lit})`); bad++; }
  console.log('그려진 칸 수: ' + Object.entries(r.drawn).map(([k, d]) => k + ' ' + d.lit).join(' · '));

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

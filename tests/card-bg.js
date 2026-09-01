/* 회귀: 레벨업 카드의 문장 워터마크가 (1) 읽기를 해치지 않고 (2) 보이기는 하며
   (3) 카드 밖으로 새지 않는가.

   레벨업 판은 한 판에 스물몇 번 뜨고 석 장을 견주며 읽는 자리다. 카드 높이가
   306·335·365 세 가지고 설명 글이 늘 아래 절반에 앉으므로 '빈 데만 채우는
   삽화'는 놓을 자리가 아예 없다 — 글자 뒤에 깔리는 워터마크만이 가능한 형태고,
   그래서 진하기가 전부다.

   ── 셋을 다 지켜야 하는 이유

   대비만 지키면 알파를 0 으로 줄여도 통과한다(그림이 사라진 것을 못 잡는다).
   보이는 것만 지키면 진하게 만들수록 잘 통과한다. 새는 것만 지키면 나머지를
   못 본다. 셋은 서로 반대 방향이라 함께 걸어야 뜻이 있다.

   ── 대비 지표에 대해

   처음엔 '워터마크가 글자 대비를 몇 % 깎는지'로 고를 생각이었다. 재보니
   **알파 0.30 에서도 0.0% 였다** — 글자가 판보다 155~211 밝아서 워터마크가
   위협이 못 된다. 물어야 할 것을 안 묻는 지표였다(§68·§75·§77 과 같은 자리).
   그래서 진하기는 눈으로 골랐고, 이 테스트는 그 값에서 대비가 실제로 안 깎이는지
   확인하는 쪽으로만 쓴다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const r = await pg.evaluate(() => {
    const KEYS = ['cardbg_weapon', 'cardbg_power', 'cardbg_trait', 'cardbg_relic'];
    const out = { alpha: CARDBG_A, cells: {}, rows: [], leak: null };

    // 넉 장이 판에 실제로 들어 있고 서로 다른가
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    for (const k of KEYS) {
      const f = Sprites.frames[k];
      if (!f) { out.cells[k] = null; continue; }
      g.clearRect(0, 0, 256, 256);
      g.drawImage(Sprites.atlas, f.x, f.y, f.w, f.h, 0, 0, 256, 256);
      const d = g.getImageData(0, 0, 256, 256).data;
      let op = 0, sig = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { op++; sig = (sig * 31 + (d[i] >> 4) + (i >> 9)) % 1e9; }
      out.cells[k] = { op, sig, fits: f.y + f.h <= Sprites.atlas.height };
    }

    // 화면을 실제로 그려 잰다. 가장 시끄러운 문장(교차 검)으로 석 장을 고정한다.
    selectedClass = 0; Game.reset();
    for (const k of Object.keys(WEAPONS)) { try { addWeapon(k); } catch (e) {} }
    player.xp = player.xpNext; Game.levelUp();
    const fix = () => { Game.choices = [
      { type: 'weapon', key: 'orbit', level: 2, isNew: false },
      { type: 'weapon', key: 'dagger', level: 2, isNew: false },
      { type: 'weapon', key: 'flame', level: 1, isNew: true }]; };
    const cw = 300, gap = 26, x0 = (W - (3 * cw + 2 * gap)) / 2;
    const draw = (A) => { CARDBG_A = A; fix(); mouse.x = -99; mouse.y = -99;
                          ctx.setTransform(1, 0, 0, 1, 0, 0); frame(performance.now()); };
    const stat = (i) => {
      const d = ctx.getImageData(Math.round(x0 + i * (cw + gap)) + 12, 190, cw - 24, 300).data;
      const L = []; for (let k = 0; k < d.length; k += 4) L.push(d[k] * .299 + d[k + 1] * .587 + d[k + 2] * .114);
      L.sort((a, b) => a - b);
      const cut = (lo, hi) => L.slice(Math.floor(L.length * lo), Math.floor(L.length * hi));
      const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
      const text = avg(cut(.97, 1)), bg = avg(cut(.40, .60));
      const mid = cut(.20, .80), m = avg(mid);
      return { contrast: +(text - bg).toFixed(1),
               mottle: +Math.sqrt(avg(mid.map(v => (v - m) ** 2))).toFixed(2) };
    };
    const shot = () => { const d = ctx.getImageData(0, 0, W, H).data; return new Uint8Array(d); };

    const A0 = CARDBG_A;
    draw(0); const base = [0, 1, 2].map(stat); const px0 = shot();
    draw(A0); const now = [0, 1, 2].map(stat);
    for (let i = 0; i < 3; i++)
      out.rows.push({ i, off: base[i], on: now[i] });

    // 진하게 해서 '어디가 바뀌는지'를 본다 — 액자와 카드 사이로 새면 안 된다
    draw(.6); const px1 = shot();
    let outside = 0, inside = 0;
    const P = 3, y0 = 178;
    // 카드 안쪽(테 두 칸 안)의 상자 셋
    const boxes = [0, 1, 2].map(i => [x0 + i * (cw + gap) + P * 2, y0 + P * 2, cw - P * 4, 400]);
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const k = (y * W + x) * 4;
      if (Math.abs(px0[k] - px1[k]) + Math.abs(px0[k + 1] - px1[k + 1]) + Math.abs(px0[k + 2] - px1[k + 2]) < 9) continue;
      const hit = boxes.some(([bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh);
      if (hit) inside++; else outside++;
    }
    out.leak = { inside, outside };
    CARDBG_A = A0;
    return out;
  });

  let bad = 0;
  console.log(`알파 ${r.alpha}`);
  const sigs = [];
  for (const [k, v] of Object.entries(r.cells)) {
    if (!v) { console.log(`!! ${k} 줄이 없다`); bad++; continue; }
    console.log(`${k.padEnd(14)} 불투명 ${String(v.op).padStart(6)}칸  판 안 ${v.fits}`);
    if (!v.fits) { console.log(`!! ${k} 판이 그 줄까지 자라지 않았다`); bad++; }
    if (v.op < 8000) { console.log(`!! ${k} 이 비었다`); bad++; }
    sigs.push(v.sig);
  }
  if (new Set(sigs).size !== sigs.length) { console.log('!! 같은 그림이 두 번 들어갔다'); bad++; }

  console.log('\n카드  대비 없을때 → 있을때   손실     바탕 얼룩 없을때 → 있을때');
  for (const row of r.rows) {
    const loss = (1 - row.on.contrast / Math.max(1, row.off.contrast)) * 100;
    console.log(`  ${row.i}   ${String(row.off.contrast).padStart(6)} → ${String(row.on.contrast).padStart(6)}   ${loss.toFixed(1).padStart(5)}%    `
      + `${String(row.off.mottle).padStart(5)} → ${String(row.on.mottle).padStart(5)}`);
    // (1) 읽기를 해치지 않는다
    if (loss > 4) { console.log(`!! ${row.i}번 카드의 글자 대비가 ${loss.toFixed(1)}% 깎였다`); bad++; }
    // (2) 그래도 보이기는 한다 — 알파를 0 으로 되돌리는 조용한 회귀를 잡는다
    if (row.on.mottle < row.off.mottle + .8) { console.log(`!! ${row.i}번 카드에 문장이 안 보인다`); bad++; }
  }

  // (3) 카드 밖으로 새지 않는다
  console.log(`\n알파 0.6 으로 올렸을 때 바뀐 점 — 카드 안 ${r.leak.inside} · 카드 밖 ${r.leak.outside}`);
  if (r.leak.inside < 2000) { console.log('!! 카드 안에서 아무것도 안 바뀐다 — 그려지지 않았다'); bad++; }
  if (r.leak.outside > r.leak.inside * .02) { console.log('!! 문장이 카드 밖으로 샌다 — 잘라내기가 풀렸다'); bad++; }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

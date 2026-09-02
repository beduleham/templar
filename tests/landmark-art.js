/* 회귀: 지형지물 셋(보물 상자·봉인된 제단·고대 비석)이 손그림으로 서고, 신호가 살아 있는가.

   지형지물은 목적지다 — 한 판에 하나씩 보이고 반지름이 고정이라 변종은 하나다.
   재는 것:
     1. 셋 다 그림이 판 안에 있고, 그려진 폭이 판정 지름 × wk 와 맞는다
        (상자·제단 1.0 → 닿는 원 = 그림, 비석 0.7 → 홀쭉한 석판)
     2. 제단·비석의 맥동(봉인 문양·룬의 빛)이 두 시각에서 다르다 — 절차 가지를
        건너뛰면 신호가 사라진다(§90 에서 수정 후광을 잃은 자리)
     3. 바닥 표식(맥동 타원)은 그대로 그려진다 — 그것도 신호다

   실행: node tests/landmark-art.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '../game/index.html'));
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  const r = await pg.evaluate(() => {
    cam.x = 0; cam.y = 0; const S = 400, CX = 200, CY = 200;
    /* 자를 한 번 고쳤다. 처음엔 바닥 표식을 빼려고 pxEllipse 를 통째로 막았는데,
       봉인 문양·룬의 빛도 pxEllipse 로 그리므로 신호까지 같이 사라져 '맥동이 멈췼다'가
       거짓으로 났다. 지금은 막지 않고 **어디가 바뀌는지**로 가른다 — 바닥 표식은
       sy + .5r 를 중심으로 위로 .3r 까지만 올라오니, 그보다 위(sy - .35r 위)에서
       바뀐 칸이 신호의 맥동이다. 바닥 표식은 pxEllipse 호출을 기록해 확인한다. */
    const calls = [];
    const PE = window.pxEllipse;
    window.pxEllipse = (cx, cy, rx, ry) => { calls.push([cx, cy, rx, ry]); PE(cx, cy, rx, ry); };
    const shot = (type, t) => {
      Game.time = t; calls.length = 0;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, S, S); ctx.restore();
      const T = LM_TYPES[type];
      drawLandmark({ key: 'p', type, T, x: CX, y: CY, r: T.r, fighting: false });
      const d = ctx.getImageData(0, 0, S, S).data;
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0;
      const px = new Uint8Array(S * S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = (y * S + x) << 2;
        if (Math.min(d[i], d[i + 2]) - d[i + 1] > 55) continue;
        // 바닥 표식(sy+.5r 둘레의 납작한 타원)은 폭 측정에서 뺀다 — y 가 sy-.3r 아래인 넓은 띠
        px[y * S + x] = 1 + (d[i] >> 3);
        if (y < CY - T.r * .35 || Math.abs(x - CX) < T.r * 1.05) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
        if (y < y0) y0 = y; if (y > y1) y1 = y; n++;
      }
      const mark = calls.some(([cx, cy, rx]) => Math.abs(cx - CX) < 2 && Math.abs(cy - (CY + T.r * .5)) < 2 && Math.abs(rx - T.r * 1.7) < 2);
      return { w: x1 - x0 + 1, h: y1 - y0 + 1, n, px, mark, bot: +((y1 - CY) / T.r).toFixed(2) };
    };
    const upperDiff = (a, b2, r) => { let c = 0; for (let y = 0; y < CY - r * .35; y++) for (let x = 0; x < S; x++) if (a.px[y * S + x] !== b2.px[y * S + x]) c++; return c; };
    const out = {};
    for (const type of Object.keys(LM_TYPES)) {
      const A = LM_ART[type], f = A && Sprites.frames[A.key];
      const fits = !!(f && Sprites.atlas && f.y + f.h <= Sprites.atlas.height);
      const a = shot(type, 0), b2 = shot(type, 0.6);
      out[type] = { name: LM_TYPES[type].name, r: LM_TYPES[type].r, fits, w: a.w, h: a.h, want: Math.round(LM_TYPES[type].r * 2 * (A ? A.wk : 1)),
        bot: a.bot, moves: upperDiff(a, b2, LM_TYPES[type].r) > 20, mark: a.mark, glow: !!(A && A.glow) };
    }
    window.pxEllipse = PE;
    return out;
  });
  let bad = 0;
  console.log('지형지물   r   판    그려진 폭 / 기대   높이   아래끝(r)   위쪽 맥동  바닥표식');
  for (const [type, v] of Object.entries(r)) {
    console.log(`${v.name.padEnd(7)} ${v.r}  ${v.fits ? '있음' : '없음'}   ${String(v.w).padStart(4)} / ${String(v.want).padStart(3)}     ${String(v.h).padStart(3)}    ${v.bot}      ${v.moves ? '있음' : '없음'}     ${v.mark ? '있음' : '없음'}`);
    if (!v.fits) { console.log(`  !! ${v.name} — 판이 그 줄까지 자라지 않았다`); bad++; }
    // 맥동 빛이 폭을 조금 넓힐 수 있어 위로 8 까지 봐준다
    if (v.w < v.want - 3 || v.w > v.want + 8) { console.log(`  !! ${v.name} — 그려진 폭 ${v.w} 와 기대 ${v.want} 가 어긋난다`); bad++; }
    if (v.glow && !v.moves) { console.log(`  !! ${v.name} — 맥동이 멈췼다, 신호가 사라졌다`); bad++; }
    if (!v.glow && v.moves) { console.log(`  !! ${v.name} — 움직일 게 없는데 화면이 바뀐다`); bad++; }
    if (!v.mark) { console.log(`  !! ${v.name} — 바닥 표식이 사라졌다`); bad++; }
  }
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close(); process.exit(bad ? 1 : 0);
})();

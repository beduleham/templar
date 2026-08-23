/* 레퍼런스 아틀라스 생성기.
   docs/art-spec.md 의 규격이 실제로 성립하는지 증명하려고 만든 것이다.
   최종 아트가 아니라 '자리 표시자 겸 기준자'다 — 화가가 이 시트를 열어
   같은 칸에 같은 크기로 덮어 그리면 코드를 한 줄도 안 고치고 교체된다.

   실행: node art/make-atlas.js   (headless Chromium 의 캔버스로 그려 PNG 로 뽑는다) */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CELL = 32, BOSS = 64, COLS = 4;      // 프레임 4장 = 걷기 사이클
const SPEC = require('./atlas-spec.json');

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage();
  const dataUrl = await pg.evaluate(({ SPEC, CELL, BOSS, COLS }) => {
    const rows = Object.entries(SPEC.frames);
    const W = Math.max(CELL, BOSS) * COLS;
    let H = 0;
    for (const [, f] of rows) H += f.h;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    // ── 스테인드글라스 실루엣 규칙 ──
    //   굵은 검은 윤곽 + 주색 1 + 발광색 1. 세 번째 색은 쓰지 않는다.
    const outline = (fn, lw) => { c.lineJoin = 'round'; c.lineCap = 'round';
      c.strokeStyle = '#0a0a12'; c.lineWidth = lw; fn(); c.stroke(); };

    const shapes = {
      bat(x, y, s, t, col, glow) {
        const cx = x + s / 2, cy = y + s / 2, f = Math.sin(t * Math.PI * 2) * s * .06;
        const wing = () => { c.beginPath();
          c.moveTo(cx - s * .40, cy + f); c.quadraticCurveTo(cx - s * .22, cy - s * .18, cx, cy);
          c.quadraticCurveTo(cx + s * .22, cy - s * .18, cx + s * .40, cy + f); };
        outline(wing, s * .16); c.fillStyle = col; wing(); c.fill();
        c.fillStyle = col; c.beginPath(); c.arc(cx, cy + s * .04, s * .15, 0, 7); c.fill();
        c.strokeStyle = '#0a0a12'; c.lineWidth = s * .07; c.stroke();
        c.fillStyle = glow;
        c.beginPath(); c.arc(cx - s * .06, cy + s * .02, s * .035, 0, 7); c.fill();
        c.beginPath(); c.arc(cx + s * .06, cy + s * .02, s * .035, 0, 7); c.fill();
      },
      blob(x, y, s, t, col, glow) {
        const cx = x + s / 2, cy = y + s * .58, sq = 1 + Math.sin(t * Math.PI * 2) * .12;
        const body = () => { c.beginPath();
          c.ellipse(cx, cy, s * .32 * sq, s * .28 / sq, 0, 0, 7); };
        outline(body, s * .16); c.fillStyle = col; body(); c.fill();
        c.fillStyle = glow; c.globalAlpha = .85;
        c.beginPath(); c.ellipse(cx - s * .10, cy - s * .08, s * .07, s * .05, -.5, 0, 7); c.fill();
        c.globalAlpha = 1;
      },
      ghost(x, y, s, t, col, glow) {
        const cx = x + s / 2, cy = y + s * .5 + Math.sin(t * Math.PI * 2) * s * .05;
        const body = () => { c.beginPath();
          c.arc(cx, cy, s * .28, Math.PI, 0);
          c.lineTo(cx + s * .28, cy + s * .22);
          for (let i = 0; i < 3; i++)
            c.quadraticCurveTo(cx + s * .28 - s * .09 * (i * 2 + 1), cy + s * .32,
                               cx + s * .28 - s * .19 * (i + 1), cy + s * .22);
          c.closePath(); };
        outline(body, s * .16); c.fillStyle = col; body(); c.fill();
        c.fillStyle = glow;
        c.beginPath(); c.arc(cx - s * .09, cy - s * .04, s * .05, 0, 7); c.fill();
        c.beginPath(); c.arc(cx + s * .09, cy - s * .04, s * .05, 0, 7); c.fill();
      },
      humanoid(x, y, s, t, col, glow) {
        const cx = x + s / 2, cy = y + s * .5, sw = Math.sin(t * Math.PI * 2) * s * .07;
        const body = () => { c.beginPath();
          c.moveTo(cx, cy - s * .20); c.lineTo(cx + s * .17, cy + s * .04);
          c.lineTo(cx + s * .10, cy + s * .30); c.lineTo(cx - s * .10, cy + s * .30);
          c.lineTo(cx - s * .17, cy + s * .04); c.closePath(); };
        outline(body, s * .15); c.fillStyle = col; body(); c.fill();
        const head = () => { c.beginPath(); c.arc(cx, cy - s * .28, s * .12, 0, 7); };
        outline(head, s * .13); c.fillStyle = col; head(); c.fill();
        c.strokeStyle = glow; c.lineWidth = s * .07; c.lineCap = 'round';
        c.beginPath(); c.moveTo(cx - s * .17, cy); c.lineTo(cx - s * .26, cy + s * .12 + sw); c.stroke();
        c.beginPath(); c.moveTo(cx + s * .17, cy); c.lineTo(cx + s * .26, cy + s * .12 - sw); c.stroke();
      },
      hound(x, y, s, t, col, glow) {
        const cx = x + s / 2, cy = y + s * .55, g = Math.sin(t * Math.PI * 2) * s * .05;
        const body = () => { c.beginPath();
          c.ellipse(cx - s * .04, cy, s * .27, s * .16, 0, 0, 7); };
        outline(body, s * .15); c.fillStyle = col; body(); c.fill();
        const head = () => { c.beginPath();
          c.moveTo(cx + s * .14, cy - s * .10); c.lineTo(cx + s * .36, cy - s * .04);
          c.lineTo(cx + s * .14, cy + s * .08); c.closePath(); };
        outline(head, s * .12); c.fillStyle = col; head(); c.fill();
        c.strokeStyle = '#0a0a12'; c.lineWidth = s * .09; c.lineCap = 'round';
        c.beginPath(); c.moveTo(cx - s * .12, cy + s * .12); c.lineTo(cx - s * .16, cy + s * .26 + g); c.stroke();
        c.beginPath(); c.moveTo(cx + s * .08, cy + s * .12); c.lineTo(cx + s * .12, cy + s * .26 - g); c.stroke();
        c.fillStyle = glow; c.beginPath(); c.arc(cx + s * .20, cy - s * .05, s * .04, 0, 7); c.fill();
      },
      boss(x, y, s, t, col, glow) {
        // 보스는 실루엣만으로 '큰 것'이 아니라 '다른 것'이어야 한다 — 뿔과 왕관으로 구분한다.
        const cx = x + s / 2, cy = y + s * .54, pulse = 1 + Math.sin(t * Math.PI * 2) * .05;
        c.globalAlpha = .26; c.fillStyle = glow;
        c.beginPath(); c.arc(cx, cy - s * .02, s * .44 * pulse, 0, 7); c.fill();
        c.globalAlpha = 1;
        // 망토
        const cape = () => { c.beginPath();
          c.moveTo(cx, cy - s * .26);
          c.quadraticCurveTo(cx + s * .34, cy - s * .06, cx + s * .26, cy + s * .32);
          c.lineTo(cx - s * .26, cy + s * .32);
          c.quadraticCurveTo(cx - s * .34, cy - s * .06, cx, cy - s * .26);
          c.closePath(); };
        outline(cape, s * .11); c.fillStyle = col; cape(); c.fill();
        // 머리 + 뿔
        const head = () => { c.beginPath(); c.arc(cx, cy - s * .28, s * .13, 0, 7); };
        outline(head, s * .10); c.fillStyle = col; head(); c.fill();
        c.strokeStyle = '#0a0a12'; c.lineWidth = s * .07; c.lineCap = 'round';
        for (const d of [-1, 1]) {
          c.beginPath();
          c.moveTo(cx + d * s * .10, cy - s * .36);
          c.quadraticCurveTo(cx + d * s * .22, cy - s * .48, cx + d * s * .16, cy - s * .56);
          c.stroke();
        }
        // 눈
        c.fillStyle = glow;
        for (const d of [-1, 1]) {
          c.beginPath(); c.arc(cx + d * s * .05, cy - s * .28, s * .035 * pulse, 0, 7); c.fill();
        }
        // 가슴의 표식
        c.strokeStyle = glow; c.lineWidth = s * .035;
        c.beginPath(); c.moveTo(cx, cy - s * .06); c.lineTo(cx, cy + s * .14); c.stroke();
        c.beginPath(); c.moveTo(cx - s * .07, cy + s * .01); c.lineTo(cx + s * .07, cy + s * .01); c.stroke();
      },
    };

    let y = 0;
    const out = {};
    for (const [key, f] of rows) {
      const s = f.h;
      for (let i = 0; i < COLS; i++) shapes[f.shape](i * s, y, s, i / COLS, f.color, f.glow);
      out[key] = { x: 0, y, w: s, h: s, n: COLS, fps: f.fps || 8 };
      if (s !== 32) out[key].s = +(28 / s).toFixed(3);
      y += s;
    }
    return { url: cv.toDataURL('image/png'), frames: out, W, H: y };
  }, { SPEC, CELL, BOSS, COLS });

  const png = Buffer.from(dataUrl.url.split(',')[1], 'base64');
  fs.writeFileSync(path.join(__dirname, 'reference-atlas.png'), png);
  fs.writeFileSync(path.join(__dirname, 'atlas-frames.json'),
    JSON.stringify(dataUrl.frames, null, 2) + '\n');
  console.log(`reference-atlas.png  ${dataUrl.W}×${dataUrl.H}  ${(png.length/1024).toFixed(1)}KB`);
  console.log(`atlas-frames.json    ${Object.keys(dataUrl.frames).length}종`);
  await b.close();
})();

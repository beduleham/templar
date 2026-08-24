/* 픽셀 도안 생성기 — Piskel 에서 그대로 보고 찍을 수 있는 그림을 만든다.
   1픽셀을 fillRect(1,1) 로 찍어 안티에일리어싱이 전혀 없게 한다(규격 요구사항).
   실행: node art/make-guide.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const S = 32, N = 4, Z = 14;                    // 프레임 32px · 4프레임 · 도안 확대 14배
const COL = { body: '#57c96a', dark: '#3f9c50', glow: '#c8f5b0', line: '#0a0a12' };

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage();
  const res = await pg.evaluate(({ S, N, Z, COL }) => {
    // 프레임별 몸통 크기 — 눌렸다 펴지는 4박자
    const shape = [ {rx:11, ry:8}, {rx:10, ry:9}, {rx:11, ry:8}, {rx:12, ry:7} ];

    // 한 프레임을 픽셀 배열로 만든다 ('.' 투명 · O 윤곽 · B 몸 · D 그늘 · G 광택)
    const build = (f) => {
      const { rx, ry } = shape[f];
      const cx = 15.5, cy = 21.5 - (f === 1 ? 1 : 0);
      const g = Array.from({ length: S }, () => Array(S).fill('.'));
      const inside = (x, y, ex, ey) => {
        const dx = (x - cx) / ex, dy = (y - cy) / ey;
        return dx * dx + dy * dy <= 1;
      };
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (inside(x, y, rx, ry)) g[y][x] = (y > cy + ry * .35) ? 'D' : 'B';
      }
      // 윤곽 — 몸에 붙은 바깥 픽셀을 칠한다 (두께 2)
      for (let pass = 0; pass < 2; pass++) {
        const add = [];
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          if (g[y][x] !== '.') continue;
          const n = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => {
            const nx = x+dx, ny = y+dy;
            return nx>=0 && ny>=0 && nx<S && ny<S && g[ny][nx] !== '.' && g[ny][nx] !== 'O';
          });
          if (n) add.push([x, y]);
        }
        for (const [x, y] of add) g[y][x] = 'O';
      }
      // 광택 — 왼쪽 위
      for (let y = -2; y <= 1; y++) for (let x = -3; x <= 2; x++) {
        const px = Math.round(cx - rx * .42) + x, py = Math.round(cy - ry * .45) + y;
        if (Math.abs(x + .5) / 3 + Math.abs(y) / 2 < 1.1 && g[py] && g[py][px] === 'B') g[py][px] = 'G';
      }
      // 눈 — 윤곽색으로 두 점
      for (const d of [-4, 4]) {
        const ex = Math.round(cx + d), ey = Math.round(cy - ry * .18);
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++)
          if (g[ey+y] && g[ey+y][ex+x] && g[ey+y][ex+x] !== '.') g[ey+y][ex+x] = 'O';
      }
      return g;
    };

    const grids = [];
    for (let f = 0; f < N; f++) grids.push(build(f));
    const paint = (c, g, ox, oy, z) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const v = g[y][x];
        if (v === '.') continue;
        c.fillStyle = v === 'O' ? COL.line : v === 'B' ? COL.body : v === 'D' ? COL.dark : COL.glow;
        c.fillRect(ox + x * z, oy + y * z, z, z);
      }
    };

    // ① 실제 크기 스트립 (게임에 바로 쓰는 것)
    const strip = document.createElement('canvas');
    strip.width = S * N; strip.height = S;
    const sc = strip.getContext('2d');
    grids.forEach((g, i) => paint(sc, g, i * S, 0, 1));

    // ② 도안 — 격자와 좌표를 붙여 크게
    const pad = 34, gw = S * Z;
    const gd = document.createElement('canvas');
    gd.width = pad + gw * 2 + 40 + pad; gd.height = pad + gw + 120;
    const c = gd.getContext('2d');
    c.fillStyle = '#14141c'; c.fillRect(0, 0, gd.width, gd.height);

    // 1번 프레임과 4번 프레임을 나란히 (가장 많이 다른 두 장)
    [0, 3].forEach((fi, k) => {
      const ox = pad + k * (gw + 40), oy = pad;
      // 체크무늬 배경 = 투명
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        c.fillStyle = (x + y) % 2 ? '#1c1c26' : '#22222e';
        c.fillRect(ox + x * Z, oy + y * Z, Z, Z);
      }
      paint(c, grids[fi], ox, oy, Z);
      // 격자
      c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
      for (let i = 0; i <= S; i++) {
        c.beginPath(); c.moveTo(ox + i * Z, oy); c.lineTo(ox + i * Z, oy + gw); c.stroke();
        c.beginPath(); c.moveTo(ox, oy + i * Z); c.lineTo(ox + gw, oy + i * Z); c.stroke();
      }
      // 8칸마다 굵은 선
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.5;
      for (let i = 0; i <= S; i += 8) {
        c.beginPath(); c.moveTo(ox + i * Z, oy); c.lineTo(ox + i * Z, oy + gw); c.stroke();
        c.beginPath(); c.moveTo(ox, oy + i * Z); c.lineTo(ox + gw, oy + i * Z); c.stroke();
      }
      // 좌표
      c.fillStyle = 'rgba(255,255,255,.4)'; c.font = '11px monospace';
      c.textAlign = 'center'; c.textBaseline = 'bottom';
      for (let i = 0; i <= S; i += 8) c.fillText(i, ox + i * Z, oy - 4);
      c.textAlign = 'right'; c.textBaseline = 'middle';
      for (let i = 0; i <= S; i += 8) c.fillText(i, ox - 6, oy + i * Z);
      c.fillStyle = '#ffd36e'; c.font = 'bold 15px sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'top';
      c.fillText(`프레임 ${fi + 1}`, ox, oy + gw + 10);
    });

    // 색 견본
    const sw = [['윤곽', COL.line], ['몸', COL.body], ['그늘', COL.dark], ['광택', COL.glow]];
    let sx2 = pad;
    c.textBaseline = 'middle'; c.textAlign = 'left';
    sw.forEach(([n, col]) => {
      const y = pad + gw + 62;
      c.fillStyle = col; c.fillRect(sx2, y - 12, 24, 24);
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1; c.strokeRect(sx2, y - 12, 24, 24);
      c.fillStyle = '#e8e8f0'; c.font = 'bold 12px sans-serif';
      c.fillText(n, sx2 + 32, y - 6);
      c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '11px monospace';
      c.fillText(col, sx2 + 32, y + 8);
      sx2 += 132;
    });
    return { strip: strip.toDataURL('image/png'), guide: gd.toDataURL('image/png') };
  }, { S, N, Z, COL });

  const wr = (name, url) => {
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(__dirname, name), buf);
    console.log(`${name}  ${(buf.length / 1024).toFixed(1)}KB`);
  };
  wr('slime-strip.png', res.strip);
  wr('guide-slime.png', res.guide);
  await b.close();
})();

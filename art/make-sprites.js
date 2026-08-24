/* 스프라이트 생성기 — 도구 없이 코드로 픽셀을 찍는다.
   1픽셀씩 fillRect(1,1) 로 찍어 안티에일리어싱이 전혀 없다(규격 요구사항).

   실루엣은 6종뿐이고 17종 몬스터는 거기에 색만 갈아 끼운다.
   색은 게임 데이터(ENEMY_TYPES[*].color)에서 그대로 가져오므로
   미니맵·파티클·체력바와 어긋날 수 없다.

   실행: node art/make-sprites.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const SPEC = require('./atlas-spec.json');
const N = 4;                                   // 애니메이션 4프레임

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage();
  const res = await pg.evaluate(({ SPEC, N }) => {

    /* ---------- 픽셀 도구 ---------- */
    const mk = S => Array.from({ length: S }, () => Array(S).fill('.'));
    const put = (g, x, y, ch) => {
      x = Math.round(x); y = Math.round(y);
      if (g[y] && x >= 0 && x < g.length) g[y][x] = ch;
    };
    const ell = (g, cx, cy, rx, ry, ch) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) put(g, x, y, ch);
        }
    };
    // 좌우 대칭으로 그릴 때 x0 > x1 이 되는 호출이 많다.
    // 정렬하지 않으면 루프가 돌지 않아 한쪽이 통째로 빠진다(실제로 보스의 왼쪽 어깨와 깃이 없었다).
    const rect = (g, x0, y0, x1, y1, ch) => {
      const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
      const ay = Math.min(y0, y1), by = Math.max(y0, y1);
      for (let y = Math.round(ay); y <= Math.round(by); y++)
        for (let x = Math.round(ax); x <= Math.round(bx); x++) put(g, x, y, ch);
    };
    const line = (g, x0, y0, x1, y1, ch, t = 1) => {
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) * 2 + 1;
      for (let i = 0; i <= n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        for (let oy = 0; oy < t; oy++) for (let ox = 0; ox < t; ox++)
          put(g, x + ox - (t - 1) / 2, y + oy - (t - 1) / 2, ch);
      }
    };
    // 몸에 붙은 바깥 픽셀을 윤곽으로 — 두께 2
    const outline = (g, t = 2) => {
      const S = g.length;
      for (let pass = 0; pass < t; pass++) {
        const add = [];
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          if (g[y][x] !== '.') continue;
          const near = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => {
            const nx = x + dx, ny = y + dy;
            return g[ny] && g[ny][nx] && g[ny][nx] !== '.' && g[ny][nx] !== 'O';
          });
          if (near) add.push([x, y]);
        }
        for (const [x, y] of add) g[y][x] = 'O';
      }
    };
    // 아래쪽을 그늘로
    const shade = (g, fromY) => {
      for (let y = Math.round(fromY); y < g.length; y++)
        for (let x = 0; x < g.length; x++) if (g[y][x] === 'B') g[y][x] = 'D';
    };
    const eyes = (g, cx, cy, d, ch, w = 2) => {
      for (const s of [-1, 1])
        rect(g, cx + s * d - (w - 1), cy, cx + s * d, cy + w - 1, ch);
    };

    /* ---------- 실루엣 6종 ----------
       각 함수는 프레임 번호(0~3)를 받아 픽셀 격자를 돌려준다. */
    const SIL = {
      // 슬라임 계열 — 눌렸다 펴진다
      blob(f, S) {
        const g = mk(S);
        const rx = [11, 10, 11, 12][f], ry = [8, 9, 8, 7][f];
        const cy = 21.5 - (f === 1 ? 1 : 0);
        ell(g, 15.5, cy, rx, ry, 'B');
        shade(g, cy + ry * .35);
        outline(g);
        ell(g, 15.5 - rx * .42, cy - ry * .45, 3, 2, 'G');
        eyes(g, 15.5, Math.round(cy - ry * .18), 4, 'O');
        return g;
      },
      // 박쥐 — 날개가 위아래로
      bat(f, S) {
        const g = mk(S);
        const up = [0, -3, 0, 3][f];
        ell(g, 15.5, 16, 4, 4, 'B');                        // 몸
        for (const s of [-1, 1]) {                          // 날개
          line(g, 15.5 + s * 3, 15, 15.5 + s * 12, 15 + up, 'B', 3);
          line(g, 15.5 + s * 12, 15 + up, 15.5 + s * 9, 20 + up * .5, 'B', 2);
          line(g, 15.5 + s * 9, 20 + up * .5, 15.5 + s * 4, 18, 'B', 2);
        }
        for (const s of [-1, 1]) line(g, 15.5 + s * 2, 12, 15.5 + s * 4, 9, 'B', 2);  // 귀
        shade(g, 18);
        outline(g);
        eyes(g, 15.5, 15, 2, 'G', 1);
        return g;
      },
      // 유령 — 떠오르고 아랫자락이 물결친다
      ghost(f, S) {
        const g = mk(S);
        const oy = [0, -1, 0, 1][f];
        ell(g, 15.5, 15 + oy, 8, 8, 'B');
        rect(g, 7.5, 15 + oy, 23.5, 22 + oy, 'B');
        for (let x = 8; x <= 23; x++) {                     // 아랫자락
          const w = 3 + Math.sin((x + f * 2) * .9) * 2.2;
          rect(g, x, 22 + oy, x, 22 + oy + w, 'B');
        }
        shade(g, 20 + oy);
        outline(g);
        eyes(g, 15.5, 13 + oy, 4, 'G');
        return g;
      },
      // 인간형 — 다리가 번갈아 나간다
      humanoid(f, S) {
        const g = mk(S);
        const sw = [0, 2, 0, -2][f];
        // 몸통을 넓히고 어깨를 굽힌다. 가는 막대기는 어떤 색을 입혀도 허약해 보인다.
        rect(g, 9.5, 13, 22.5, 23, 'B');                    // 몸통 — 넓게
        ell(g, 16, 13, 7, 4, 'B');                          // 굽은 어깨
        ell(g, 16, 9, 4.5, 4.5, 'B');                       // 머리 — 어깨 사이에 파묻힌다
        line(g, 10, 15, 6 - sw, 22 + sw, 'B', 4);           // 팔 — 굵게, 앞으로 늘어뜨린다
        line(g, 22, 15, 26 + sw, 22 - sw, 'B', 4);
        line(g, 13, 23, 12.5 - sw, 29, 'B', 4);             // 다리 — 굵게
        line(g, 19, 23, 19.5 + sw, 29, 'B', 4);
        shade(g, 19);
        outline(g);
        eyes(g, 16, 8, 2, 'G', 1);
        return g;
      },

      // 사냥개 — 네 다리가 달린다
      hound(f, S) {
        const g = mk(S);
        const a = [0, 1, 0, -1][f];
        ell(g, 14, 18, 8, 5, 'B');                          // 몸
        ell(g, 22, 15, 4, 3.5, 'B');                        // 머리
        line(g, 24, 15, 28, 16, 'B', 2);                    // 주둥이
        for (const s of [-1, 1]) line(g, 21 + s, 12, 21 + s * 1.6, 9, 'B', 2);  // 귀
        line(g, 8, 18, 4, 14 - a, 'B', 2);                  // 꼬리
        line(g, 10, 21, 9 - a * 2, 27, 'B', 2);             // 다리 4
        line(g, 13, 21, 13 + a * 2, 27, 'B', 2);
        line(g, 17, 21, 17 - a * 2, 27, 'B', 2);
        line(g, 20, 21, 20 + a * 2, 27, 'B', 2);
        shade(g, 20);
        outline(g);
        rect(g, 22, 14, 23, 15, 'G');                       // 눈
        return g;
      },
      // 보스 — 64px. 위엄은 덩치만으로 안 된다. 형태가 읽히려면 '여백'이 있어야 한다.
      //   실패 기록: ① 망토를 넓게 → 드레스 ② 팔을 망토 안에 → 개미
      //   ③ 전부 키웠더니 프레임을 넘어 잘리고 어깨·팔이 한 덩어리로 뭉갰다.
      //   그래서 세로 구역을 나누고 구역 사이에 틈을 남긴다.
      boss(f, S) {
        const g = mk(S);
        const p = [0, 1, 2, 1][f];
        const cx = 31.5;
        const sh = 30 + p * .4;                 // 어깨선

        // ── 망토 (아래) ── 최대 폭을 프레임 안에 묶는다
        for (let y = sh + 10; y <= 56; y++) {
          const w = 9 + (y - sh - 10) * .48;
          rect(g, cx - w, y, cx + w, y, 'B');
        }
        for (let x = 12; x <= 51; x++) {
          const h = 2 + Math.sin((x + f * 3) * .7) * 2;
          rect(g, x, 56, x, 56 + h, 'B');
        }
        // ── 몸통 ── 망토보다 좁게 해서 어깨가 튀어나와 보이게
        rect(g, cx - 8, sh + 2, cx + 8, sh + 14, 'B');

        // ── 어깨 갑판 ── 몸통 밖으로 확실히 튀어나온다
        for (const s2 of [-1, 1]) {
          rect(g, cx + s2 * 9, sh - 1, cx + s2 * 21, sh + 7, 'B');
          line(g, cx + s2 * 15, sh - 1, cx + s2 * 17, sh - 8, 'B', 3);   // 갑판 가시 하나만
        }
        // ── 팔 ── 갑판 아래로. 망토(폭 9~22)보다 바깥에 두어 실루엣이 살아난다
        for (const s2 of [-1, 1]) {
          line(g, cx + s2 * 17, sh + 7, cx + s2 * 25, sh + 18 + p, 'B', 5);
          for (let k = -1; k <= 1; k++)          // 발톱
            line(g, cx + s2 * 25, sh + 18 + p, cx + s2 * 27, sh + 25 + p + k * 2, 'B', 2);
        }
        // ── 깃 ── 머리 뒤로만. 어깨와 겹치지 않게 위쪽에만.
        for (const s2 of [-1, 1]) rect(g, cx + s2 * 10, sh - 14, cx + s2 * 13, sh - 2, 'B');
        // ── 머리 ──
        ell(g, cx, sh - 10, 7.5, 7, 'B');
        // ── 뿔 ── 굵고 크게, 바깥 위로
        for (const s2 of [-1, 1]) {
          line(g, cx + s2 * 6, sh - 14, cx + s2 * 14, sh - 21 - p, 'B', 5);
          line(g, cx + s2 * 14, sh - 21 - p, cx + s2 * 21, sh - 16 - p, 'B', 4);
        }
        // ── 왕관 ── 가운데 하나만 높게. 여러 개면 뿔과 뒤엉킨다.
        line(g, cx, sh - 16, cx, sh - 26 - p, 'B', 4);
        rect(g, cx - 4, sh - 18, cx + 3, sh - 15, 'B');

        shade(g, sh + 10);
        outline(g);
        eyes(g, cx, sh - 12, 4, 'G', 3);
        rect(g, cx - 2, sh + 4, cx + 1, sh + 14, 'G');       // 가슴 표식
        rect(g, cx - 6, sh + 7, cx + 5, sh + 10, 'G');
        return g;
      },
    };

    /* ---------- 색 ---------- */
    const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
    const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v)))
      .toString(16).padStart(2, '0')).join('');
    const mix = (c, t, k) => c.map((v, i) => v + (t[i] - v) * k);

    /* ---------- 시트 ---------- */
    const rows = Object.entries(SPEC.frames);
    const W = 64 * N;
    let H = 0; for (const [, f] of rows) H += f.h;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    const frames = {};
    let y0 = 0;
    for (const [key, def] of rows) {
      const S = def.h;
      const base = hex(def.color);
      const pal = {
        O: '#0a0a12',
        B: def.color,
        D: toHex(mix(base, [0, 0, 0], .3)),      // 그늘
        G: toHex(mix(base, [255, 255, 255], .62)), // 광택 · 눈
      };
      for (let f = 0; f < N; f++) {
        const g = SIL[def.shape](f, S);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const v = g[y][x];
          if (v === '.') continue;
          c.fillStyle = pal[v];
          c.fillRect(f * S + x, y0 + y, 1, 1);
        }
      }
      frames[key] = { x: 0, y: y0, w: S, h: S, n: N, fps: def.fps || 8 };
      if (S !== 32) frames[key].s = +(28 / S).toFixed(3);
      y0 += S;
    }
    return { url: cv.toDataURL('image/png'), frames, W, H: y0 };
  }, { SPEC, N });

  const png = Buffer.from(res.url.split(',')[1], 'base64');
  fs.writeFileSync(path.join(__dirname, 'atlas.png'), png);
  fs.writeFileSync(path.join(__dirname, 'atlas-frames.json'),
    JSON.stringify(res.frames, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'atlas.b64'), png.toString('base64'));
  console.log(`atlas.png  ${res.W}×${res.H}  ${(png.length / 1024).toFixed(1)}KB`);
  console.log(`frames     ${Object.keys(res.frames).length}종`);
  await b.close();
})();

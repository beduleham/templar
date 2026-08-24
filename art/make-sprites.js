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
      /* ---------- 이펙트 ----------
         몬스터·주인공과 달리 검은 윤곽을 두르지 않는다. 빛이기 때문이다.
         B = 속성색 · G = 밝은 속성색 · W = 흰 심지. 이 세 겹이 타격감을 만든다. */

      // 피격 — 사방으로 뻗는 가시. 고리로 그렸더니 삼각형이 되고 프레임을 넘었다.
      hit(f, S) {
        const g = mk(S), c = (S - 1) / 2;
        const L = [6, 12, 14, 10][f], th = [3, 3, 2, 1][f];
        const n = f === 0 ? 4 : 8;
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2 + Math.PI / 4;
          const l = L * (i % 2 ? .55 : 1);
          line(g, c + Math.cos(a) * 1.5, c + Math.sin(a) * 1.5,
                  c + Math.cos(a) * l, c + Math.sin(a) * l, 'B', th);
          line(g, c + Math.cos(a) * 1.5, c + Math.sin(a) * 1.5,
                  c + Math.cos(a) * l * .6, c + Math.sin(a) * l * .6, 'W', Math.max(1, th - 1));
        }
        const cr = [4.5, 3.5, 2, 0][f];
        if (cr) { ell(g, c, c, cr, cr, 'G'); ell(g, c, c, cr * .5, cr * .5, 'W'); }
        return g;
      },

      // 폭발 — 흰 섬광에서 시작해 속성색 고리로 비어 간다
      boom(f, S) {
        const g = mk(S), c = (S - 1) / 2;
        const R = [9, 16.5, 20.5, 22][f];
        const inner = [0, 0, 8, 14][f];
        // 흰 심지가 남는 경계. 뒤로 갈수록 심지가 사라지고 속성색만 남는다
        const wCut = [.42, .32, .18, 0][f], gCut = [.75, .68, .6, .45][f];
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
          const a = Math.atan2(dy, dx);
          // 정원이면 폭발이 아니라 공이다. 다만 주기가 낮으면 꽃잎이 된다 —
          // 주기를 올리고 진폭을 낮춰 '울퉁불퉁한 덩어리'로 만든다.
          const lump = 1 + Math.sin(a * 7 + f * 1.3) * .08
                         + Math.sin(a * 11 - f * 2) * .05
                         + Math.sin(a * 3 + f) * .05;
          const rr = R * lump, ir = inner * lump;
          if (d > rr || d < ir) continue;
          const t = (d - ir) / Math.max(1, rr - ir);
          g[y][x] = t < wCut ? 'W' : t < gCut ? 'G' : 'B';
        }
        for (let i = 0; i < 11; i++) {                 // 튀는 파편
          const a = i / 11 * Math.PI * 2 + f * .5, d = Math.min(R + 3 + f * 2, c - 1);
          put(g, c + Math.cos(a) * d, c + Math.sin(a) * d, 'G');
        }
        return g;
      },

      // 시전 섬광 — 무기 끝에서 한 번 터진다
      cast(f, S) {
        const g = mk(S), c = (S - 1) / 2;
        const R = [4, 8, 11, 13][f], th = [3, 2, 2, 1][f];
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2 + f * .2, L = R * (i % 2 ? .5 : 1);
          line(g, c, c, c + Math.cos(a) * L, c + Math.sin(a) * L, i % 2 ? 'B' : 'W', th);
        }
        const cr = [4.5, 5.5, 3.5, 1.5][f];
        ell(g, c, c, cr, cr, 'B'); ell(g, c, c, cr * .6, cr * .6, 'W');
        return g;
      },

      /* 주인공 — 직업 4종 × 동작 4종.
         몬스터와 달리 단색이 아니다. 살·강철·가죽에 직업색(A)을 얹는다.
         항상 오른쪽을 보게 그리고, 왼쪽은 게임에서 flip 으로 뒤집는다.

         실패 기록: ① 망토를 몸 폭만큼 넓게 → 치마 ② 무기를 얇게 → 안 보인다
         ③ 영창에 두 팔을 올렸더니 → 살색 덩어리. 그래서 몸은 좁게(11px),
         무기는 굵고 밝게, 영창은 지팡이 끝 하나에 빛을 모은다. */
      hero(f, S, def) {
        const g = mk(S);
        const st = def.state, cl = def.cls;
        const cx = 15, feet = 28;
        // 세로 리듬
        const bob = st === 'walk' ? [0, -1, 0, -1][f]
          : st === 'idle' ? [0, 0, -1, 0][f]
          : st === 'cast' ? [0, -1, -2, -1][f] : [0, 0, 1, 0][f];
        const sw = st === 'walk' ? [3, 0, -3, 0][f] : st === 'attack' ? [1, 0, -2, -1][f] : 0;
        const ty = 13 + bob, by = 22 + bob;        // 몸통 위 / 허리
        const hy = ty - 6;                         // 머리 중심

        // ── 망토 ── 몸 왼쪽 뒤로만. 다리까지 덮으면 치마가 된다.
        const flare = st === 'walk' ? [3, 1, 4, 1][f]
          : st === 'attack' ? [0, 3, 6, 3][f]
          : st === 'cast' ? [2, 4, 5, 4][f] : [0, 0, 1, 0][f];
        for (let y = ty - 1; y <= feet - 3; y++) {
          const t = (y - ty + 1) / (feet - 2 - ty);
          rect(g, cx - 2, y, cx - 4 - t * (2 + flare), y, t > .55 ? 'a' : 'A');
        }

        // ── 다리 ──
        for (const s2 of [-1, 1]) {
          const off = s2 * sw * .55;
          rect(g, cx + s2 * 3 - 1 + off, by - 1, cx + s2 * 3 + 1 + off, feet - 2, 'l');
          rect(g, cx + s2 * 3 - 2 + off, feet - 1, cx + s2 * 3 + 2 + off, feet, 'L');
        }

        // ── 몸통 ──
        const armor = cl === 'paladin' ? 'M' : cl === 'warrior' ? 'm' : cl === 'rogue' ? 'l' : 'A';
        rect(g, cx - 5, ty, cx + 5, by, armor);
        ell(g, cx, ty + 1, 6, 3, armor);                  // 어깨
        if (cl === 'mage')                                 // 로브 — 살짝만 퍼진다
          for (let y = by; y <= feet - 2; y++)
            rect(g, cx - 4 - (y - by) * .35, y, cx + 4 + (y - by) * .35, y, 'A');
        if (cl === 'paladin') {                            // 가슴 십자
          rect(g, cx - 1, ty + 2, cx + 1, by - 5, 'A');
          rect(g, cx - 3, ty + 4, cx + 3, ty + 5, 'A');
        } else if (cl === 'warrior') {                     // 어깨 갑판
          for (const s2 of [-1, 1]) rect(g, cx + s2 * 4, ty - 1, cx + s2 * 6, ty + 2, 'M');
          rect(g, cx - 5, ty + 4, cx + 5, ty + 5, 'A');
        } else if (cl === 'rogue') {
          line(g, cx - 4, by - 4, cx + 4, ty + 1, 'A', 3); // 가슴을 지르는 띠
        }
        rect(g, cx - 5, by - 3, cx + 5, by - 2, 'L');       // 허리띠
        rect(g, cx - 1, by - 3, cx, by - 2, 'G');           // 버클

        // ── 머리 · 투구 ──
        ell(g, cx, hy, 4, 4, 'S');
        if (cl === 'paladin') {
          rect(g, cx - 4, hy - 5, cx + 4, hy + 3, 'M');     // 전면 투구
          rect(g, cx - 4, hy - 6, cx + 4, hy - 6, 'm');
          line(g, cx - 1, hy - 7, cx - 5, hy - 12 - (f & 1), 'A', 3);  // 깃털
        } else if (cl === 'warrior') {
          rect(g, cx - 4, hy - 5, cx + 4, hy - 1, 'm');     // 뿔 투구
          for (const s2 of [-1, 1]) {
            line(g, cx + s2 * 4, hy - 4, cx + s2 * 7, hy - 8, 'M', 2);
            put(g, cx + s2 * 8, hy - 9, 'M');
          }
          rect(g, cx - 3, hy + 2, cx + 3, hy + 4, 'L');     // 수염
        } else if (cl === 'rogue') {
          ell(g, cx, hy - 1, 4.5, 4.5, 'L');                // 두건
          rect(g, cx - 4, hy - 1, cx + 4, hy + 2, 'L');
          rect(g, cx - 1, hy, cx + 4, hy + 1, 'S');         // 드러난 눈매
          line(g, cx - 4, hy + 1, cx - 8 - flare, hy + 5, 'l', 2);   // 두건 꼬리
        } else {
          rect(g, cx - 3, hy + 2, cx + 2, hy + 5, 'M');     // 흰 수염
          rect(g, cx - 5, hy - 3, cx + 5, hy - 2, 'A');     // 모자 챙
          for (let i = 0; i <= 9; i++) {                    // 고깔 — 빠르게 좁아진다
            const w = 3.6 - i * .4;
            if (w < 0) break;
            rect(g, cx - w, hy - 4 - i, cx + w, hy - 4 - i, 'A');
          }
          put(g, cx, hy - 14, 'G');
        }

        // ── 손 위치와 무기 각도 ── [x, y, 각도] · 프레임을 넘지 않게 잡은 값
        const POSE = {
          idle: [[5, by - 5, .50], [5, by - 5, .45], [5, by - 6, .55], [5, by - 5, .45]],
          walk: [[6, by - 6, .35], [5, by - 5, .55], [4, by - 5, .40], [5, by - 6, .50]],
          attack: [[1, ty - 2, -2.2], [6, ty + 1, -0.9], [4, by - 5, 0.15], [6, by - 2, 0.9]],
          cast: [[4, ty, -0.95], [4, ty - 1, -0.98], [4, ty - 1, -1.00], [4, ty - 1, -0.98]],
        }[st][f];
        // 평상시 자세는 직업마다 다르다. 도끼를 수평으로 들면 걸레가 되고
        // 지팡이를 수평으로 들면 빗자루가 된다.
        const rest = (st === 'idle' || st === 'walk')
          ? (cl === 'mage' ? -1.45 : cl === 'warrior' ? -0.60 : 0) : 0;
        // 지팡이를 세우면 보석이 얼굴에 겹친다 — 손을 두 칸 밖으로
        const hx = cx + POSE[0] + (rest && cl === 'mage' ? 2 : 0), hh = POSE[1], ang = rest || POSE[2];
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const px = -dy, py = dx;                            // 무기 축의 수직
        line(g, cx + 4, ty + 2, hx, hh, 'S', 2);            // 앞팔
        rect(g, hx - 1, hh - 1, hx + 1, hh + 1, 'L');       // 장갑

        // ── 무기 ── 굵고 끝에 흰 광택. 얇으면 화면에서 사라진다.
        const blade = (len, t, col) => {
          line(g, hx, hh, hx + dx * len, hh + dy * len, col, t);
          line(g, hx + dx * (len - 2) + px, hh + dy * (len - 2) + py,
                  hx + dx * len + px, hh + dy * len + py, 'W', 1);
        };
        if (cl === 'paladin') {
          line(g, hx - px * 3, hh - py * 3, hx + px * 3, hh + py * 3, 'L', 2);  // 코등이
          blade(11, 2, 'M');
          ell(g, cx - 7, ty + 3, 3, 4, 'M');                // 방패
          rect(g, cx - 8, ty + 2, cx - 6, ty + 4, 'A');
        } else if (cl === 'warrior') {
          line(g, hx - dx * 4, hh - dy * 4, hx + dx * 8, hh + dy * 8, 'L', 3);  // 자루
          const ax = hx + dx * 8, ay = hh + dy * 8;                             // 도끼 날
          line(g, ax + px * 4, ay + py * 4, ax - px * 4, ay - py * 4, 'M', 2);
          line(g, ax + dx * 2 + px * 3, ay + dy * 2 + py * 3,
                  ax + dx * 2 - px * 3, ay + dy * 2 - py * 3, 'M', 2);
          put(g, ax + dx * 2 + px * 3, ay + dy * 2 + py * 3, 'W');
        } else if (cl === 'rogue') {
          blade(8, 2, 'M');
          const bx = cx - 5, bb = ty + 4;                   // 왼손 단검
          line(g, bx, bb, bx - dx * 6, bb - dy * 6, 'M', 2);
        } else {
          line(g, hx - dx * 3, hh - dy * 3, hx + dx * 9, hh + dy * 9, 'L', 3);  // 지팡이
          const ox2 = hx + dx * 10, oy2 = hh + dy * 10;
          const R = st === 'cast' ? [2.5, 3.2, 3.8, 3.2][f] : 2.5;
          ell(g, ox2, oy2, R, R, 'G'); ell(g, ox2, oy2, R * .55, R * .55, 'W');
        }

        outline(g);

        // ── 내부 경계 ── 윤곽은 겉만 잡는다. 안쪽도 갈라줘야 형태가 읽힌다.
        rect(g, cx - 5, by - 4, cx + 5, by - 4, 'O');        // 허리 위
        rect(g, cx, by - 1, cx, feet - 2, 'O');              // 두 다리 사이
        if (cl === 'paladin' || cl === 'warrior') {
          rect(g, cx - 3, hy - 1, cx + 3, hy, 'O');          // 투구 틈
          eyes(g, cx + 1, hy - 1, 2, 'G', 1);
        } else if (cl === 'rogue') {
          rect(g, cx - 2, hy - 1, cx + 4, hy - 1, 'O');
          eyes(g, cx + 1, hy, 2, 'G', 1);
        } else {
          eyes(g, cx + 1, hy, 2, 'O', 1);
        }

        // ── 동작 효과 ── 휘두른 자취 · 영창의 빛 (윤곽 뒤라 지워지지 않는다)
        if (st === 'attack' && f >= 1 && f <= 2) {
          const a0 = f === 1 ? -1.5 : -.7, a1 = f === 1 ? -.2 : .9;
          const R = f === 1 ? 12 : 14;
          for (let i = 0; i <= 16; i++) {
            const a = a0 + (a1 - a0) * i / 16;
            put(g, cx + 2 + Math.cos(a) * R, ty + 3 + Math.sin(a) * R, i % 3 === 2 ? 'W' : 'G');
          }
        }
        if (st === 'cast') {
          const R2 = [2, 3, 4, 3][f];                        // 치켜든 무기 앞의 빛
          const tx = cx + 7, tt = ty - 7;
          ell(g, tx, tt, R2, R2, 'G'); ell(g, tx, tt, R2 * .5, R2 * .5, 'W');
          for (let i = 0; i < 6; i++) {
            const a = i / 6 * Math.PI * 2 + f * .4;
            put(g, tx + Math.cos(a) * (R2 + 2), tt + Math.sin(a) * (R2 + 2), 'W');
          }
          const R = [3, 5, 7, 5][f];                         // 발밑 마법진
          for (let i = 0; i < 18; i++) {
            const a = i / 18 * Math.PI * 2;
            put(g, cx + Math.cos(a) * R * 1.6, feet - 1 + Math.sin(a) * R * .45,
              i % 3 === 0 ? 'W' : 'G');
          }
          for (let i = 0; i < 4; i++)                        // 떠오르는 불티
            put(g, cx - 7 + i * 5, ty - 4 - ((f * 3 + i * 5) % 9), 'G');
        }
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
        // 주인공용 — 단색 실루엣으로는 영웅이 안 된다. 살·강철·가죽을 따로 둔다.
        A: def.color,                              // 직업색
        a: toHex(mix(base, [0, 0, 0], .42)),        // 직업색 그늘 (망토 안쪽)
        S: '#f2d8b4', s: '#c49a72',                 // 살 · 살 그늘
        M: '#d9dee9', m: '#8d94a8',                 // 강철 · 강철 그늘
        L: '#6d4c33', l: '#452e1f',                 // 가죽 · 가죽 그늘
        W: '#ffffff',
      };
      for (let f = 0; f < N; f++) {
        const g = SIL[def.shape](f, S, def);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const v = g[y][x];
          if (v === '.') continue;
          c.fillStyle = pal[v];
          c.fillRect(f * S + x, y0 + y, 1, 1);
        }
      }
      frames[key] = { x: 0, y: y0, w: S, h: S, n: N, fps: def.fps || 8 };
      if (S !== 32 && !def.fx) frames[key].s = +(28 / S).toFixed(3);
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

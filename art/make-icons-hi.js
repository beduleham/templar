/* 메뉴 글리프 32칸 — 재질(materials)로 그린다.

   왜 또 고치는가: 칸을 32개로 늘린 뒤에도 아이콘은 전부 '한 가지 색의 명암'
   이었다. pxPal 이 색 하나에서 세 단계를 뽑아 주는 구조라, 검도 파랗고
   물약도 파랗고 해골도 파랬다. 칸을 아무리 늘려도 강철과 나무와 금이
   같은 색이면 세밀해 보이지 않는다.

   그래서 칸마다 '밝기'가 아니라 '무엇으로 만들어졌는가'를 적는다.

     0~7  호출한 색(속성색·직업색)의 여덟 단계 — 마력·불꽃·보석처럼 색이 뜻인 것
     a~e  강철   (다섯 단계)      f~i  나무·가죽 (네 단계)
     j~m  금     (네 단계)        n~q  뼈·돌     (네 단계)
     r~t  피     (세 단계)        u~w  풀빛     (세 단계)
     x    윤곽 (자동)             z    순백 광점

   화면에 한 번에 서른세 색이 오른다. 예전엔 일곱이었다.

   호출 색을 완전히 버리지 않는 이유: 속성 표시(불·냉기·번개)와 조합 칸은
   색 자체가 정보다. 그래서 '색이 뜻인 부분'만 0~7 로 두고, 나머지는 재질로 굳혔다.
   검은 어떤 색으로 불러도 강철이고, 손잡이는 가죽이고, 코등이는 금이다.

   음영: 칸이 속한 램프 안에서만 오르내린다. 강철은 강철 단계로,
   나무는 나무 단계로 밝아진다 — 그래야 재질이 유지된다.

   실행: node art/make-icons-hi.js   → 화면에 붙여 넣을 MENU_ICONS_HI 를 뱉는다 */
const S = 32;

/* 재질 램프. 각 램프의 base 만 자동 음영이 건드린다 —
   손으로 찍은 하이라이트를 나중에 지우지 않기 위해서다. */
const RAMPS = ['01234567', 'abcde', 'fghi', 'jklm', 'nopq', 'rst', 'uvw'];
const BASE = { '01234567': '3', 'abcde': 'c', 'fghi': 'g', 'jklm': 'k', 'nopq': 'p', 'rst': 's', 'uvw': 'v' };
const RAMP_OF = {};
for (const r of RAMPS) for (const ch of r) RAMP_OF[ch] = r;

// 짧은 이름 — 아래 그림에서 쓴다
const T = '3', T0 = '0', T1 = '1', T2 = '2', T5 = '5', T6 = '6', T7 = '7';
const ST = 'c', ST0 = 'a', ST1 = 'b', ST3 = 'd', ST4 = 'e';
const WD = 'g', WD0 = 'f', WD2 = 'h', WD3 = 'i';
const GD = 'k', GD0 = 'j', GD2 = 'l', GD3 = 'm';
const BN = 'p', BN0 = 'n', BN1 = 'o', BN3 = 'q';
const BL = 's', BL0 = 'r', BL2 = 't';
const MS = 'v', MS0 = 'u', MS2 = 'w';
const OUT = 'x', SPEC = 'z';

const mk = () => Array.from({ length: S }, () => Array(S).fill('.'));
const put = (g, x, y, c) => {
  x = Math.round(x); y = Math.round(y);
  if (y >= 0 && y < S && x >= 0 && x < S) g[y][x] = c;
};
const rect = (g, x0, y0, x1, y1, c) => {
  for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y++)
    for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++) put(g, x, y, c);
};
const ell = (g, cx, cy, rx, ry, c) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(g, x, y, c);
    }
};
/* 고리 — 원에서 원을 뺀다. 선으로 그으면 굵기가 들쭉날쭉해진다. */
const ringf = (g, cx, cy, r0, r1, c) => {
  for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y++)
    for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r1 && d >= r0) put(g, x, y, c);
    }
};
const line = (g, x0, y0, x1, y1, c, t = 1) => {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) * 3 + 1;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    for (let oy = 0; oy < t; oy++) for (let ox = 0; ox < t; ox++)
      put(g, x + ox - (t - 1) / 2, y + oy - (t - 1) / 2, c);
  }
};
/* 다각형 — 방패·보석·지붕처럼 각진 것은 타원을 겹쳐 만들면 반드시 뭉갠다. */
const poly = (g, pts, c) => {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
        xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) rect(g, Math.round(xs[i]), y, Math.round(xs[i + 1]), y, c);
  }
};
/* 큰 원에서 작은 원을 뺀 초승달 — 초승달은 선이 아니라 면이다. */
const crescent = (g, ax, ay, ar, bx, by, br, c) => {
  for (let y = Math.floor(ay - ar); y <= Math.ceil(ay + ar); y++)
    for (let x = Math.floor(ax - ar); x <= Math.ceil(ax + ar); x++)
      if (Math.hypot(x - ax, y - ay) <= ar && Math.hypot(x - bx, y - by) > br) put(g, x, y, c);
};
/* 깃 하나 — 뿌리는 둥글고 끝으로 갈수록 뾰족해진다.
   날개를 '나란한 막대 다섯'으로 그리면 반드시 갈퀴가 된다. 부챗살처럼 벌려야 한다. */
const feather = (g, x0, y0, ang, len, w, c) => {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  for (let i = 0; i <= len * 3; i++) {
    const t = i / (len * 3);
    const half = w * Math.pow(1 - t, .62) * Math.min(1, t / .14 + .25);
    for (let k = -half; k <= half; k += .34) put(g, x0 + ux * len * t + nx * k, y0 + uy * len * t + ny * k, c);
  }
};
/* 칼날 — 강철 몸 · 가죽 손잡이 · 금 코등이. 검 계열 셋이 같이 쓴다. */
const blade = (g, x0, y0, x1, y1, w, guard, grip) => {
  const ux = (x1 - x0), uy = (y1 - y0), L = Math.hypot(ux, uy);
  const nx = -uy / L, ny = ux / L;
  for (let i = 0; i <= L * 3; i++) {
    const t = i / (L * 3);
    const cx = x0 + ux * t, cy = y0 + uy * t;
    const half = w * (t > .82 ? (1 - t) / .18 : 1);
    for (let k = -half; k <= half; k += .34) put(g, cx + nx * k, cy + ny * k, ST);
  }
  for (let i = 0; i <= L * 3; i++) {                        // 피홈 — 날 가운데를 한 단 어둡게
    const t = i / (L * 3);
    if (t > .8) break;
    put(g, x0 + ux * t + nx * .25, y0 + uy * t + ny * .25, ST1);
  }
  for (let i = 0; i <= L * 3; i++) {                        // 날 끝의 선
    const t = i / (L * 3);
    put(g, x0 + ux * t - nx * (w * .8), y0 + uy * t - ny * (w * .8), ST4);
  }
  line(g, x0 - nx * guard, y0 - ny * guard, x0 + nx * guard, y0 + ny * guard, GD, 3);
  const gx = x0 - ux / L * grip, gy = y0 - uy / L * grip;
  line(g, x0, y0, gx, gy, WD, 3);                           // 감은 가죽
  for (let k = 1; k < grip - 1; k += 2)
    put(g, x0 - ux / L * k, y0 - uy / L * k, WD0);
  ell(g, gx, gy, 2, 2, GD);                                 // 자루끝
  put(g, x1, y1, SPEC);
};

const solid = (g, x, y) => { const v = g[y] && g[y][x]; return !!v && v !== '.' && v !== OUT; };

const outline = (g) => {
  const add = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (g[y][x] !== '.') continue;
    if ([[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => solid(g, x + dx, y + dy))) add.push([x, y]);
  }
  for (const [x, y] of add) g[y][x] = OUT;
};

/* 빛은 왼쪽 위에서 온다 — 스프라이트·지형·이펙트와 같은 방향.

   '그 방향으로 몸이 몇 칸 남았는가'를 재서 표면에서 안쪽으로 단계를 만든다.
   재질이 생긴 뒤로는 그 단계를 자기 램프 안에서만 옮긴다 — 강철이 밝아져도
   강철이어야 하기 때문이다. */
const shade = (g) => {
  const ray = (x, y, dx, dy) => { let n = 0; while (n < 7 && solid(g, x + dx * (n + 1), y + dy * (n + 1))) n++; return n; };
  const out = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ch = g[y][x], ramp = RAMP_OF[ch];
    if (!ramp || ch !== BASE[ramp]) continue;               // 손으로 찍은 단계는 건드리지 않는다
    const lit = Math.min(ray(x, y, -1, 0), ray(x, y, 0, -1));
    const dark = Math.min(ray(x, y, 1, 0), ray(x, y, 0, 1));
    const t = lit + dark;
    if (t <= 1) continue;                                   // 얇은 곳은 그대로 — 다 밝히면 형태가 날아간다
    let d = 0;
    if (lit === 0) d = 2;
    else if (dark === 0) d = -2;
    else if (lit === 1 && t >= 3) d = 1;
    else if (dark === 1 && t >= 3) d = -1;
    if (!d) continue;
    const i = ramp.indexOf(ch);
    out.push([x, y, ramp[Math.max(0, Math.min(ramp.length - 1, i + d))]]);
  }
  for (const [x, y, c] of out) g[y][x] = c;
};

const G = {};
const def = (name, fn) => { const g = mk(); fn(g); outline(g); shade(g); G[name] = g; };
const gloss = (g, x, y, w = 1, h = 1) => rect(g, x, y, x + w - 1, y + h - 1, SPEC);

// ── 기본 ──────────────────────────────────────────────
def('orb', g => {                                   // 마력 구슬 — 색이 곧 뜻이라 전부 호출 색
  ell(g, 16, 16, 13, 13, T);
  ell(g, 19.5, 19.5, 9.5, 9.5, T2);
  ell(g, 21, 21, 6, 6, T1);
  ell(g, 22.5, 22.5, 3, 3, T0);
  ell(g, 12.5, 12.5, 7, 7, T5);
  ell(g, 11.5, 11.5, 3.6, 3.6, T6);
  ringf(g, 16, 16, 11.6, 13, T7);                   // 테두리에 도는 빛
  gloss(g, 10, 9, 3, 2); gloss(g, 9, 11, 1, 1);
});
def('gem', g => {                                   // 보석 — 각진 면이 보석이다
  poly(g, [[16,2],[28,12],[16,30],[4,12]], T);
  poly(g, [[16,2],[28,12],[16,12],[4,12]], T5);
  poly(g, [[16,2],[16,12],[4,12]], T6);
  poly(g, [[16,12],[28,12],[16,30]], T1);
  poly(g, [[16,12],[22,12],[16,24]], T2);
  line(g, 4, 12, 28, 12, T0, 1);
  line(g, 16, 12, 16, 30, T2, 1);
  line(g, 9, 7, 23, 7, T7, 1);
  gloss(g, 11, 6, 3, 1);
});
def('element', g => {                               /* 반짝임 — 고리를 두르면 무엇을 넣어도 조준경이 된다.
                                                       속성색이 뜻이라 재질을 섞지 않는다. */
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = Math.abs(x - 15.5) / 15, dy = Math.abs(y - 15.5) / 15;
    if (Math.sqrt(dx) + Math.sqrt(dy) <= 1) put(g, x, y, T);
  }
  ell(g, 15.5, 15.5, 6, 6, T5);
  ell(g, 15.5, 15.5, 3.4, 3.4, T7);
  for (const [x, y] of [[26, 6], [6, 26]]) { ell(g, x, y, 1.8, 1.8, T5); put(g, x, y, T7); }
  gloss(g, 13, 12, 2, 2);
});
def('skill', g => {                                 // 터지는 별 — 금빛 심에 색 갈래
  poly(g, [[16,0],[20,14],[16,20],[12,14]], T);
  poly(g, [[16,32],[20,18],[16,12],[12,18]], T);
  poly(g, [[0,16],[14,20],[20,16],[14,12]], T);
  poly(g, [[32,16],[18,20],[12,16],[18,12]], T);
  for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]])
    line(g, 16 + dx * 4, 16 + dy * 4, 16 + dx * 11, 16 + dy * 11, T2, 3);
  ell(g, 16, 16, 7, 7, T5);
  ell(g, 16, 16, 4.6, 4.6, GD3);
  ell(g, 15, 15, 2.6, 2.6, SPEC);
});
def('stance', g => {                                // 문장 방패 — 강철 판 · 금 테 · 색 십자
  poly(g, [[4,3],[27,3],[27,15],[16,29],[5,15]], GD);          // 금 테
  poly(g, [[7,6],[24,6],[24,15],[16,25],[7,15]], ST);          // 강철 면
  rect(g, 14, 9, 17, 22, T); rect(g, 11, 12, 20, 15, T);       // 십자
  rect(g, 15, 10, 16, 21, T6); rect(g, 12, 13, 19, 14, T6);
  for (const [x, y] of [[6,5],[25,5],[6,14],[25,14]]) put(g, x, y, GD3);   // 못
  gloss(g, 9, 5, 4, 1);
});

// ── 무기 ──────────────────────────────────────────────
def('weapon', g => { blade(g, 9, 24, 27, 5, 2.6, 5.5, 6); gloss(g, 24, 6, 2, 2); });
def('dagger', g => { blade(g, 11, 22, 25, 8, 2.2, 4, 5); gloss(g, 22, 9, 2, 2); });
def('edge',   g => { blade(g, 6, 27, 28, 4, 1.7, 3.5, 4); gloss(g, 25, 5, 2, 2); });
def('whip', g => {                                  // 쇠사슬 플레일 — 나무 자루 · 강철 사슬 · 강철 가시공
  rect(g, 3, 20, 7, 29, WD);
  rect(g, 3, 20, 4, 29, WD0);
  rect(g, 2, 26, 8, 27, GD);                                   // 손잡이 띠
  rect(g, 2, 19, 8, 20, GD);                                   // 사슬 고리 자리
  for (const [x, y] of [[9, 19], [13, 16], [17, 13]]) ringf(g, x, y, 1.2, 2.6, ST);
  ell(g, 22, 10, 6.5, 6.5, ST);
  ell(g, 24, 12, 3.6, 3.6, ST1);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    line(g, 22 + Math.cos(a) * 6, 10 + Math.sin(a) * 6,
            22 + Math.cos(a) * 9.5, 10 + Math.sin(a) * 9.5, ST, 2);
  }
  ell(g, 19.5, 7.5, 2.4, 2.4, ST4);
  gloss(g, 18, 6, 2, 2);
});
def('scythe', g => {                                // 낫 — 나무 자루 · 강철 날 · 금 목테
  line(g, 21, 4, 26, 31, WD, 4);
  line(g, 23, 4, 28, 31, WD0, 1);
  line(g, 24, 20, 30, 23, WD, 3);
  rect(g, 19, 8, 24, 10, GD);                                  // 날을 무는 목테
  const C = [19, 18], R = 13;
  for (let i = 0; i <= 120; i++) {
    const t = i / 120, a = (-82 - 96 * t) * Math.PI / 180;
    const th = 4.6 * (1 - t * .84);
    for (let k = -th; k <= th; k += .3)
      put(g, C[0] + Math.cos(a) * (R + k), C[1] + Math.sin(a) * (R + k), ST);
  }
  /* 가장자리 선을 손으로 그었더니 날 등이 하얗게 얼룩졌다. 표본을 400개로 늘려도
     마찬가지였는데, 원인이 표본이 아니었기 때문이다 — 손으로 찍은 칸과 shade 가
     밝힌 칸이 한 줄에 섞여서다. 굽은 면의 음영은 shade 에 맡기고 손을 뗀다.
     안쪽 날만 한 줄 세워 '어디가 베는 쪽인지'를 남긴다. */
  for (let i = 0; i <= 400; i++) {
    const t = i / 400, a = (-82 - 96 * t) * Math.PI / 180;
    const th = 4.6 * (1 - t * .84);
    put(g, C[0] + Math.cos(a) * (R - th + .9), C[1] + Math.sin(a) * (R - th + .9), ST3);
  }
  gloss(g, 5, 19, 2, 2);
});
def('bolt', g => {                                  // 번개 — 속성색 몸에 흰 심
  poly(g, [[20,1],[11,15],[16,15],[9,31],[24,12],[18,12],[24,1]], T);
  poly(g, [[19,3],[13,14],[16,14],[12,25]], T6);
  poly(g, [[18,5],[15,13],[17,13],[14,21]], SPEC);
  gloss(g, 17, 4, 2, 2);
});
def('flame', g => {                                 /* 불꽃 — 겉은 속성색, 심은 금빛에서 흰빛으로.
                                                       아래 3/4 가 가장 넓고 밑동이 오목하다. */
  for (let y = 2; y <= 29; y++) {
    const t = (y - 2) / 27;
    const w = t < .78 ? 13 * Math.pow(t / .78, .55) : 13 * (1 - (t - .78) / .22 * .45);
    rect(g, 16 - w, y, 15 + w, y, T);
  }
  for (let x = 5; x <= 26; x++) {
    const d = Math.round(4.5 * Math.cos((x - 15.5) / 11 * Math.PI * .5));
    rect(g, x, 30 - d, x, 31, '.');
  }
  for (let y = 13; y <= 27; y++) {
    const w = 5.8 * Math.sin((y - 11) / 17 * Math.PI);
    rect(g, 16 - w, y, 15 + w, y, T6);
  }
  for (let y = 17; y <= 27; y++) {
    const w = 3.4 * Math.sin((y - 15) / 13 * Math.PI);
    rect(g, 16 - w, y, 15 + w, y, GD3);
  }
  for (let y = 21; y <= 27; y++) {
    const w = 1.6 * Math.sin((y - 19) / 9 * Math.PI);
    rect(g, 16 - w, y, 15 + w, y, SPEC);
  }
  gloss(g, 14, 8, 2, 3);
});
def('tome', g => {                                  // 책 — 가죽 표지 · 금 장식 · 뼈빛 쪽
  poly(g, [[2,7],[15,4],[15,27],[2,29]], WD);
  poly(g, [[17,4],[30,7],[30,29],[17,27]], WD);
  poly(g, [[4,9],[14,6.7],[14,26],[4,27.6]], BN);              // 쪽
  poly(g, [[18,6.7],[28,9],[28,27.6],[18,26]], BN);
  rect(g, 15, 4, 16, 28, GD0);                                 // 책등
  for (let i = 0; i < 4; i++) {
    rect(g, 6, 11 + i * 4, 13, 11 + i * 4, BN0);
    rect(g, 19, 11 + i * 4, 26, 11 + i * 4, BN0);
  }
  rect(g, 14, 15, 17, 17, GD3);                                // 죔쇠
  gloss(g, 5, 10, 3, 1);
});
def('aura', g => {                                  // 성역 — 금 고리 안에 속성색 빛
  ringf(g, 16, 16, 11.5, 14, GD);
  ringf(g, 16, 16, 6, 8, GD);
  ell(g, 16, 16, 4, 4, T5);
  ell(g, 16, 16, 2, 2, SPEC);
  ringf(g, 16, 16, 8.6, 11, T2);                               // 고리 사이에 고인 빛
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    line(g, 16 + Math.cos(a) * 8.5, 16 + Math.sin(a) * 8.5,
            16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, GD3, 1);
  }
  gloss(g, 11, 4, 3, 1);
});

// ── 능력·보조 ────────────────────────────────────────
def('power', g => {                                 // 힘 — 속성색 갈매기에 금 날
  for (const y of [3, 17]) {
    poly(g, [[2, y + 11], [16, y], [30, y + 11], [30, y + 4], [16, y + 5], [2, y + 4]], T);
    line(g, 3, y + 5, 16, y + 1, GD3, 1); line(g, 16, y + 1, 29, y + 5, GD, 1);
  }
});
def('clock', g => {                                 // 시계 — 금 테 · 뼈빛 문자판 · 강철 바늘
  ringf(g, 16, 16, 11.5, 14.5, GD);
  ell(g, 16, 16, 11.5, 11.5, BN);
  ell(g, 15, 15, 9.5, 9.5, BN3);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    line(g, 16 + Math.cos(a) * 9.4, 16 + Math.sin(a) * 9.4,
            16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, BN0, i % 3 === 0 ? 2 : 1);
  }
  line(g, 16, 16, 16, 8.5, ST0, 2);
  line(g, 16, 16, 22, 18, ST0, 2);
  ell(g, 16, 16, 1.4, 1.4, GD3);
  gloss(g, 9, 6, 3, 1);
});
def('ring', g => {                                  // 반지 — 금 띠에 속성색 알
  ringf(g, 16, 21, 8, 11, GD);
  rect(g, 13, 12, 18, 14, GD);
  poly(g, [[12,2],[20,2],[25,9],[16,15],[7,9]], T);
  poly(g, [[12,2],[16,2],[16,9],[7,9]], T6);
  poly(g, [[16,9],[25,9],[16,15]], T1);
  line(g, 7, 9, 25, 9, T2, 1);
  put(g, 13, 4, SPEC); put(g, 14, 4, SPEC);
  gloss(g, 10, 18, 1, 3);
});
def('boot', g => {                                  // 장화 — 가죽 · 강철 밑창 · 금 죔쇠
  rect(g, 8, 2, 19, 6, WD);
  rect(g, 10, 6, 19, 17, WD);
  rect(g, 8, 17, 19, 21, WD);
  rect(g, 8, 21, 24, 27, WD);
  ell(g, 24, 24, 4.4, 3.6, WD);
  rect(g, 6, 27, 28, 29, ST0);                                 // 밑창
  rect(g, 6, 22, 8, 29, ST0);                                  // 뒤축
  rect(g, 8, 9, 19, 11, GD);                                   // 죔쇠 띠
  rect(g, 12, 8, 15, 12, GD3);
  for (let i = 0; i < 3; i++) line(g, 11, 20 - i * 3, 18, 22 - i * 3, WD0, 1);
  rect(g, 10, 6, 12, 17, WD3);
  gloss(g, 9, 3, 3, 1);
});
def('shield', g => {                                // 방패 — 강철 판 · 금 배꼽과 못
  poly(g, [[3,3],[28,3],[28,15],[16,29],[4,15]], ST);
  poly(g, [[6,6],[25,6],[25,15],[16,25],[6,15]], ST1);
  poly(g, [[8,8],[23,8],[23,15],[16,22],[8,15]], T2);          // 문장 바탕
  ell(g, 15.5, 14, 5.5, 5.5, GD);
  ell(g, 14, 12.5, 2.6, 2.6, GD3);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    put(g, 15.5 + Math.cos(a) * 8.6, 14 + Math.sin(a) * 8.6, GD3);
  }
  gloss(g, 8, 5, 4, 1);
});
def('leaf', g => {                                  // 잎 — 풀빛. 색이 고정이라 오히려 눈에 띈다
  const ax = 26, ay = 4, bx = 8, by = 24;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const L = Math.hypot(ax - mx, ay - my);
  const px = -(by - ay) / (L * 2), py = (bx - ax) / (L * 2);
  const half = 7.2, R = (L * L + half * half) / (2 * half), d = R - half;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
    if (Math.hypot(x - (mx + px * d), y - (my + py * d)) <= R &&
        Math.hypot(x - (mx - px * d), y - (my - py * d)) <= R) put(g, x, y, MS);
  line(g, ax - 1, ay + 1, bx + 1, by - 1, MS2, 1);
  for (let i = 1; i <= 3; i++) {
    const t = i / 4, cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
    line(g, cx, cy, cx + 4.6, cy - .4, MS2, 1);
    line(g, cx, cy, cx + .4, cy - 4.6, MS2, 1);
  }
  line(g, bx + 1, by - 1, 4, 30, WD, 3);
  put(g, 21, 6, SPEC); put(g, 22, 6, SPEC);
});
def('magnet', g => {                                // 말굽 자석 — 강철 몸에 붉은 극 · 파란(속성색) 극
  ringf(g, 16, 15, 6, 12, ST);
  rect(g, 1, 15, 30, 31, '.');
  rect(g, 4, 15, 10, 27, ST); rect(g, 22, 15, 28, 27, ST);
  rect(g, 4, 23, 10, 27, BL);                                  // 붉은 극
  rect(g, 4, 23, 10, 24, BL2);
  rect(g, 22, 23, 28, 27, T);                                  // 반대 극
  rect(g, 22, 23, 28, 24, T5);
  rect(g, 5, 5, 8, 14, ST4);
  gloss(g, 11, 4, 3, 1);
});
def('vigor', g => {                                 // 심장 — 피의 색. 여기만큼 붉어야 할 곳도 없다
  ell(g, 10, 11, 7.4, 7, BL); ell(g, 22, 11, 7.4, 7, BL);
  poly(g, [[3,12],[29,12],[16,30]], BL);
  ell(g, 8, 9, 3.4, 3.2, BL2);
  ell(g, 20, 10, 2.4, 2.2, BL2);
  gloss(g, 6, 6, 3, 2);
});
def('swift', g => {                                 // 날개 — 뼈빛 깃에 속성색 끝
  /* 깃 넷을 촘촘히 놓으니 서로 붙어 종잇조각이 됐다. 셋으로 줄이고 사이를 벌린다 —
     비면 outline 이 그 틈에 어두운 금을 그어 깃이 갈라져 보인다. */
  const R = Math.PI / 180;
  const fs = [[22, 25, 3.6], [50, 21, 3.6], [80, 15, 3.2]];
  for (const [a, len, w] of fs) feather(g, 8, 5, a * R, len, w, BN);
  for (const [a, len, w] of fs) {                              // 깃 뿌리에 그늘, 끝에 색
    const ux = Math.cos(a * R), uy = Math.sin(a * R);
    for (let t = .04; t <= .34; t += .03) {
      const half = w * Math.pow(1 - t, .62) * .6;
      for (let k = -half; k <= half; k += .34)
        put(g, 8 + ux * len * t - uy * k, 5 + uy * len * t + ux * k, BN0);
    }
    for (let t = .72; t <= 1; t += .03) {
      const half = w * Math.pow(1 - t, .62);
      for (let k = -half; k <= half; k += .34)
        put(g, 8 + ux * len * t - uy * k, 5 + uy * len * t + ux * k, T5);
    }
  }
  line(g, 3, 2, 13, 7, BN, 3);                                 // 어깨
  line(g, 3, 2, 12, 6, BN3, 1);
  line(g, 4, 4, 13, 9, BN0, 1);
  gloss(g, 4, 2, 2, 1);
});
def('avarice', g => {                               // 돈주머니 — 가죽에 금화
  ell(g, 16, 21, 11, 9.5, WD);
  poly(g, [[9,12],[23,12],[19,16],[13,16]], WD);
  rect(g, 13, 9, 19, 12, WD0);
  ell(g, 12.5, 6, 3.6, 3.4, WD); ell(g, 19.5, 6, 3.6, 3.4, WD);
  rect(g, 12, 9, 20, 10, GD);                                  // 끈
  for (let i = 0; i < 3; i++) line(g, 12 + i * 4, 17, 12 + i * 4, 29, WD0, 1);
  ell(g, 13, 20, 3.6, 3.4, GD);                                // 비쳐 보이는 금화
  ell(g, 13, 20, 1.6, 1.4, GD3);
  ell(g, 27, 28, 3, 2.4, GD); ell(g, 27, 28, 1.4, 1, GD3);     // 굴러나온 동전
  gloss(g, 10, 16, 2, 2);
});
def('zeal', g => {                                  // 종 — 금. 굽은 선이라야 종이다
  for (let y = 5; y <= 23; y++) {
    const w = 4.2 + 9.4 * Math.pow((y - 5) / 18, 1.7);
    rect(g, 16 - w, y, 15 + w, y, GD);
  }
  rect(g, 3, 23, 28, 26, GD);
  ringf(g, 16, 3, 1.6, 3.2, ST);                               // 매다는 고리
  rect(g, 14, 26, 17, 29, ST); ell(g, 15.5, 30, 2.4, 2, ST);   // 추
  rect(g, 3, 23, 28, 23, GD3);
  rect(g, 11, 8, 12, 21, GD3);
  gloss(g, 11, 8, 1, 3);
});
def('rebirth', g => {                               // 되살아남 — 한 바퀴 돌아 제자리로 오는 화살
  ringf(g, 16, 17, 8.5, 12, T);
  rect(g, 16, 2, 31, 17, '.');
  poly(g, [[15,2],[27,9],[15,16]], T);
  ringf(g, 16, 17, 10, 10.8, T6);                              // 고리 위의 빛
  ell(g, 16, 17, 4.4, 4.4, GD);                                // 안쪽 불씨
  ell(g, 15, 16, 2.2, 2.2, SPEC);
  gloss(g, 5, 12, 2, 2);
});
def('sand', g => {                                  // 모래시계 — 나무틀 · 금빛 모래 · 속성색 유리
  rect(g, 4, 2, 27, 5, WD); rect(g, 4, 26, 27, 29, WD);
  rect(g, 4, 2, 27, 3, WD3); rect(g, 4, 26, 27, 27, WD2);
  poly(g, [[7,6],[24,6],[17,15],[17,17],[24,25],[7,25],[14,17],[14,15]], T2);
  poly(g, [[9,8],[22,8],[16,15]], GD);                         // 위 칸의 모래
  poly(g, [[10,24],[21,24],[16,19]], GD);                      // 아래 쌓인 모래
  rect(g, 15, 15, 16, 24, GD3);                                // 떨어지는 줄기
  put(g, 10, 9, T6); put(g, 11, 9, T6);
  gloss(g, 5, 3, 2, 1);
});

// ── 세계 ──────────────────────────────────────────────
def('skull', g => {                                 // 해골 — 뼈빛. 눈구멍에는 속성색 불이 든다
  ell(g, 16, 13, 12, 11, BN);
  rect(g, 6, 13, 25, 20, BN);
  poly(g, [[10,20],[21,20],[20,28],[11,28]], BN);
  ell(g, 11, 13, 4, 4.4, OUT); ell(g, 21, 13, 4, 4.4, OUT);
  ell(g, 10.5, 13, 2.2, 2.4, T);                               // 눈구멍의 불
  ell(g, 20.5, 13, 2.2, 2.4, T);
  put(g, 10, 12, T6); put(g, 20, 12, T6);
  poly(g, [[16,17],[19,22],[13,22]], OUT);
  rect(g, 11, 24, 20, 25, BN0);
  for (let i = 0; i < 4; i++) rect(g, 12 + i * 3, 23, 12 + i * 3, 28, BN0);
  line(g, 16, 2, 16, 8, BN0, 1);
  line(g, 16, 6, 10, 9, BN0, 1); line(g, 16, 6, 22, 9, BN0, 1);
  gloss(g, 9, 5, 4, 2);
});
def('wolf', g => {                                  // 짐승 머리 — 잿빛 털 · 뼈 송곳니 · 붉은 눈
  poly(g, [[4,14],[7,1],[13,9]], ST); poly(g, [[28,14],[25,1],[19,9]], ST);
  poly(g, [[6,12],[8,4],[12,10]], BL0);                        // 귀 안쪽
  poly(g, [[26,12],[24,4],[20,10]], BL0);
  ell(g, 16, 16, 11, 10, ST);
  poly(g, [[11,22],[21,22],[19,29],[13,29]], ST);
  ell(g, 11, 14, 3, 2.4, OUT); ell(g, 21, 14, 3, 2.4, OUT);
  ell(g, 11, 14, 1.6, 1.4, BL2); ell(g, 21, 14, 1.6, 1.4, BL2);
  ell(g, 16, 24, 2.2, 1.6, OUT);
  rect(g, 13, 27, 14, 29, BN3); rect(g, 18, 27, 19, 29, BN3);   // 송곳니
  for (let i = 0; i < 3; i++) line(g, 6 + i * 2, 10 + i, 9 + i * 2, 6 + i, ST0, 1);
  gloss(g, 8, 8, 2, 2);
});
def('shrine', g => {                                // 제단 — 돌기둥 · 금 처마 · 속성색 불
  poly(g, [[16,1],[30,9],[2,9]], BN);
  rect(g, 2, 9, 29, 10, GD);                                   // 금 처마
  rect(g, 2, 10, 29, 12, BN);
  for (const x of [5, 13, 21]) {
    rect(g, x, 12, x + 5, 25, BN);
    rect(g, x, 12, x + 1, 25, BN3);
    rect(g, x + 3, 12, x + 3, 25, BN0);
    rect(g, x - 1, 12, x + 6, 13, BN0);
  }
  rect(g, 1, 25, 30, 27, BN); rect(g, 0, 27, 31, 29, BN);
  rect(g, 1, 25, 30, 25, BN3);
  ell(g, 16, 5, 2.4, 2, T5);                                   // 박공의 불
  gloss(g, 12, 6, 2, 1);
});
def('bomb', g => {                                  // 폭탄 — 검은 무쇠 · 금 주둥이 · 심지 불똥
  ell(g, 14, 20, 10.5, 10.5, ST0);
  ell(g, 17, 23, 6, 6, 'a');
  ell(g, 10, 16, 4, 3.4, ST);
  ell(g, 9, 15, 2, 1.6, ST4);
  rect(g, 11, 6, 17, 10, GD);                                  // 주둥이
  rect(g, 11, 6, 12, 10, GD3);
  line(g, 17, 7, 24, 2, WD, 2);                                // 심지
  ell(g, 25, 2, 3, 3, T5); ell(g, 25, 2, 1.6, 1.6, SPEC);
  gloss(g, 8, 13, 2, 2);
});
def('flask', g => {                                 // 물약 — 유리는 속성색 · 코르크는 나무 · 목테는 금
  rect(g, 12, 1, 19, 5, WD); rect(g, 12, 1, 13, 5, WD3);
  rect(g, 13, 5, 18, 11, T2);
  rect(g, 11, 10, 20, 12, GD);
  ell(g, 16, 21, 11, 10, T2);
  ell(g, 16, 23, 9.4, 7.6, T);                                 // 담긴 액
  rect(g, 7, 17, 25, 17, T6);                                  // 액면
  ell(g, 12, 24, 1.8, 1.8, T6); ell(g, 19, 26, 1.4, 1.4, T6);  // 거품
  ell(g, 11, 16, 2.4, 3.4, T7);                                // 유리의 빛
  gloss(g, 10, 14, 2, 3);
});
def('sigil', g => {                                 // 인장 — 금 고리에 속성색 룬
  ringf(g, 16, 16, 11.5, 14, GD);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const x = 16 + Math.cos(a) * 12.8, y = 16 + Math.sin(a) * 12.8;
    put(g, x, y, i % 2 ? T6 : GD0);
  }
  ringf(g, 16, 16, 6.4, 7.6, GD);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 - Math.PI / 2;
    line(g, 16, 16, 16 + Math.cos(a) * 6.4, 16 + Math.sin(a) * 6.4, T, 1);
  }
  ell(g, 16, 16, 2.6, 2.6, T6);
  put(g, 16, 16, SPEC);
  gloss(g, 10, 6, 3, 1);
});
def('alert', g => {                                 // 경고 — 붉은 느낌표
  poly(g, [[10,2],[22,2],[19,21],[13,21]], BL);
  rect(g, 12, 25, 20, 31, BL);
  line(g, 11, 3, 13, 20, BL2, 1);
  gloss(g, 12, 3, 3, 1);
});

// ── 출력 ──────────────────────────────────────────────
const order = ['orb','stance','weapon','element','skill','gem','dagger','aura','whip','bolt','tome',
               'flame','scythe','power','clock','ring','boot','shield','leaf','magnet','skull','sigil',
               'flask','alert','shrine','wolf','bomb','sand','vigor','edge','swift','avarice','zeal','rebirth'];
const missing = order.filter(k => !G[k]);
if (missing.length) { console.error('빠진 글리프:', missing.join(', ')); process.exit(1); }
const used = new Set();
for (const k of order) for (const row of G[k]) for (const ch of row) if (ch !== '.') used.add(ch);
const known = new Set([...RAMPS.join(''), OUT, SPEC]);
const bad = [...used].filter(c => !known.has(c));
if (bad.length) { console.error('모르는 재질 문자:', bad.join(' ')); process.exit(1); }
console.error('쓰인 색 ' + used.size + '가지');
const lines = order.map(k => {
  const body = G[k].map(r => '"' + r.join('') + '"').join(',\n' + ' '.repeat(k.length + 5));
  return '  ' + k + ': [' + body + '],';
});
console.log('const MENU_ICONS_HI = {\n' + lines.join('\n') + '\n};');

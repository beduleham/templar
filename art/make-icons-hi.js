/* 메뉴 글리프를 32칸 · 7단계로 다시 만든다.

   왜 또 만드는가: 16칸 5단계로 올린 뒤에도 레벨업 카드에서는 한 변이 64px 인데
   칸이 16개뿐이라 한 칸이 4px 이다. 그 굵기로는 검의 코등이도, 해골의 이빨도,
   물약의 코르크도 들어갈 자리가 없다 — 실루엣만 남고 속이 빈다.

   왜 16칸짜리를 버리지 않는가: 픽셀 그림은 줄일 수가 없다. 글자 옆에 들어가는
   아이콘은 화면에서 16~24px 이라, 32칸을 쓰면 한 칸이 1px 이 되어 픽셀 재질이
   사라진다. 그래서 두 벌을 두고 그리는 크기에 따라 고른다
   (drawMenuIcon 이 cell >= 4 일 때만 이쪽을 쓴다 — 화면 크기는 그대로다).

   단계를 5에서 7로 늘린 이유: 32칸이면 면이 넓어져서, 밝은 면과 어두운 면 사이에
   중간이 없으면 종이를 오려 붙인 것처럼 보인다.
   '.' 빈칸 · 0 윤곽 · 1 깊은그늘 · 2 그늘 · 3 몸통 · 4 빛 · 5 밝은빛 · 6 광

   실행: node art/make-icons-hi.js   → 화면에 붙여 넣을 MENU_ICONS_HI 를 뱉는다 */
const S = 32;

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
/* 큰 원에서 작은 원을 뺀 초승달. 16칸 때 낫을 세 번 틀리고 나서 얻은 것 —
   초승달은 선이 아니라 면이다. */
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

const solid = (g, x, y) => { const v = g[y] && g[y][x]; return !!v && v !== '.' && v !== '0'; };

const outline = (g) => {
  const add = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (g[y][x] !== '.') continue;
    if ([[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => solid(g, x + dx, y + dy))) add.push([x, y]);
  }
  for (const [x, y] of add) g[y][x] = '0';
};

/* 빛은 왼쪽 위에서 온다 — 스프라이트·지형·이펙트와 같은 방향.

   16칸 때는 '열린 이웃 수'로 밝기를 정했다. 32칸에서는 그 방식이 테두리 한 줄만
   밝히고 안쪽을 통째로 평평하게 남긴다. 여기서는 대신 '그 방향으로 몸이 몇 칸
   남았는가'를 재서 표면에서 안쪽으로 단계를 만든다. */
const shade = (g) => {
  const ray = (x, y, dx, dy) => { let n = 0; while (n < 7 && solid(g, x + dx * (n + 1), y + dy * (n + 1))) n++; return n; };
  const out = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (g[y][x] !== '3') continue;
    const lit = Math.min(ray(x, y, -1, 0), ray(x, y, 0, -1));
    const dark = Math.min(ray(x, y, 1, 0), ray(x, y, 0, 1));
    const t = lit + dark;
    if (t <= 1) continue;                       // 얇은 곳은 몸통 그대로 — 다 밝히면 형태가 날아간다
    if (lit === 0) out.push([x, y, '5']);
    else if (dark === 0) out.push([x, y, '1']);
    else if (lit === 1 && t >= 3) out.push([x, y, '4']);
    else if (dark === 1 && t >= 3) out.push([x, y, '2']);
  }
  for (const [x, y, c] of out) g[y][x] = c;
};

const G = {};
const def = (name, fn) => { const g = mk(); fn(g); outline(g); shade(g); G[name] = g; };
const gloss = (g, x, y, w = 1, h = 1) => rect(g, x, y, x + w - 1, y + h - 1, '6');

// ── 기본 ──────────────────────────────────────────────
def('orb', g => {                                   // 마력 구슬 — 안쪽에 빛이 고인다
  ell(g, 16, 16, 13, 13, '3');
  ell(g, 19.5, 19.5, 9.5, 9.5, '2');
  ell(g, 21, 21, 6, 6, '1');
  ell(g, 12.5, 12.5, 7, 7, '4');
  ell(g, 11.5, 11.5, 3.6, 3.6, '5');
  gloss(g, 10, 9, 3, 2); gloss(g, 9, 11, 1, 1);
  /* 모서리에 흩어지는 마력 점을 찍어 봤지만, outline 이 그 한 칸에도 윤곽을 둘러
     구슬 옆의 때처럼 보였다. 떨어져 있는 한 칸짜리 장식은 이 크기에서 쓸 수 없다. */
});
def('gem', g => {                                   // 보석 — 각진 면이 보석이다
  poly(g, [[16,2],[28,12],[16,30],[4,12]], '3');
  poly(g, [[16,2],[28,12],[16,12],[4,12]], '4');    // 관 (윗면)
  poly(g, [[16,2],[16,12],[4,12]], '5');            // 왼쪽 위 면이 가장 밝다
  poly(g, [[16,12],[28,12],[16,30]], '1');          // 오른쪽 아래 면
  line(g, 4, 12, 28, 12, '2', 1);                   // 거들 (허리선)
  line(g, 16, 12, 16, 30, '2', 1);
  line(g, 9, 7, 23, 7, '5', 1);
  gloss(g, 11, 6, 3, 1);
});
def('element', g => {                               // 속성 인 — 고리 안의 사각별
  /* 고리를 두르면 안에 무엇을 넣든 조준경이 된다 — 눈금을 빼도 그랬다.
     고리를 아주 버리고, 변이 오목한 네갈래 별(반짝임) 하나로 간다.
     성역·인장도 고리라 셋이 한 덩어리로 보이던 문제까지 같이 풀린다. */
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = Math.abs(x - 15.5) / 15, dy = Math.abs(y - 15.5) / 15;
    if (Math.sqrt(dx) + Math.sqrt(dy) <= 1) put(g, x, y, '3');   // 오목한 별
  }
  ell(g, 15.5, 15.5, 4, 4, '5');
  for (const [x, y] of [[26, 6], [6, 26]]) ell(g, x, y, 1.6, 1.6, '4');   // 작은 반짝임 둘
  gloss(g, 13, 12, 2, 2);
});
def('skill', g => {                                 // 폭발하는 별 — 굵은 넷과 가는 넷
  poly(g, [[16,0],[20,14],[16,20],[12,14]], '3');
  poly(g, [[16,32],[20,18],[16,12],[12,18]], '3');
  poly(g, [[0,16],[14,20],[20,16],[14,12]], '3');
  poly(g, [[32,16],[18,20],[12,16],[18,12]], '3');
  for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]])
    line(g, 16 + dx * 4, 16 + dy * 4, 16 + dx * 11, 16 + dy * 11, '3', 3);
  ell(g, 16, 16, 6, 6, '4');
  ell(g, 15, 15, 3.2, 3.2, '5');
  gloss(g, 13, 12, 3, 2);
});
def('stance', g => {                                // 문장 방패 — 테두리 띠 · 십자 · 못
  poly(g, [[4,3],[27,3],[27,15],[16,29],[5,15]], '3');
  poly(g, [[7,6],[24,6],[24,15],[16,25],[7,15]], '2');
  poly(g, [[9,8],[22,8],[22,15],[16,23],[9,15]], '3');
  rect(g, 14, 9, 17, 22, '4'); rect(g, 11, 12, 20, 15, '4');   // 십자
  rect(g, 15, 10, 16, 21, '5'); rect(g, 12, 13, 19, 14, '5');
  for (const [x, y] of [[6,5],[25,5],[6,14],[25,14]]) put(g, x, y, '5');   // 못
  gloss(g, 10, 5, 4, 1);
});

// ── 무기 ──────────────────────────────────────────────
/* 검 한 자루를 세 번 쓴다(weapon · dagger · edge). 길이와 코등이만 달리해
   '큰 검 · 짧은 검 · 가는 검'으로 갈리게 한다. */
const sword = (g, x0, y0, x1, y1, w, guard, grip) => {
  const ux = (x1 - x0), uy = (y1 - y0), L = Math.hypot(ux, uy);
  const nx = -uy / L, ny = ux / L;                          // 날에 수직인 방향
  for (let i = 0; i <= L * 3; i++) {
    const t = i / (L * 3);
    const cx = x0 + ux * t, cy = y0 + uy * t;
    const half = w * (t > .82 ? (1 - t) / .18 : 1);         // 끝에서 뾰족해진다
    for (let k = -half; k <= half; k += .34) put(g, cx + nx * k, cy + ny * k, '3');
  }
  for (let i = 0; i <= L * 3; i++) {                        // 피홈 — 날 가운데의 그늘
    const t = i / (L * 3);
    if (t > .8) break;
    put(g, x0 + ux * t + nx * .2, y0 + uy * t + ny * .2, '2');
  }
  line(g, x0 - nx * guard, y0 - ny * guard, x0 + nx * guard, y0 + ny * guard, '3', 3);   // 코등이
  const gx = x0 - ux / L * grip, gy = y0 - uy / L * grip;
  line(g, x0, y0, gx, gy, '1', 3);                          // 손잡이
  for (let k = 1; k < grip - 1; k += 2)                     // 감은 자국
    put(g, x0 - ux / L * k, y0 - uy / L * k, '2');
  ell(g, gx, gy, 2, 2, '2');                                // 자루끝
  put(g, x1, y1, '6');
};
def('weapon', g => { sword(g, 9, 24, 27, 5, 2.6, 5.5, 6); gloss(g, 24, 6, 2, 2); });
def('dagger', g => { sword(g, 11, 22, 25, 8, 2.2, 4, 5); gloss(g, 22, 9, 2, 2); });
def('edge',   g => { sword(g, 6, 27, 28, 4, 1.7, 3.5, 4); gloss(g, 25, 5, 2, 2); });
def('whip', g => {                                  /* 쇠사슬 플레일 — 자루 · 사슬 · 가시공.
                                                       16칸 때는 감기는 채찍으로 그렸는데
                                                       그 크기에서는 그냥 덩어리로 뭉쳤다. */
  rect(g, 3, 20, 7, 29, '3');                               // 자루
  rect(g, 3, 20, 4, 29, '2');
  rect(g, 2, 26, 8, 27, '1');                               // 손잡이 띠
  const link = [[9, 19], [13, 16], [17, 13]];               // 사슬 세 마디
  for (const [x, y] of link) { ringf(g, x, y, 1.2, 2.6, '3'); }
  ell(g, 22, 10, 6.5, 6.5, '3');                            // 가시공
  ell(g, 24, 12, 3.6, 3.6, '2');
  for (let i = 0; i < 8; i++) {                             // 가시 여덟
    const a = i / 8 * Math.PI * 2;
    line(g, 22 + Math.cos(a) * 6, 10 + Math.sin(a) * 6,
            22 + Math.cos(a) * 9.5, 10 + Math.sin(a) * 9.5, '3', 2);
  }
  ell(g, 19.5, 7.5, 2.4, 2.4, '5');
  gloss(g, 18, 6, 2, 2);
});
def('scythe', g => {                                // 낫 — 초승달 날 + 자루
  /* 네 번째 판이다. 원에서 원을 빼는 방식은 날의 두께를 내 마음대로 못 준다 —
     자루 쪽이 두껍고 끝이 얇아야 낫인데, 그게 안 되니 계속 갈고리로 읽혔다.
     각도를 따라가며 두께를 직접 주는 쪽으로 바꾼다. */
  line(g, 21, 4, 26, 31, '3', 4);                           // 자루
  line(g, 23, 4, 28, 31, '1', 1);                           // 자루의 오른쪽 그늘
  line(g, 24, 20, 30, 23, '3', 3);                          // 쥐는 곳
  const C = [19, 18], R = 13;
  for (let i = 0; i <= 120; i++) {                          // 날 — 자루에 붙은 쪽이 두껍다
    const t = i / 120, a = (-82 - 96 * t) * Math.PI / 180;
    const th = 4.6 * (1 - t * .84);
    for (let k = -th; k <= th; k += .3)
      put(g, C[0] + Math.cos(a) * (R + k), C[1] + Math.sin(a) * (R + k), '3');
  }
  for (let i = 0; i <= 120; i++) {                          // 날 안쪽(선)의 빛
    const t = i / 120, a = (-82 - 96 * t) * Math.PI / 180;
    const th = 4.6 * (1 - t * .84);
    put(g, C[0] + Math.cos(a) * (R - th + .6), C[1] + Math.sin(a) * (R - th + .6), '5');
  }
  gloss(g, 5, 19, 2, 2);
});
def('bolt', g => {                                  // 번개 — 꺾인 자리마다 굵기가 바뀐다
  poly(g, [[20,1],[11,15],[16,15],[9,31],[24,12],[18,12],[24,1]], '3');
  poly(g, [[19,3],[13,14],[16,14],[12,25]], '5');           // 안쪽의 흰 심
  gloss(g, 17, 4, 2, 2);
});
def('flame', g => {                                 /* 불꽃 — 아래 3/4 가 가장 넓고 밑동이 오목하다.
                                                       (16칸 때 천막·풍선으로 두 번 틀린 형태다) */
  for (let y = 2; y <= 29; y++) {
    const t = (y - 2) / 27;
    const w = t < .78 ? 13 * Math.pow(t / .78, .55) : 13 * (1 - (t - .78) / .22 * .45);
    rect(g, 16 - w, y, 15 + w, y, '3');
  }
  for (let x = 5; x <= 26; x++) {                           // 오목한 밑동
    const d = Math.round(4.5 * Math.cos((x - 15.5) / 11 * Math.PI * .5));
    rect(g, x, 30 - d, x, 31, '.');
  }
  for (let y = 14; y <= 27; y++) {                          // 안쪽 불심
    const w = 5.4 * Math.sin((y - 12) / 16 * Math.PI);
    rect(g, 16 - w, y, 15 + w, y, '4');
  }
  for (let y = 20; y <= 27; y++) {                          // 심은 아래로 낮게 — 위로 올리면 두건이 된다
    const w = 2.2 * Math.sin((y - 18) / 10 * Math.PI);
    rect(g, 16 - w, y, 15 + w, y, '5');
  }
  gloss(g, 14, 8, 2, 4);
});
def('tome', g => {                                  // 펼친 책 — 책등 · 쪽 · 글줄
  poly(g, [[2,7],[15,4],[15,27],[2,29]], '3');
  poly(g, [[17,4],[30,7],[30,29],[17,27]], '3');
  rect(g, 15, 4, 16, 28, '1');                              // 책등
  for (let i = 0; i < 4; i++) {                             // 글줄
    rect(g, 5, 11 + i * 4, 13, 11 + i * 4, '2');
    rect(g, 19, 11 + i * 4, 27, 11 + i * 4, '2');
  }
  line(g, 2, 29, 15, 27, '1', 2); line(g, 17, 27, 30, 29, '1', 2);   // 아래 두께
  gloss(g, 4, 9, 4, 1);
});
def('aura', g => {                                  // 성역 — 겹고리와 뻗는 눈금
  ringf(g, 16, 16, 11.5, 14, '3');
  ringf(g, 16, 16, 6, 8, '3');
  ell(g, 16, 16, 2.6, 2.6, '4');
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    line(g, 16 + Math.cos(a) * 8.5, 16 + Math.sin(a) * 8.5,
            16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, '3', 1);
  }
  gloss(g, 11, 4, 3, 1);
});

// ── 능력·보조 ────────────────────────────────────────
def('power', g => {                                 // 힘 — 갈매기 둘, 가운데가 두껍다
  /* 안쪽에 밝은 선을 그었더니 갈매기가 두 겹으로 갈라져 끊겨 보였다.
     이 크기에서는 면을 두껍게 두고 음영은 shade 에 맡기는 편이 낫다. */
  for (const y of [3, 17]) poly(g, [[2, y + 11], [16, y], [30, y + 11], [30, y + 4], [16, y + 5], [2, y + 4]], '3');
});
def('clock', g => {                                 // 시계 — 테 · 눈금 · 바늘 둘
  ringf(g, 16, 16, 11.5, 14.5, '3');
  ell(g, 16, 16, 11.5, 11.5, '2');
  ell(g, 15, 15, 8, 8, '3');
  for (let i = 0; i < 12; i++) {                            // 눈금 열둘
    const a = i / 12 * Math.PI * 2;
    const t = i % 3 === 0 ? 2 : 1;
    line(g, 16 + Math.cos(a) * 9.4, 16 + Math.sin(a) * 9.4,
            16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, '1', t);
  }
  line(g, 16, 16, 16, 8.5, '1', 2);                         // 긴 바늘
  line(g, 16, 16, 22, 18, '1', 2);                          // 짧은 바늘
  ell(g, 16, 16, 1.4, 1.4, '5');
  gloss(g, 9, 6, 3, 1);
});
def('ring', g => {                                  // 반지 — 띠 위에 보석
  /* 어깨를 넓게 두었더니 알과 띠가 한 덩어리로 붙어 자물쇠가 됐다.
     둘 사이를 좁혀 목을 만들고, 띠의 구멍을 크게 뚫어야 '반지'로 읽힌다. */
  ringf(g, 16, 21, 8, 11, '3');                             // 띠
  rect(g, 13, 12, 18, 14, '3');                             // 알받이(목)
  poly(g, [[12,2],[20,2],[25,9],[16,15],[7,9]], '3');       // 알 — 윗면(테이블)이 있어야 보석이다
  poly(g, [[12,2],[16,2],[16,9],[7,9]], '5');
  poly(g, [[16,9],[25,9],[16,15]], '1');
  line(g, 7, 9, 25, 9, '2', 1);
  gloss(g, 12, 5, 3, 1);
});
def('boot', g => {                                  // 장화 — 발목이 잘록하고 앞코가 둥글다
  rect(g, 8, 2, 19, 6, '3');                                // 신목 입구
  rect(g, 10, 6, 19, 17, '3');                              // 종아리
  rect(g, 8, 17, 19, 21, '3');                              // 발목
  rect(g, 8, 21, 24, 27, '3');                              // 발
  ell(g, 24, 24, 4.4, 3.6, '3');                            // 둥근 앞코
  rect(g, 6, 27, 28, 29, '1');                              // 밑창
  rect(g, 6, 22, 8, 29, '1');                               // 뒤축
  rect(g, 8, 9, 19, 11, '2');                               // 접힌 자국
  for (let i = 0; i < 4; i++) line(g, 11, 20 - i * 3, 18, 22 - i * 3, '1', 1);   // 끈
  rect(g, 10, 6, 12, 17, '5');
  gloss(g, 9, 3, 3, 1);
});
def('shield', g => {                                // 방패 — 가운데 돌기와 못
  poly(g, [[3,3],[28,3],[28,15],[16,29],[4,15]], '3');
  poly(g, [[6,6],[25,6],[25,15],[16,25],[6,15]], '2');
  ell(g, 15.5, 14, 5.5, 5.5, '3');                          // 방패 배꼽
  ell(g, 14, 12.5, 2.6, 2.6, '5');
  for (let i = 0; i < 6; i++) {                             // 못 여섯
    const a = i / 6 * Math.PI * 2;
    put(g, 15.5 + Math.cos(a) * 8.6, 14 + Math.sin(a) * 8.6, '4');
  }
  gloss(g, 8, 5, 4, 1);
});
def('leaf', g => {                                  // 잎 — 기운 아몬드에 잎맥
  /* 축을 따라 두께를 더하는 방식으로 그렸더니 잎이 주먹만 해지고 줄기가 길어져
     횃불이 됐다. 잎은 '원 두 개가 겹친 자리(베시카)' 다 — 그러면 양 끝이 저절로
     뾰족해지고 가운데가 정확히 부른다. */
  const ax = 26, ay = 4, bx = 8, by = 24;                   // 잎의 축
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const L = Math.hypot(ax - mx, ay - my);
  const px = -(by - ay) / (L * 2), py = (bx - ax) / (L * 2);
  const half = 7.2, R = (L * L + half * half) / (2 * half), d = R - half;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
    if (Math.hypot(x - (mx + px * d), y - (my + py * d)) <= R &&
        Math.hypot(x - (mx - px * d), y - (my - py * d)) <= R) put(g, x, y, '3');
  line(g, ax - 1, ay + 1, bx + 1, by - 1, '2', 1);          // 주맥
  for (let i = 1; i <= 3; i++) {                            /* 곁맥 — 셋이면 잎, 다섯이면 깃털이다.
                                                               끝이 잎끝을 향해 누워야 한다. */
    const t = i / 4, cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
    line(g, cx, cy, cx + 4.6, cy - .4, '2', 1);
    line(g, cx, cy, cx + .4, cy - 4.6, '2', 1);
  }
  line(g, bx + 1, by - 1, 4, 30, '1', 3);                   // 줄기 — 짧게
  gloss(g, 20, 6, 2, 2);
});
def('magnet', g => {                                // 말굽 자석 — 양극이 다른 색이다
  ringf(g, 16, 15, 6, 12, '3');
  rect(g, 1, 15, 30, 31, '.');                              // 아래를 잘라 U 자로
  rect(g, 4, 15, 10, 27, '3'); rect(g, 22, 15, 28, 27, '3');
  rect(g, 4, 24, 10, 27, '5');                              // 왼쪽 극
  rect(g, 22, 24, 28, 27, '1');                             // 오른쪽 극
  rect(g, 5, 5, 8, 14, '4');
  gloss(g, 11, 4, 3, 1);
});
def('vigor', g => {                                 // 심장
  ell(g, 10, 11, 7.4, 7, '3'); ell(g, 22, 11, 7.4, 7, '3');
  poly(g, [[3,12],[29,12],[16,30]], '3');
  ell(g, 8, 9, 3.2, 3, '5');
  gloss(g, 6, 6, 3, 2);
});
def('swift', g => {                                 // 날개 — 깃 다섯이 확실히 갈라진다
  /* 두 번 틀렸다. 깃을 나란히 세우면 갈퀴가 되고, 면을 만들어 뒷전을 파내면
     물고기가 된다. 날개는 한 점에서 부채처럼 벌어지는 깃의 모음이다 —
     길이를 서로 다르게 두어야 '접힌 날개'로 읽힌다. */
  const R = Math.PI / 180;
  feather(g, 7, 6, 26 * R, 24, 3.2, '3');
  feather(g, 7, 6, 48 * R, 21, 3.4, '3');
  feather(g, 7, 6, 70 * R, 17, 3.2, '3');
  feather(g, 7, 6, 92 * R, 12, 2.8, '3');
  line(g, 3, 2, 12, 7, '3', 3);                             // 어깨
  line(g, 4, 3, 11, 7, '5', 1);
  gloss(g, 4, 2, 2, 1);
});
def('avarice', g => {                               // 돈주머니 — 주름과 흘러나온 동전
  /* 목을 곧게 세웠더니 항아리가 됐다. 주머니는 묶인 자리가 잘록하고
     그 위가 다시 벌어져야 한다 — 잘록한 곳이 없으면 그릇이다. */
  ell(g, 16, 21, 11, 9.5, '3');                             // 몸
  poly(g, [[9,12],[23,12],[19,16],[13,16]], '3');           // 어깨
  rect(g, 13, 9, 19, 12, '1');                              // 잘록한 목
  ell(g, 12.5, 6, 3.6, 3.4, '3'); ell(g, 19.5, 6, 3.6, 3.4, '3');   // 묶고 남은 천 — 두 갈래로 삐죽
  rect(g, 12, 9, 20, 10, '2');                              // 끈
  for (let i = 0; i < 3; i++) line(g, 12 + i * 4, 17, 12 + i * 4, 29, '2', 1);   // 주름
  ell(g, 12, 18, 3.4, 3, '5');
  ell(g, 27, 28, 3, 2.4, '4'); ell(g, 27, 28, 1.4, 1, '2'); // 굴러나온 동전
  gloss(g, 10, 16, 2, 2);
});
def('zeal', g => {                                  // 종 — 어깨 · 아가리 · 추
  /* 사다리꼴로 그었더니 종이 아니라 등잔이 됐다. 종은 어깨가 좁고 아래로
     오목하게 벌어진다 — 직선이 아니라 굽은 선이다. */
  for (let y = 5; y <= 23; y++) {
    const w = 4.2 + 9.4 * Math.pow((y - 5) / 18, 1.7);
    rect(g, 16 - w, y, 15 + w, y, '3');
  }
  rect(g, 3, 23, 28, 26, '3');                              // 아가리 띠
  ringf(g, 16, 3, 1.6, 3.2, '3');                           // 매다는 고리
  rect(g, 14, 26, 17, 29, '3'); ell(g, 15.5, 30, 2.4, 2, '3');   // 추
  rect(g, 3, 23, 28, 23, '5');
  gloss(g, 11, 8, 2, 3);
});
def('rebirth', g => {                               // 되살아남 — 솟는 날개 한 쌍과 불씨
  /* 불사조로 그려 봤지만 날개 둘에 몸통 하나면 이 크기에서는 잔(盞)으로 읽힌다.
     '되살아남'은 형상보다 운동이다 — 한 바퀴 돌아 제자리로 오는 화살로 바꾼다. */
  ringf(g, 16, 17, 8.5, 12, '3');
  rect(g, 16, 2, 31, 17, '.');                              // 오른쪽 위를 터서 고리를 연다
  poly(g, [[15,2],[27,9],[15,16]], '3');                    // 화살촉
  ell(g, 16, 17, 3.4, 3.4, '4');                            // 안쪽 불씨
  ell(g, 15, 16, 1.6, 1.6, '6');
  gloss(g, 5, 12, 2, 2);
});
def('sand', g => {                                  // 모래시계 — 나무틀 · 유리 · 떨어지는 모래
  rect(g, 4, 2, 27, 5, '3'); rect(g, 4, 26, 27, 29, '3');
  rect(g, 4, 2, 27, 3, '5'); rect(g, 4, 26, 27, 27, '4');
  poly(g, [[7,6],[24,6],[17,15],[17,17],[24,25],[7,25],[14,17],[14,15]], '3');
  poly(g, [[9,8],[22,8],[16,15]], '2');                     // 위 칸의 모래
  poly(g, [[10,24],[21,24],[16,19]], '2');                  // 아래 쌓인 모래
  rect(g, 15, 15, 16, 24, '2');                             // 떨어지는 줄기
  rect(g, 5, 4, 8, 4, '6');
  gloss(g, 9, 7, 2, 1);
});

// ── 세계 ──────────────────────────────────────────────
def('skull', g => {                                 // 해골 — 눈구멍 · 코 · 이 · 봉합선
  ell(g, 16, 13, 12, 11, '3');
  rect(g, 6, 13, 25, 20, '3');
  poly(g, [[10,20],[21,20],[20,28],[11,28]], '3');          // 아래턱
  ell(g, 11, 13, 4, 4.4, '0'); ell(g, 21, 13, 4, 4.4, '0'); // 눈구멍
  ell(g, 10, 12, 1.6, 1.6, '1'); ell(g, 20, 12, 1.6, 1.6, '1');
  poly(g, [[16,17],[19,22],[13,22]], '0');                  // 코
  rect(g, 11, 24, 20, 25, '0');                             // 이 사이
  for (let i = 0; i < 4; i++) rect(g, 12 + i * 3, 23, 12 + i * 3, 28, '0');
  line(g, 16, 2, 16, 8, '2', 1);                            // 봉합선
  line(g, 16, 6, 10, 9, '2', 1); line(g, 16, 6, 22, 9, '2', 1);
  gloss(g, 9, 5, 4, 2);
});
def('wolf', g => {                                  // 짐승 머리 — 귀 · 눈 · 주둥이 · 송곳니
  poly(g, [[4,14],[7,1],[13,9]], '3'); poly(g, [[28,14],[25,1],[19,9]], '3');
  ell(g, 16, 16, 11, 10, '3');
  poly(g, [[11,22],[21,22],[19,29],[13,29]], '3');          // 주둥이
  ell(g, 11, 14, 3, 2.4, '0'); ell(g, 21, 14, 3, 2.4, '0'); // 눈
  put(g, 10, 13, '5'); put(g, 20, 13, '5');
  ell(g, 16, 24, 2.2, 1.6, '0');                            // 코
  rect(g, 13, 27, 14, 29, '5'); rect(g, 18, 27, 19, 29, '5');   // 송곳니
  for (let i = 0; i < 3; i++) line(g, 6 + i * 2, 10 + i, 9 + i * 2, 6 + i, '2', 1);   // 털
  gloss(g, 8, 8, 2, 2);
});
def('shrine', g => {                                // 제단 — 박공 · 홈 판 기둥 · 계단
  poly(g, [[16,1],[30,9],[2,9]], '3');                      // 박공
  rect(g, 2, 9, 29, 12, '3');
  for (const x of [5, 13, 21]) {                            // 기둥 셋
    rect(g, x, 12, x + 5, 25, '3');
    rect(g, x, 12, x + 1, 25, '5');
    rect(g, x + 3, 12, x + 3, 25, '2');
    rect(g, x - 1, 12, x + 6, 13, '2');                     // 주두
  }
  rect(g, 1, 25, 30, 27, '3'); rect(g, 0, 27, 31, 29, '3'); // 계단
  rect(g, 1, 25, 30, 25, '5');
  gloss(g, 12, 6, 3, 1);
});
def('bomb', g => {                                  // 폭탄 — 심지와 불똥
  ell(g, 14, 20, 10.5, 10.5, '3');
  ell(g, 17, 23, 6, 6, '2');
  rect(g, 11, 6, 17, 10, '3');                              // 주둥이
  rect(g, 11, 6, 12, 10, '5');
  line(g, 17, 7, 24, 2, '2', 2);                            // 심지
  ell(g, 25, 2, 2.6, 2.6, '4'); ell(g, 25, 2, 1.2, 1.2, '6');
  ell(g, 9, 15, 3.4, 3, '5');
  gloss(g, 7, 13, 2, 2);
});
def('flask', g => {                                 // 물약 — 코르크 · 목 · 액면 · 거품
  rect(g, 12, 1, 19, 5, '3'); rect(g, 12, 1, 13, 5, '5');   // 코르크
  rect(g, 13, 5, 18, 11, '3');                              // 목
  rect(g, 11, 10, 20, 12, '3');                             // 목테
  ell(g, 16, 21, 11, 10, '3');
  ell(g, 16, 23, 9, 7.4, '2');                              // 액면 아래
  rect(g, 7, 17, 25, 17, '4');                              // 액면
  ell(g, 12, 24, 1.6, 1.6, '4'); ell(g, 19, 26, 1.2, 1.2, '4');   // 거품
  ell(g, 11, 16, 2.4, 3.4, '5');                            // 유리의 빛
  gloss(g, 10, 14, 2, 3);
});
def('sigil', g => {                                 // 인장 — 룬 고리 안의 눈
  ringf(g, 16, 16, 11.5, 14, '3');
  for (let i = 0; i < 8; i++) {                             // 룬 여덟
    const a = i / 8 * Math.PI * 2;
    const x = 16 + Math.cos(a) * 12.8, y = 16 + Math.sin(a) * 12.8;
    put(g, x, y, i % 2 ? '5' : '1');
  }
  ringf(g, 16, 16, 6.4, 7.6, '3');
  for (let i = 0; i < 6; i++) {                             // 안쪽 별
    const a = i / 6 * Math.PI * 2 - Math.PI / 2;
    line(g, 16, 16, 16 + Math.cos(a) * 6.4, 16 + Math.sin(a) * 6.4, '3', 1);
  }
  ell(g, 16, 16, 2.6, 2.6, '5');
  gloss(g, 10, 6, 3, 1);
});
def('alert', g => {                                 // 경고 — 굵은 느낌표, 아래가 가늘다
  poly(g, [[10,2],[22,2],[19,21],[13,21]], '3');
  rect(g, 12, 25, 20, 31, '3');
  gloss(g, 12, 3, 3, 1);
});

// ── 출력 ──────────────────────────────────────────────
const order = ['orb','stance','weapon','element','skill','gem','dagger','aura','whip','bolt','tome',
               'flame','scythe','power','clock','ring','boot','shield','leaf','magnet','skull','sigil',
               'flask','alert','shrine','wolf','bomb','sand','vigor','edge','swift','avarice','zeal','rebirth'];
const missing = order.filter(k => !G[k]);
if (missing.length) { console.error('빠진 글리프:', missing.join(', ')); process.exit(1); }
const lines = order.map(k => {
  const body = G[k].map(r => '"' + r.join('') + '"').join(',\n' + ' '.repeat(k.length + 5));
  return '  ' + k + ': [' + body + '],';
});
console.log('const MENU_ICONS_HI = {\n' + lines.join('\n') + '\n};');

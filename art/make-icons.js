/* 메뉴 글리프를 16칸으로 다시 만든다.

   왜: 다른 것은 전부 조밀해졌는데(주인공 64칸 · 보스 128칸 · 지형 5단계) 아이콘만
   7칸 3단계로 남아, 레벨업 카드에서는 한 칸이 화면 8px 이 됐다 —
   같은 화면의 주인공 스프라이트 픽셀보다 여덟 배 굵다. 상대적으로 '다운그레이드' 된 것이다.

   왜 아틀라스에 안 넣는가: 아이콘은 호출할 때마다 색이 다르다(속성색·직업색·강조색).
   구운 그림은 색을 갈아입지 못한다. 그래서 색이 아니라 '단계'를 적는 격자로 남긴다 —
   다만 단계를 3에서 5로 늘리고 칸을 7에서 16으로 올린다.

   왜 손으로 안 적는가: 7칸도 일곱 개가 다른 것으로 읽혔다(촛불·P·젤리·짐승·깃발).
   16칸을 34개 손으로 타이핑하면 더 틀린다. 스프라이트와 같은 원시함수로 그린다.

   실행: node art/make-icons.js   → 화면에 붙여 넣을 MENU_ICONS 를 뱉는다 */
const S = 16;
const T = { E: '.', O: '0', D: '1', B: '2', L: '3', H: '4' };   // 빈칸·윤곽·그늘·몸통·빛·광

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
const line = (g, x0, y0, x1, y1, c, t = 1) => {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) * 3 + 1;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    for (let oy = 0; oy < t; oy++) for (let ox = 0; ox < t; ox++)
      put(g, x + ox - (t - 1) / 2, y + oy - (t - 1) / 2, c);
  }
};
/* 윤곽 — 몸에 붙은 바깥 칸을 0 으로. 스프라이트와 같은 규칙이라
   작은 판에서도 배경과 확실히 갈라진다. */
const outline = (g) => {
  const add = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (g[y][x] !== '.') continue;
    const near = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => {
      const v = g[y + dy] && g[y + dy][x + dx];
      return v && v !== '.' && v !== '0';
    });
    if (near) add.push([x, y]);
  }
  for (const [x, y] of add) g[y][x] = '0';
};
/* 빛은 왼쪽 위에서 온다 — 스프라이트·지형·이펙트와 같은 방향.
   몸통(2) 중 위·왼쪽이 열린 칸을 밝게, 아래·오른쪽이 열린 칸을 어둡게. */
const shade = (g) => {
  const open = (x, y) => { const v = g[y] && g[y][x]; return !v || v === '.' || v === '0' ? 1 : 0; };
  const out = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (g[y][x] !== '2') continue;
    const lit = open(x - 1, y - 1) + open(x, y - 1) + open(x - 1, y);
    const dark = open(x + 1, y + 1) + open(x, y + 1) + open(x + 1, y);
    if (lit >= 2 && dark === 0) out.push([x, y, '3']);
    else if (dark >= 2 && lit === 0) out.push([x, y, '1']);
  }
  for (const [x, y, c] of out) g[y][x] = c;
};

const G = {};
const def = (name, fn) => { const g = mk(); fn(g); outline(g); shade(g); G[name] = g; };
/* 광점 하나. 윤곽·음영 뒤에 찍어야 안 지워진다. */
const gloss = (g, x, y, w = 1, h = 1) => rect(g, x, y, x + w - 1, y + h - 1, '4');

// ── 기본 ──────────────────────────────────────────────
def('orb', g => { ell(g, 8, 8, 6, 6, '2'); });
def('gem', g => {                                   // 마름모 보석 — 각진 면이 보석이다
  for (let i = 0; i < 8; i++) { const w = i < 4 ? i + 1 : 8 - i; rect(g, 8 - w, 4 + i, 7 + w, 4 + i, '2'); }
  rect(g, 7, 5, 8, 11, '3');
});
def('element', g => { ell(g, 8, 8, 5, 5, '2'); ell(g, 8, 8, 2.4, 2.4, '3'); });
def('skill', g => {                                 // 사방으로 뻗는 별 — 네 갈래가 굵고 넷은 가늘다
  rect(g, 6, 1, 9, 14, '2'); rect(g, 1, 6, 14, 9, '2');
  for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]])
    line(g, 8 + dx * 2, 8 + dy * 2, 8 + dx * 6, 8 + dy * 6, '2', 2);
  ell(g, 8, 8, 3, 3, '3');
});
def('stance', g => {                                // 문장 방패
  rect(g, 3, 2, 12, 8, '2');
  for (let i = 0; i < 6; i++) rect(g, 3 + i, 9 + i, 12 - i, 9 + i, '2');
  rect(g, 7, 4, 8, 12, '3'); rect(g, 5, 6, 10, 7, '3');
});

// ── 무기 ──────────────────────────────────────────────
def('weapon', g => {                                // 검 — 눕혀야 검이다(세우면 촛불)
  line(g, 3, 12, 12, 3, '2', 3);                    // 날
  line(g, 4, 12, 12, 4, '3', 1);                    // 날의 빛
  line(g, 1, 11, 5, 15, '2', 2);                    // 코등이
  rect(g, 1, 13, 3, 15, '1');                       // 손잡이
  put(g, 13, 2, '4'); put(g, 12, 2, '4');
});
def('dagger', g => {                                // 단검 — 짧고 날이 두껍다
  line(g, 5, 11, 12, 4, '2', 3);
  line(g, 6, 11, 12, 5, '3', 1);
  line(g, 3, 10, 6, 13, '2', 2);
  rect(g, 2, 12, 4, 14, '1');
});
def('edge', g => {                                  // 날 — 검보다 가늘고 길다
  line(g, 2, 13, 13, 2, '2', 2);
  line(g, 3, 13, 13, 3, '3', 1);
  rect(g, 1, 12, 3, 14, '1');
});
def('whip', g => {                                  /* 채찍 — 지그재그는 번개다.
                                                       한 방향으로 감기며 가늘어져야 채찍이다. */
  rect(g, 1, 11, 4, 15, '1');                                // 손잡이
  let px = 4, py = 12, th = 3;
  const pts = [[8, 13], [12, 10], [12, 5], [8, 3], [5, 5], [4, 8]];
  for (const [x, y] of pts) { line(g, px, py, x, y, '2', th); px = x; py = y; th = Math.max(1, th - .4); }
  put(g, 4, 8, '3'); put(g, 3, 9, '3');
});
def('scythe', g => {                                /* 낫. 세 번 틀렸다 —
                                                       타원을 빼면 형태가 무너지고,
                                                       자루를 호 한가운데 두면 곡괭이가 되고,
                                                       날을 선으로 그으면 7 자가 된다.
                                                       초승달은 '면'이다 — 큰 원에서 작은 원을 뺀다. */
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dA = Math.hypot(x - 8.5, y - 8) / 7.6;             // 바깥 원
    const dB = Math.hypot(x - 11.4, y - 10.2) / 6.2;         // 안쪽으로 파낼 원
    if (dA <= 1 && dB > 1) put(g, x, y, '2');
  }
  rect(g, 9, 12, 15, 15, '.');                               // 아래 오른쪽은 자루 자리로 비운다
  line(g, 9, 8, 12, 15, '1', 3);                             // 자루
  line(g, 9, 8, 11, 13, '2', 1);
  put(g, 3, 4, '3'); put(g, 4, 3, '3');                      // 날 끝의 빛
});
def('bomb', g => {                                  // 폭탄 — 둥근 몸에 심지
  ell(g, 7, 10, 5, 5, '2');
  line(g, 10, 5, 13, 2, '1', 2); put(g, 13, 1, '4'); put(g, 14, 2, '4');
  rect(g, 9, 4, 11, 5, '1');
});

// ── 속성 ──────────────────────────────────────────────
def('flame', g => {                                 /* 불꽃. 두 번 틀렸다 —
                                                       아래로 넓어지는 삼각형은 천막이고,
                                                       가운데가 제일 넓으면 풍선이다.
                                                       불은 아래쪽 3/4 지점이 가장 넓고,
                                                       밑동이 오목하게 파여야 한다. */
  for (let y = 1; y <= 14; y++) {
    const t = (y - 1) / 13;
    const w = Math.round(t < .78 ? 6.6 * Math.pow(t / .78, .55)      // 위는 뾰족, 아래로 벌어짐
                                 : 6.6 * (1 - (t - .78) / .22 * .45));
    rect(g, 8 - w, y, 7 + w, y, '2');
  }
  for (let x = 3; x <= 12; x++) {                            // 오목한 밑동 — 불이 '떠 있다'
    const d = Math.round(2.2 * Math.cos((x - 7.5) / 5 * Math.PI * .5));
    rect(g, x, 15 - d, x, 15, '.');
  }
  for (let y = 8; y <= 13; y++) {                            // 안쪽 심지
    const w = Math.round(2.8 * Math.sin((y - 7) / 7 * Math.PI));
    rect(g, 8 - w, y, 7 + w, y, '3');
  }
  gloss(g, 7, 4, 1, 3);
});
def('bolt', g => {                                  // 번개 — 꺾여야 번개다
  const pts = [[10,1],[5,7],[8,7],[4,15],[11,6],[8,6]];
  for (let i = 0; i < 5; i++) line(g, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1], '2', 3);
  line(g, 9, 3, 6, 7, '3', 1); line(g, 7, 9, 5, 13, '3', 1);
});
def('leaf', g => {                                  /* 잎 — 폭이 한쪽으로 몰리면 총이 된다.
                                                       기운 아몬드는 양 끝이 뾰족하고 가운데가 부른다. */
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const w = 3.4 * Math.sin(t * Math.PI);
    const cx = 12 - t * 7, cy = 2 + t * 8;
    for (let k = -3; k <= 3; k++) {                          // 잎맥에 수직인 방향으로 두께
      if (Math.abs(k) > w) continue;
      put(g, cx + k * .72, cy + k * .72, '2');
    }
  }
  line(g, 12, 2, 5, 10, '3', 1);                             // 잎맥
  line(g, 5, 10, 2, 15, '1', 2);                             // 줄기
});
def('sand', g => {                                  // 모래시계
  rect(g, 3, 1, 12, 2, '2'); rect(g, 3, 13, 12, 14, '2');
  for (let i = 0; i < 5; i++) { rect(g, 4 + i, 3 + i, 11 - i, 3 + i, '2'); rect(g, 4 + i, 12 - i, 11 - i, 12 - i, '2'); }
  rect(g, 7, 7, 8, 8, '2');
  rect(g, 5, 4, 10, 5, '3'); rect(g, 6, 10, 9, 11, '3');
});

// ── 능력·보조 ────────────────────────────────────────
def('vigor', g => {                                 // 심장 — 능력의 얼굴이라 또렷해야 한다
  ell(g, 5.5, 5.5, 3.6, 3.4, '2'); ell(g, 10.5, 5.5, 3.6, 3.4, '2');
  for (let i = 0; i < 8; i++) { const w = 7 - i; rect(g, 8 - w, 7 + i, 7 + w, 7 + i, '2'); }
  gloss(g, 4, 4, 2, 2);
});
def('power', g => {                                 // 힘 — 폭이 같은 갈매기 둘
  for (const y of [3, 9]) { line(g, 2, y + 4, 8, y, '2', 3); line(g, 8, y, 14, y + 4, '2', 3); }
});
def('swift', g => {                                 /* 날개. 두 번 틀렸다 —
                                                       선을 겹치면 쐐기 한 덩어리가 되고,
                                                       두께 2로 촘촘히 놓아도 붙는다.
                                                       깃을 굵게, 사이를 확실히 비운다. */
  line(g, 2, 2, 13, 5, '2', 2);                              // 앞모서리
  for (let i = 0; i < 4; i++) {                              // 깃 넷 — 아래로 갈수록 짧다
    const x0 = 3 + i * 3, y0 = 3 + i;
    const L = 9 - i * 1.8;
    line(g, x0, y0, x0 + L * .35, y0 + L, '2', 2);
    put(g, Math.round(x0 + L * .35), Math.round(y0 + L), '3');
  }
  line(g, 2, 2, 3, 6, '1', 2);
});
def('boot', g => {                                  /* 장화 — 세로줄에 가로줄만 붙이면 L 자다.
                                                       발목이 잘록하고 앞코가 둥글어야 장화다. */
  rect(g, 4, 1, 9, 3, '2');                                 // 신목 입구
  rect(g, 5, 3, 9, 8, '2');                                 // 종아리
  rect(g, 4, 8, 9, 10, '2');                                // 발목
  rect(g, 4, 10, 12, 13, '2');                              // 발
  ell(g, 12, 11.5, 2.2, 2, '2');                            // 둥근 앞코
  rect(g, 3, 13, 14, 14, '1');                              // 밑창
  rect(g, 3, 11, 4, 14, '1');                               // 뒤축
  rect(g, 5, 3, 6, 9, '3');
  rect(g, 4, 5, 9, 6, '1');                                 // 접힌 자국
});
def('magnet', g => {                                // 자석 — U 자에 양극
  for (let i = 0; i < 5; i++) rect(g, 2, 3 + i, 5, 3 + i, '2');
  for (let i = 0; i < 5; i++) rect(g, 10, 3 + i, 13, 3 + i, '2');
  ell(g, 7.5, 8, 5.5, 5.5, '2'); ell(g, 7.5, 8, 2.4, 2.4, '.');
  rect(g, 1, 1, 14, 6, '.');
  for (let i = 0; i < 5; i++) { rect(g, 2, 3 + i, 5, 3 + i, '2'); rect(g, 10, 3 + i, 13, 3 + i, '2'); }
  rect(g, 2, 1, 5, 3, '3'); rect(g, 10, 1, 13, 3, '1');
});
def('ring', g => { ell(g, 8, 8, 6.5, 6.5, '2'); ell(g, 8, 8, 3.6, 3.6, '.'); gloss(g, 5, 3, 2, 1); });
def('aura', g => {                                  // 겹고리
  ell(g, 8, 8, 7, 7, '2'); ell(g, 8, 8, 5, 5, '.');
  ell(g, 8, 8, 3.4, 3.4, '2');
});
def('clock', g => {
  ell(g, 8, 8, 6.5, 6.5, '2'); ell(g, 8, 8, 4.8, 4.8, '1');
  rect(g, 7, 4, 8, 8, '3'); rect(g, 8, 7, 11, 8, '3');
});
def('shield', g => {
  rect(g, 2, 2, 13, 7, '2');
  for (let i = 0; i < 7; i++) rect(g, 2 + i, 8 + i, 13 - i, 8 + i, '2');
  rect(g, 7, 4, 8, 12, '3'); rect(g, 4, 6, 11, 7, '3');
});
def('flask', g => {                                 // 물약 — 목이 좁고 몸이 넓다
  rect(g, 6, 1, 9, 5, '2'); rect(g, 5, 0, 10, 1, '1');
  ell(g, 8, 10, 5.5, 5, '2');
  ell(g, 8, 11.5, 4.4, 3.4, '3');
  gloss(g, 5, 7, 1, 2);
});
def('tome', g => {                                  // 책
  rect(g, 2, 2, 13, 13, '2');
  rect(g, 7, 2, 8, 13, '1');
  rect(g, 3, 4, 6, 5, '3'); rect(g, 3, 7, 6, 8, '3');
  rect(g, 9, 4, 12, 5, '3'); rect(g, 9, 7, 12, 8, '3');
});
def('sigil', g => {                                 // 인장 — 고리 안의 눈
  ell(g, 8, 8, 7, 7, '2'); ell(g, 8, 8, 5, 5, '.');
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    put(g, 8 + Math.cos(a) * 3, 8 + Math.sin(a) * 3, '2');
  }
  ell(g, 8, 8, 1.6, 1.6, '3');
});
def('alert', g => { rect(g, 6, 1, 9, 9, '2'); rect(g, 6, 12, 9, 15, '2'); rect(g, 6, 1, 7, 8, '3'); });

// ── 세계 ──────────────────────────────────────────────
def('skull', g => {
  ell(g, 8, 7, 6, 5.5, '2');
  rect(g, 4, 7, 11, 11, '2');
  rect(g, 6, 12, 9, 14, '2');
  rect(g, 4, 6, 6, 9, '0'); rect(g, 9, 6, 11, 9, '0');
  rect(g, 7, 10, 8, 11, '0');
  gloss(g, 5, 3, 3, 1);
});
def('wolf', g => {                                  // 짐승 머리 — 귀 둘과 주둥이
  line(g, 3, 6, 4, 1, '2', 3); line(g, 12, 6, 11, 1, '2', 3);
  ell(g, 7.5, 8, 5.5, 5, '2');
  rect(g, 6, 11, 9, 14, '2');
  rect(g, 4, 6, 6, 8, '0'); rect(g, 9, 6, 11, 8, '0');
  put(g, 7, 13, '0'); put(g, 8, 13, '0');
});
def('shrine', g => {                                // 제단 — 기둥 둘과 지붕
  rect(g, 1, 2, 14, 4, '2'); rect(g, 2, 0, 13, 1, '2');
  rect(g, 3, 5, 5, 14, '2'); rect(g, 10, 5, 12, 14, '2');
  rect(g, 1, 14, 14, 15, '2');
  rect(g, 3, 5, 3, 13, '3'); rect(g, 10, 5, 10, 13, '3');
});
def('zeal', g => {                                  // 종
  ell(g, 8, 8, 5.5, 5.5, '2'); rect(g, 2, 8, 13, 12, '2');
  rect(g, 1, 12, 14, 13, '2'); rect(g, 7, 14, 8, 15, '2');
  rect(g, 7, 2, 8, 3, '1');
  rect(g, 4, 5, 5, 11, '3');
});
def('avarice', g => {                               // 돈주머니
  ell(g, 8, 10, 6, 5.5, '2');
  rect(g, 5, 3, 10, 5, '1'); rect(g, 6, 2, 9, 3, '2');
  gloss(g, 5, 7, 2, 2);
});
def('rebirth', g => {                               // 되살아남 — 위로 솟는 날개 한 쌍
  line(g, 8, 15, 8, 5, '2', 2);
  for (let i = 0; i < 4; i++) {
    line(g, 7, 9 - i, 2 + i * .8, 5 - i * 1.3, '2', 2);
    line(g, 9, 9 - i, 14 - i * .8, 5 - i * 1.3, '2', 2);
  }
  ell(g, 8, 3, 2.4, 2.4, '3');
});
def('shrine2', g => {});                            // (자리만 — 쓰이지 않는다)
delete G.shrine2;

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
console.log('const MENU_ICONS = {\n' + lines.join('\n') + '\n};');

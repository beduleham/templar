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

    /* ---------- 픽셀 도구 ----------
       실루엣은 전부 32(보스·바닥은 64) 좌표계로 손으로 적혀 있다.
       해상도를 올리려고 그 숫자를 전부 다시 쓰는 대신, 원시함수가 배율을 먹는다.
       ell 은 확대된 크기에서 다시 래스터화하므로 '픽셀을 두 배로 늘린' 게 아니라
       실제로 더 촘촘한 곡선이 나온다 — 그게 해상도를 올리는 유일한 의미다. */
    let CURK = 1;
    const mk = S => {
      const n = Math.round(S * CURK);
      const g = Array.from({ length: n }, () => Array(n).fill('.'));
      g.k = CURK;
      return g;
    };
    const put = (g, x, y, ch) => {
      x = Math.round(x); y = Math.round(y);
      if (g[y] && x >= 0 && x < g.length) g[y][x] = ch;
    };
    const ell = (g, cx, cy, rx, ry, ch) => {
      const k = g.k; cx *= k; cy *= k; rx *= k; ry *= k;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) put(g, x, y, ch);
        }
    };
    // 좌우 대칭으로 그릴 때 x0 > x1 이 되는 호출이 많다.
    // 정렬하지 않으면 루프가 돌지 않아 한쪽이 통째로 빠진다(실제로 보스의 왼쪽 어깨와 깃이 없었다).
    const rect = (g, x0, y0, x1, y1, ch) => {
      const k = g.k;
      const ax = Math.round(Math.min(x0, x1) * k), bx = Math.round(Math.max(x0, x1) * k) + k - 1;
      const ay = Math.round(Math.min(y0, y1) * k), by = Math.round(Math.max(y0, y1) * k) + k - 1;
      for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) put(g, x, y, ch);
    };
    const line = (g, x0, y0, x1, y1, ch, t = 1) => {
      const k = g.k; x0 *= k; y0 *= k; x1 *= k; y1 *= k; t = Math.max(1, Math.round(t * k));
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
      // 판이 두 배가 되면 같은 두께가 절반으로 보인다 — 배율을 따라간다.
      // 다만 그대로 곱하면 고해상도 픽셀 아트치고 굵어서, 한 겹만 더 준다.
      t = t + (g.k > 1 ? 1 : 0);
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
      for (let y = Math.round(fromY * g.k); y < g.length; y++)
        for (let x = 0; x < g.length; x++) if (g[y][x] === 'B') g[y][x] = 'D';
    };

    /* ---------- 빛 ----------
       실루엣만으로는 형태가 납작하다. 레퍼런스와의 차이는 해상도보다 여기서 온다 —
       같은 그림도 빛이 붙으면 갑옷이 갑옷으로, 천이 천으로 읽힌다.

       왼쪽 위에서 빛이 온다고 보고, 각 픽셀에서 그 방향이 얼마나 열려 있는지로 밝기를 정한다.
       열려 있으면(=바깥이면) 빛을 받는 면이고, 반대쪽이 열려 있으면 그늘진 면이다.

       중요한 건 마지막의 양자화다. 연속 그라디언트로 두면 픽셀 아트가 아니라 에어브러시가 된다 —
       단계로 끊어야 색면이 생기고, 그래야 픽셀 아트로 읽힌다. */
    const STEPS = 3;
    const lightMap = g => {
      const S = g.length;
      const out = Array.from({ length: S }, () => new Array(S).fill(0));
      const open = (x, y) => {
        const v = g[y] && g[y][x];
        return !v || v === '.' || v === 'O' ? 1 : 0;
      };
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const v = g[y][x];
        if (v === '.' || v === 'O') continue;
        let lit = 0, dark = 0, wsum = 0;
        for (let r = 1; r <= 3; r++) {
          const w = 4 - r;
          wsum += w;
          lit += w * (open(x - r, y - r) + open(x, y - r) + open(x - r, y)) / 3;
          dark += w * (open(x + r, y + r) + open(x, y + r) + open(x + r, y)) / 3;
        }
        const f = (lit - dark) / wsum;
        out[y][x] = Math.round(Math.max(-1, Math.min(1, f)) * STEPS) / STEPS;
      }
      return out;
    };
    /* 젤 덩어리의 테두리에 한 줄 빛을 두른다. 안쪽만 밝히면 물방울이 아니라 공이 된다. */
    const ringf2 = (g, cx, cy, rx, ry) => {
      const k = g.k;
      for (let y = Math.floor((cy - ry) * k); y <= Math.ceil((cy + ry) * k); y++)
        for (let x = Math.floor((cx - rx) * k); x <= Math.ceil((cx + rx) * k); x++) {
          const dx = (x - cx * k) / (rx * k), dy = (y - cy * k) / (ry * k);
          const d = dx * dx + dy * dy;
          if (d <= 1 && d > .84 && g[y] && g[y][x] && g[y][x] !== '.') g[y][x] = dy < .2 ? 'G' : 'C';
        }
    };
    const eyes = (g, cx, cy, d, ch, w = 2) => {
      for (const s of [-1, 1])
        rect(g, cx + s * d - (w - 1), cy, cx + s * d, cy + w - 1, ch);
    };

/* ---------- 속성별 열(熱) 램프 ----------

       예전 이펙트는 색이 셋뿐이었다 — B(속성색) · G(밝은 속성색) · W(흰 심지).
       그래서 폭발이 '흰 원 안의 색 원'이었다. 불도 얼음도 같은 구조라
       속성이 다르다는 게 형태로만 전해졌다.

       진짜 폭발은 색조가 아니라 '온도'가 변한다. 심지는 희고, 그 다음이 노랗고,
       그 다음이 속성색이고, 가장자리는 식어서 어둡다. 그 순서를 여기 적어 둔다.
       (심지 → 가장자리 순. 팔레트의 여덟 단계와 금·강철·피를 섞어 쓴다.) */
    const HEAT = {
      physical: ['W', 'X', 'H', 'M', 'm', 'e'],              // 쇠끼리 부딪친 불똥
      fire:     ['W', 'Z', 'o', 'G', 'B', 'D', 'c'],         // 흰 심지 → 금빛 → 불색 → 식은 가장자리
      frost:    ['W', 'T', 'G', 'C', 'B', 'a', 'c'],
      storm:    ['W', 'Z', 'T', 'G', 'B', 'a', 'c'],         // 번개는 심지가 노랗다
      holy:     ['W', 'Z', 'o', 'G', 'B', 'C', 'a'],
      blood:    ['W', 'G', 'B', 'D', 'c', 'i', 'h'],         // 가장자리는 굳은 피
    };
    const heatOf = el => HEAT[el] || HEAT.physical;

    /* ---------- 실루엣 6종 ----------
       각 함수는 프레임 번호(0~3)를 받아 픽셀 격자를 돌려준다. */
    const SIL = {
      // 슬라임 계열 — 눌렸다 펴진다
      /* ---------- 몹 다섯 종 ----------
         전부 64칸에 직접 그린다(주인공·보스와 같은 갈래).

         예전 몹은 전부 이랬다 — 도형 하나를 def.color 로 칠하고, 아래 절반을 어둡게 하고,
         밝은 점 하나를 찍는다. 확대해 보면 색종이다. 슬라임은 초록 달걀이었고
         박쥐는 보라색 콧수염이었다.

         지금 규칙 셋:
           ① 재질마다 세 단계 이상 (C 밝음 · B · D 그늘 · c 깊은 그늘)
           ② 부위 사이에 어두운 경계를 둔다 — 없으면 다시 한 덩어리가 된다
           ③ 중립색(F·E, 뼈)을 한 군데만 쓴다. 이빨이나 발톱 하나가
              생물을 '색 덩어리'에서 '짐승'으로 바꾼다. 여러 군데 쓰면 벌레가 된다. */

      // 슬라임 계열 — 눌렸다 펴진다. 젤이라 아래로 빛이 통과한다.
      blob(f, S) {
        const g = mk(S);
        const rx = [22, 20, 22, 24][f], ry = [16, 18, 16, 14][f];
        const cx = 31, cy = 43;
        ell(g, cx, cy, rx, ry, 'B');
        ell(g, cx, cy + ry * .25, rx * .98, ry * .78, 'D');         // 아래는 그늘
        ell(g, cx, cy + ry * .45, rx * .9, ry * .58, 'a');          // 더 아래는 더 깊게
        /* 젤이라 아래로 빛이 샌다. 다만 흰색으로 넓게 두면 흰 배가 된다 — 한 번 그렇게 나왔다.
           대신 아래로 갈수록 밝아지는 단계를 겹쳐 '빛이 통과한' 것으로 만든다. */
        ell(g, cx, cy + ry * .62, rx * .78, ry * .34, 'C');
        ell(g, cx, cy + ry * .74, rx * .58, ry * .22, 'G');
        ell(g, cx, cy + ry * .82, rx * .4, ry * .14, 'T');
        ell(g, cx - rx * .3, cy - ry * .3, rx * .5, ry * .4, 'C');  // 위쪽 면
        ell(g, cx - rx * .34, cy - ry * .42, rx * .3, ry * .2, 'G');
        ringf2(g, cx, cy, rx, ry);                                  // 테두리에 도는 빛
        /* 삼킨 것들 — 젤 안에 무언가 떠 있어야 젤로 읽힌다.
           예전엔 전부 같은 어두운 점이었다. 재질을 갈라야 '삼킨 것'으로 읽힌다. */
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1 + f * .3;
          ell(g, cx + Math.cos(a) * rx * .45, cy + Math.sin(a) * ry * .3 + ry * .2,
              2.4, 1.8, 't');
        }
        /* 삼킨 뼈. 입 높이에 두면 담배를 문 것처럼 보인다 — 몸 안쪽 위로 올린다. */
        line(g, cx + rx * .24, cy + ry * .1, cx + rx * .5, cy - ry * .16, 'E', 2);
        put(g, cx + rx * .5, cy - ry * .16, 'F');
        ell(g, cx - rx * .44, cy + ry * .3, 2.6, 2.2, 'J');         // 삼킨 금화
        ell(g, cx - rx * .44, cy + ry * .3, 1.2, 1, 'o');
        ell(g, cx + rx * .08, cy + ry * .5, 2, 1.6, 'x');           // 삼킨 녹슨 조각
        // 반짝임 — 젤의 표면
        ell(g, cx - rx * .48, cy - ry * .5, 4.5, 3, 'W');
        ell(g, cx - rx * .2, cy - ry * .62, 2, 1.4, 'W');
        outline(g);
        /* eyes() 는 네모라 젤에 붙이면 선글라스가 된다. 둥글게 직접 판다. */
        for (const s2 of [-1, 1]) {
          ell(g, cx + s2 * 8, cy - ry * .26, 4, 4.6, 'O');
          ell(g, cx + s2 * 8 - 1.2, cy - ry * .34, 1.5, 1.7, 'W');
        }
        /* 입꼬리를 올리면 웃는다. 죽이러 오는 것이 웃고 있으면 안 된다 — 내린다. */
        rect(g, cx - 4, cy + ry * .2, cx + 3, cy + ry * .2, 'O');   // 입
        rect(g, cx - 5, cy + ry * .2 + 1, cx - 4, cy + ry * .2 + 1, 'O');
        rect(g, cx + 3, cy + ry * .2 + 1, cx + 4, cy + ry * .2 + 1, 'O');
        return g;
      },
      // 박쥐 — 날개가 위아래로. 막에 손가락뼈가 있어야 날개로 읽힌다.
      bat(f, S) {
        const g = mk(S);
        const up = [0, -7, 0, 7][f];
        const cx = 31, cy = 33;
        for (const s2 of [-1, 1]) {                                 // 날개
          const tipx = cx + s2 * 27, tipy = 29 + up;
          const elx = cx + s2 * 15, ely = 26 + up * .6;
          /* 막을 먼저 통째로 채우고, 그 위에 앞모서리와 손가락뼈를 얹는다.
             선 몇 개로만 그리면 날개가 아니라 갈퀴가 된다. */
          for (let t = 0; t <= 1; t += .02) {
            const bx = cx + (elx - cx) * t * 2 * (t < .5 ? 1 : 0) + (t >= .5 ? (elx - cx) + (tipx - elx) * (t - .5) * 2 : 0);
            const by = cy + (ely - cy) * Math.min(1, t * 2) + (t >= .5 ? (tipy - ely) * (t - .5) * 2 : 0);
            const drop = 13 - Math.abs(t - .5) * 10;
            rect(g, bx, by, bx, by + drop, 't');   // 막은 몸보다 확실히 어둡게
            rect(g, bx, by + drop - 1, bx, by + drop, 'h');   // 막 끝에 비치는 핏빛
          }
          line(g, cx + s2 * 4, cy - 3, elx, ely, 'B', 4);            // 앞모서리
          line(g, elx, ely, tipx, tipy, 'B', 3);
          line(g, cx + s2 * 4, cy - 4, elx, ely - 1, 'C', 1);
          for (let k = 1; k <= 3; k++) {                             // 손가락뼈 — 뼈로 그린다
            const t = k / 4;
            const jx = elx + (tipx - elx) * t, jy = ely + (tipy - ely) * t;
            line(g, elx, ely + 1, jx, jy + 13 - Math.abs(t - .3) * 8, 'E', 1);
          }
          line(g, tipx - s2, tipy, tipx - s2 * 3, tipy - 4, 'F', 1); // 날개 끝 갈고리 — 작게
        }
        ell(g, cx, cy, 9, 10, 'B');                                  // 몸
        ell(g, cx, cy + 3, 7, 7, 'D');                               // 배
        ell(g, cx, cy + 6, 5, 4, 'a');
        ell(g, cx - 3, cy - 4, 5, 4, 'C');                           // 등에 드는 빛
        ell(g, cx - 4, cy - 6, 3, 2, 'G');
        for (const s2 of [-1, 1]) {                                  // 귀 — 안쪽은 살빛이라야 귀다
          line(g, cx + s2 * 4, cy - 8, cx + s2 * 8, cy - 17, 'B', 4);
          line(g, cx + s2 * 4, cy - 8, cx + s2 * 7, cy - 15, 'i', 2);
          put(g, cx + s2 * 6, cy - 12, 'I');
        }
        ell(g, cx, cy - 2, 6, 5, 'B');                               // 얼굴
        ell(g, cx - 2, cy - 4, 3.4, 2.4, 'C');
        rect(g, cx - 2, cy, cx + 1, cy + 3, 'i');                    // 주둥이 — 살빛
        put(g, cx, cy, 'I');
        outline(g);
        eyes(g, cx, cy - 4, 3, 'G', 3);
        eyes(g, cx, cy - 4, 3, 'W', 1);
        for (const s2 of [-1, 1]) put(g, cx + s2 * 2, cy + 4, 'F');  // 송곳니
        return g;
      },
      // 유령 — 떠오르고 아랫자락이 물결친다. 속이 비쳐야 유령이다.
      ghost(f, S) {
        const g = mk(S);
        const oy = [0, -2, 0, 2][f];
        const cx = 31, hy = 28 + oy;
        ell(g, cx, hy, 17, 17, 'D');                                 // 겉자락 — 어둡다
        rect(g, cx - 17, hy, cx + 17, hy + 15, 'D');
        for (let x = cx - 17; x <= cx + 17; x++) {                   // 해진 아랫단
          const w = 7 + Math.sin((x + f * 3) * .55) * 5;
          rect(g, x, hy + 15, x, hy + 15 + w, 'D');
          if (w > 9) rect(g, x, hy + 15 + w, x, hy + 15 + w + 3, 'c');
        }
        /* 속을 밝게 두면 천이 얇아 비치는 것으로 읽힌다. 겉만 어두우면 그냥 파란 덩어리다. */
        ell(g, cx, hy + 1, 12, 12, 'B');
        rect(g, cx - 12, hy + 1, cx + 12, hy + 16, 'B');
        ell(g, cx - 4, hy - 5, 7, 5, 'C');
        for (const t of [-.55, .1, .6])                              // 주름
          for (let y = hy - 4; y <= hy + 20; y++)
            rect(g, cx + 14 * t, y, cx + 14 * t + 1, y, 'D');
        // 두건 안쪽 — 깊은 구멍이라야 얼굴이 없다는 게 읽힌다
        ell(g, cx, hy - 1, 10, 9, 't');
        ell(g, cx, hy, 8, 7, 'O');
        /* 구멍만 두면 '얼굴 없음'에서 멈춘다. 그 안에 뼈 얼굴을 반쯤 띄우면
           '얼굴이 없는 게 아니라 남은 게 뼈뿐'이 된다 — 훨씬 무섭고 색도 는다. */
        ell(g, cx, hy + 1, 5.5, 5, 'E');
        ell(g, cx - 1, hy, 3.6, 3, 'F');
        rect(g, cx - 4, hy + 5, cx + 3, hy + 6, 'E');                // 이
        for (let i = -1; i <= 1; i++) put(g, cx + i * 2, hy + 5, 'O');
        outline(g);
        eyes(g, cx, hy - 1, 4, 'O', 4);
        eyes(g, cx, hy - 1, 4, 'G', 3);
        eyes(g, cx, hy - 1, 4, 'W', 1);
        for (const s2 of [-1, 1]) {                                  // 소맷자락처럼 흐르는 팔
          line(g, cx + s2 * 12, hy + 4, cx + s2 * 19, hy + 12 + oy, 'D', 5);
          line(g, cx + s2 * 12, hy + 3, cx + s2 * 18, hy + 10 + oy, 'C', 1);
          for (let k = 0; k < 3; k++)                                // 삐져나온 뼈 손가락
            put(g, cx + s2 * (19 + k), hy + 14 + oy + k, 'E');
        }
        for (let x = cx - 12; x <= cx + 12; x += 6)                  // 허리에 두른 녹슨 사슬
          { put(g, x, hy + 13 + oy, 'w'); put(g, x + 2, hy + 13 + oy, 'x'); }
        return g;
      },
      /* 인간형 — 좀비 · 거구 · 궁수 · 돌격병 · 방패병이 같이 쓴다.

         예전엔 다섯이 색만 다르고 실루엣이 똑같았다. 화면에 200마리가 있는데
         '무엇이 오는지'가 색으로만 구별되면 난전에서는 못 읽는다.
         위험한 것과 안 위험한 것은 모양이 달라야 한다.

         뼈대는 공유하고 붙는 것만 다르다 —
           좀비는 맨몸에 드러난 갈비뼈 · 거구는 어깨가 몸통보다 넓다 ·
           궁수는 활과 화살통 · 돌격병은 뿔투구 · 방패병은 큰 방패. */
      humanoid(f, S, def) {
        const g = mk(S);
        const v = (def && def.var) || 'zombie';
        const big = v === 'brute', lean = v === 'archer';
        const sw = [0, 4, 0, -4][f];
        const br = [0, 1, 0, -1][f];
        const cx = 31, hy = (v === 'charger' ? 19 : 17) + br;
        const SH = big ? 16 : lean ? 10 : 13;          // 어깨 너비
        const edgeLine = (x0, y0, x1, y1, ch, t) => {
          line(g, x0, y0, x1, y1, 'O', t + 3); line(g, x0, y0, x1, y1, ch, t);
        };
        // ── 다리 ──
        for (const s2 of [-1, 1]) {
          const lx = cx + s2 * (big ? 7 : 6) + s2 * sw * .5;
          edgeLine(lx, 44, lx + s2 * sw * .3, 55, 'D', big ? 9 : 7);
          line(g, lx - 2, 44, lx + s2 * sw * .3 - 2, 54, 'B', 2);
          line(g, lx - 3, 44, lx + s2 * sw * .3 - 3, 53, 'C', 1);
          rect(g, lx - 5, 55, lx + 4, 58, 'l');                      // 발 — 가죽 신
          rect(g, lx - 5, 55, lx + 4, 55, 'L');
          rect(g, lx - 5, 58, lx + 4, 58, 'd');
        }
        // ── 팔 ── 직업마다 자세가 다르다
        for (const s2 of [-1, 1]) {
          const isL = s2 < 0;
          let ex, ey, hx2, hy2;
          if (v === 'charger') {                       // 뒤로 젖힌 팔 — 달려든다
            ex = cx + s2 * (SH + 3); ey = 30 + s2 * sw * .4;
            hx2 = cx + s2 * (SH + 5); hy2 = ey + 10;
          } else if (v === 'archer' && isL) {          // 활을 든 왼팔은 앞으로
            ex = cx - SH - 6; ey = 28; hx2 = cx - SH - 11; hy2 = 28;
          } else if (v === 'shield' && isL) {          // 방패를 든 왼팔은 몸 앞
            ex = cx - SH - 3; ey = 30; hx2 = cx - SH - 5; hy2 = 34;
          } else {
            ex = cx + s2 * (SH + 2); ey = 34 + s2 * sw;
            hx2 = cx + s2 * (SH + 4); hy2 = ey + 12;
          }
          const t = big ? 9 : 7;
          edgeLine(cx + s2 * (SH - 2), 26 + br, ex, ey, 'D', t);
          edgeLine(ex, ey, hx2, hy2, 'D', t - 1);
          line(g, cx + s2 * (SH - 2) - 2, 25 + br, ex - 2, ey - 1, 'B', 2);
          ell(g, hx2, hy2 + 1, big ? 6 : 4.5, big ? 5.5 : 4, 'c');   // 주먹
          if (v === 'zombie' || big)
            for (let k = -1; k <= 1; k++) put(g, hx2 + k * 2, hy2 + (big ? 6 : 5), 'E');
        }
        // ── 몸통 ──
        ell(g, cx, 26 + br, SH, big ? 11 : 9, 'B');                  // 굽은 어깨
        rect(g, cx - SH + 2, 26 + br, cx + SH - 2, 45, 'B');
        rect(g, cx - SH + 2, 26 + br, cx - SH + 5, 44, 'C');         // 왼쪽 빛
        rect(g, cx - SH + 2, 26 + br, cx - SH + 2, 44, 'G');
        rect(g, cx + SH - 4, 28 + br, cx + SH - 2, 45, 'D');
        rect(g, cx + SH - 2, 30 + br, cx + SH - 2, 45, 'a');         // 오른쪽 끝은 더 깊게
        if (v === 'zombie') {
          for (let i = 0; i < 3; i++) {                              // 드러난 갈비뼈
            rect(g, cx - 7 + i, 31 + br + i * 4, cx + 6 - i, 32 + br + i * 4, 'E');
            rect(g, cx - 7 + i, 31 + br + i * 4, cx + 2 - i, 31 + br + i * 4, 'F');
          }
          ell(g, cx - 1, 38 + br, 3.4, 2.6, 't');                    // 뚫린 배 — 네모면 주머니다
          ell(g, cx - 1, 38.5 + br, 2.2, 1.6, 'h');                  // 마른 피
          put(g, cx - 2, 40 + br, 'h'); put(g, cx + 1, 41 + br, 'h'); // 흘러내린 자국
          for (let k = 0; k < 3; k++) put(g, cx - 5 + k * 5, 43, 'h');
          rect(g, cx - SH + 1, 33 + br, cx - SH + 4, 45, 'l');       // 걸친 넝마
          rect(g, cx - SH + 1, 33 + br, cx - SH + 2, 44, 'L');
        } else if (big) {
          for (let i = 0; i < 4; i++)                                // 두꺼운 근육 결
            rect(g, cx - 10 + i, 32 + br + i * 3, cx + 9 - i, 33 + br + i * 3, 'a');
          for (const s2 of [-1, 1]) {                                // 어깨를 가로지르는 가죽띠
            line(g, cx + s2 * 12, 22 + br, cx - s2 * 8, 45, 'L', 4);
            line(g, cx + s2 * 12, 22 + br, cx - s2 * 8, 45, 'u', 1);
            for (let k = 0; k < 3; k++)                              // 띠에 박은 쇠못
              put(g, cx + s2 * (10 - k * 7), 26 + br + k * 8, 'm');
          }
          rect(g, cx - 5, 30 + br, cx + 4, 33 + br, 'h');            // 가슴의 상처
          rect(g, cx - 4, 31 + br, cx + 3, 32 + br, 'i');
        } else {                                                     // 가죽 갑옷
          rect(g, cx - SH + 2, 30 + br, cx + SH - 2, 32 + br, 'L');
          rect(g, cx - SH + 2, 30 + br, cx + SH - 2, 30 + br, 'u');
          rect(g, cx - SH + 2, 38, cx + SH - 2, 40, 'L');
          rect(g, cx - SH + 2, 38, cx + SH - 2, 38, 'u');
          for (let k = -1; k <= 1; k++) put(g, cx + k * 6, 39, 'm');  // 갑옷의 쇠못
        }
        rect(g, cx - SH + 2, 41, cx + SH - 2, 43, 'l');              // 허리띠 — 가죽
        rect(g, cx - SH + 2, 41, cx + SH - 2, 41, 'L');
        rect(g, cx - 2, 41, cx + 2, 43, 'J');                        // 버클
        for (const s2 of [-1, 1]) {                                  // 어깨 갑판
          ell(g, cx + s2 * (SH - 2), 27 + br, big ? 7 : 5.5, big ? 5 : 4, 't');
          ell(g, cx + s2 * (SH - 2), 26 + br, big ? 6.5 : 5, big ? 4.5 : 3.5, 'D');
          ell(g, cx + s2 * (SH - 2) - 1, 25 + br, big ? 4.5 : 3.4, big ? 3 : 2.4, 'C');
        }
        // ── 머리 ──
        const hr = big ? 7 : 8;
        ell(g, cx, hy + 1, hr + .5, hr + .5, 'c');
        ell(g, cx, hy, hr, hr, 'B');
        ell(g, cx - 2, hy - 3, hr * .6, hr * .5, 'C');
        if (v === 'charger') {                                       // 뿔투구 — 녹슨 쇠
          rect(g, cx - hr, hy - 5, cx + hr, hy - 1, 'x');
          rect(g, cx - hr, hy - 5, cx + hr, hy - 5, 'w');
          rect(g, cx - hr, hy - 5, cx - hr + 2, hy - 1, 'w');
          for (const s2 of [-1, 1]) {
            line(g, cx + s2 * hr, hy - 4, cx + s2 * (hr + 5), hy - 9, 'E', 3);
            line(g, cx + s2 * hr, hy - 5, cx + s2 * (hr + 4), hy - 9, 'F', 1);
            put(g, cx + s2 * (hr + 6), hy - 10, 'F');
            put(g, cx + s2 * hr, hy - 3, 'm');                       // 뿔을 무는 쇠고리
          }
          put(g, cx, hy + 3, 'w'); put(g, cx + 1, hy + 3, 'x');      // 코뚜레
        } else if (v === 'shield') {                                 // 챙 달린 투구 — 강철
          rect(g, cx - hr, hy - 6, cx + hr, hy - 2, 'm');
          rect(g, cx - hr, hy - 6, cx - hr + 2, hy - 2, 'M');
          rect(g, cx - hr - 2, hy - 2, cx + hr + 2, hy, 'M');
          rect(g, cx - hr - 2, hy - 2, cx + hr + 2, hy - 2, 'H');
          rect(g, cx - 1, hy - 6, cx + 1, hy, 'e');                  // 코가리개
        } else if (lean) {                                           // 두건
          ell(g, cx, hy - 2, hr, hr - 1, 't');
          rect(g, cx - hr, hy - 2, cx + hr, hy, 't');
          rect(g, cx - hr, hy - 3, cx - hr + 3, hy, 'c');            // 두건의 볕
        }
        rect(g, cx - 6, hy + 4, cx + 5, hy + 8, 't');                // 턱 안쪽
        for (let i = -2; i <= 2; i++) put(g, cx + i * 2, hy + 7, 'F');  // 이빨
        rect(g, cx - 6, hy + 4, cx + 5, hy + 4, 'E');                // 잇몸 — 뼈 한 줄
        // ── 붙는 것 ──
        if (v === 'archer') {
          for (let i = 0; i < 2; i++) {                              // 등에 멘 화살 — 나무 대에 쇠촉
            line(g, cx + 9 + i * 3, 20, cx + 12 + i * 3, 12, 'L', 2);
            put(g, cx + 12 + i * 3, 11, 'm'); put(g, cx + 12 + i * 3, 10, 'M');
            put(g, cx + 9 + i * 3, 21, 'F');                         // 깃
          }
          rect(g, cx + 8, 20, cx + 15, 27, 'l');                     // 화살통 — 가죽
          rect(g, cx + 8, 20, cx + 15, 21, 'L');
          rect(g, cx + 8, 24, cx + 15, 24, 'u');
          const bx = cx - SH - 13;                                   // 활 — 나무
          for (let i = -10; i <= 10; i++) {
            const yy = 28 + i, xx = bx + Math.abs(i) * .38 - 2;
            put(g, xx, yy, 'l');
            if (Math.abs(i) < 10) put(g, xx - 1, yy, 'L');
            if (Math.abs(i) < 8) put(g, xx - 2, yy, 'u');
          }
          put(g, bx + 1.8, 18, 'w'); put(g, bx + 1.8, 38, 'w');      // 활 끝의 쇠
          line(g, bx - 2, 18, bx - 2, 38, 'F', 1);                   // 시위
        } else if (v === 'shield') {
          const sx2 = cx - SH - 8;                                   // 큰 방패 — 강철
          ell(g, sx2, 33, 11, 15, 'e');
          ell(g, sx2, 32, 9.5, 13.5, 'm');
          rect(g, sx2 - 9.5, 20, sx2 + 9.5, 24, 'm');
          ell(g, sx2 - 2, 28, 6, 8, 'M');                            // 왼쪽 위가 밝다
          rect(g, sx2 - 1.5, 22, sx2 + 1.5, 44, 'J');                // 금 세로 띠
          rect(g, sx2 - 7, 30, sx2 + 7, 34, 'J');
          rect(g, sx2 - 1.5, 22, sx2 - .5, 43, 'o');
          rect(g, sx2 - 7, 31, sx2 + 6, 31, 'o');
          ell(g, sx2, 32, 3, 3, 'o');                                // 방패 보스
          ell(g, sx2 - 1, 31, 1.4, 1.4, 'Z');
          rect(g, sx2 - 10, 24, sx2 - 9, 42, 'H');                   // 왼쪽 테 광
          for (let k = 0; k < 4; k++) put(g, sx2 - 8 + k * 5, 22, 'w');   // 녹슨 못
        }
        outline(g);
        eyes(g, cx, hy - 1, 4, 'O', 4);
        eyes(g, cx, hy, 4, 'G', 2);
        return g;
      },

      /* 사냥개 — 네 다리가 달린다.

         한 번 크게 틀렸다. 몸을 가로로 길게 늘이고 꼬리를 굵은 선으로 45도 세웠더니
         '널빤지를 등에 진 덩어리'가 됐다. 그리고 등가시를 뼈로 넷 세웠는데,
         뼈 예산을 그렇게 쓰면 개가 아니라 벌레가 된다 — 이빨에만 남긴다.

         짐승으로 읽히려면 세 가지가 필요하다:
           목(머리와 몸을 잇는 좁은 부분) · 앞뒤 다리가 따로 보일 것 · 가늘어지는 꼬리. */
      hound(f, S) {
        const g = mk(S);
        const a = [0, 3, 0, -3][f];
        const edgeLine = (x0, y0, x1, y1, ch, t) => {
          line(g, x0, y0, x1, y1, 'O', t + 2); line(g, x0, y0, x1, y1, ch, t);
        };
        const leg = (bx, sgn, ch, t) => {                  // 무릎에서 한 번 꺾인다
          const kx = bx + sgn * a * .6;
          edgeLine(bx, 40, kx, 48, ch, t);
          edgeLine(kx, 48, kx + sgn * a * .8, 55, ch, t - 1);
          rect(g, kx + sgn * a * .8 - 3, 55, kx + sgn * a * .8 + 3, 58, 'c');
        };
        leg(23, -1, 't', 6); leg(41, 1, 't', 6);           // 먼 쪽 다리는 어둡게
        ell(g, 30, 33, 15, 10, 'B');                       // 몸
        ell(g, 21, 32, 10, 9, 'D');                        // 엉덩이
        ell(g, 39, 33, 10, 9, 'B');                        // 가슴
        rect(g, 17, 26, 40, 29, 'C');                      // 등에 드는 빛
        rect(g, 19, 25, 38, 26, 'G');                      // 등마루의 빛
        rect(g, 20, 39, 40, 41, 'a');                      // 배의 그늘
        rect(g, 22, 41, 38, 42, 't');
        for (let i = 0; i < 3; i++)                        // 등가시 — 뼈가 아니라 어두운 털
          line(g, 22 + i * 6, 25, 20 + i * 6, 19 - i, 't', 3 - (i > 1 ? 1 : 0));
        leg(27, 1, 'D', 7); leg(45, -1, 'D', 7);           // 가까운 쪽 다리
        for (const bx of [27, 45]) {                       // 발톱 — 뼈는 여기와 이빨에만
          for (let k = -1; k <= 1; k++) put(g, bx + k * 2 + a * .8, 58, 'E');
        }
        edgeLine(16, 31, 9, 27 - a, 'D', 3);               // 꼬리 — 가늘어진다
        edgeLine(9, 27 - a, 3, 21 - a * 2, 't', 2);
        edgeLine(45, 30, 49, 24, 'B', 8);                  // 목
        /* 목줄. 짐승에 사람이 채운 물건이 하나 붙으면 '야생'이 아니라 '풀려난 것'이 된다 —
           같은 실루엣이 훨씬 사납게 읽힌다. */
        line(g, 44, 26, 48, 32, 'x', 4);
        line(g, 44, 25, 47, 30, 'w', 2);
        for (let k = 0; k < 3; k++) put(g, 45 + k, 27 + k * 2, 'm');   // 목줄의 쇠징
        ell(g, 51, 22, 8, 7.5, 'B');                       // 머리
        ell(g, 50, 19, 6, 4, 'C');
        ell(g, 49, 17.5, 3.4, 2, 'G');
        rect(g, 55, 22, 62, 27, 'B');                      // 주둥이
        rect(g, 55, 22, 61, 23, 'C');
        rect(g, 55, 27, 62, 28, 'a');
        rect(g, 61, 22, 62, 24, 't');                      // 코
        put(g, 62, 23, 'x');
        for (const s2 of [-1, 1]) {                        // 귀 — 안쪽은 살빛
          line(g, 49 + s2 * 2, 16, 47 + s2 * 4, 8, 'D', 4);
          line(g, 49 + s2 * 2, 15, 47 + s2 * 3, 10, 'i', 1);
        }
        outline(g);
        for (let i = 0; i < 4; i++) {                      // 이빨 — 뼈
          put(g, 56 + i * 2, 26, 'F');
          put(g, 56 + i * 2, 27, 'E');
        }
        /* 눈을 4칸 폭으로 붉게 두었더니 귀 안쪽의 살빛과 합쳐져 얼굴이 분홍 덩어리가 됐다.
           짐승의 눈은 작고 깊어야 사납다 — 좁히고 둘레를 어둡게 판다. */
        rect(g, 52, 20, 54, 22, 't');
        rect(g, 52, 20, 53, 21, 'I');
        put(g, 52, 20, 'W');
        return g;
      },

      /* ---------- 바닥 타일 ----------
         64px 네 변종. 애니메이션이 아니라 '어느 칸에 무엇을 깔지'의 선택지다.
         이어 붙였을 때 이음매가 보이면 안 되므로 가장자리는 손대지 않고
         안쪽에만 무늬를 넣는다. 값은 좌표 해시라 매번 같은 타일이 나온다. */
      /* 바닥 — 판석을 깐다.

         예전에는 옅은 잡음 위에 십자로 금 하나를 그은 게 전부였다. 화면의 대부분이
         바닥인데 거기가 잡음뿐이면 아무리 캐릭터를 올려도 판이 비어 보인다.

         배치는 벽돌쌓기(running bond)다. 줄마다 절반씩 어긋나게 놓으면
         격자무늬가 눈에 덜 띈다. 128 칸에서 줄 높이 32 · 판석 폭 64 · 홀수 줄은 32 밀기 —
         가로세로 모두 128 에서 되풀이되므로 타일로 이어 붙어도 이음매가 안 생긴다.

         변종 넷은 배치를 공유하고 톤과 흠집만 다르다. 배치까지 다르면 옆 타일과
         판석이 어긋나 붙는다. */
      floor(f, S) {
        const g = mk(S);
        /* 해시 둘. 이걸 하나로 쓴 것이 오래된 잘못이었다.

           H 는 변종 번호 f 를 섞는다. 그런데 판석의 줄 위치·너비·시작점까지 H 로 뽑고
           있었다 — 그러면 변종마다 배치가 달라져서, 옆 타일과 이어 붙였을 때
           판석 줄이 어긋나 128칸 격자가 그대로 눈에 들어온다.
           넓게 깔아 놓고 보니 타일 경계가 줄줄이 보였다.

           HL(layout)은 f 를 안 섞는다. 배치는 넷이 똑같고, 톤·흠집·이끼만 다르다 —
           주석에는 처음부터 그렇게 적혀 있었는데 코드가 안 그랬다. */
        const H = (a, b) => {
          let x = Math.imul(a * 374761393 + b * 668265263 + f * 2246822519, 1274126177);
          x = (x ^ (x >>> 15)) >>> 0;
          return x / 4294967296;
        };
        const HL = (a, b) => {
          let x = Math.imul(a * 374761393 + b * 668265263, 1274126177);
          x = (x ^ (x >>> 15)) >>> 0;
          return x / 4294967296;
        };
        const wrap = v => ((v % S) + S) % S;
        const px = (x, y, ch) => { g[wrap(y)][wrap(x)] = ch; };

        const RH = S / 4;                 // 줄 높이 (128 → 32)
        const J = Math.max(1, S / 64);    // 줄눈 두께

        /* 줄마다 판석을 둘 또는 셋으로 나누고, 줄마다 시작 위치를 어긋낸다.

           처음엔 모든 줄이 x = 0 에서 시작하게 했다. 타일이 이어 붙는 건 확실했지만
           x = 0 만 네 줄을 관통하는 줄눈이 되어 넓게 깔면 64px 격자가 눈에 그대로 들어왔다.
           바닥은 배경이지 격자무늬가 아니다.

           px 가 좌표를 감싸므로 판석이 타일 경계를 넘어가도 반대쪽으로 이어진다 —
           위상을 어긋내도 이음매는 그대로 맞는다. */
        const rowCuts = ry => {
          const n = HL(ry * 17 + 5, 23) > .45 ? 3 : 2;
          if (n === 2) {
            const a2 = Math.round(S * (.36 + HL(ry, 29) * .28));
            return [a2, S - a2];
          }
          const a2 = Math.round(S * (.24 + HL(ry, 31) * .16));
          const b2 = Math.round(S * (.28 + HL(ry, 37) * .16));
          return [a2, b2, S - a2 - b2];
        };
        const yPh = Math.round(HL(3, 19) * RH);

        // 1. 판석마다 제 톤으로 채운다 — 폭을 좁게. 대비를 세우면 바닥이 몬스터와 싸운다.
        const stones = [];
        for (let ry = 0; ry < 4; ry++) {
          const ws = rowCuts(ry);
          let x = Math.round(HL(ry * 3 + 7, 41) * S);      // 줄마다 다른 시작점
          const y0 = yPh + ry * RH;
          for (let si = 0; si < ws.length; si++) {
            /* 판석마다 밝기 셋 중 하나를 고르던 것을, 색조까지 섞어 다섯 중 하나로 넓힌다.
               밝기 폭은 그대로다 — 늘어난 것은 '어떤 돌이냐'지 '얼마나 밝냐'가 아니다. */
            const n = H(ry * 7 + 1, si * 13 + 3);
            const tone = n > .86 ? '4' : n > .70 ? 'f' : n > .54 ? 'g' : n > .26 ? '3' : '2';
            // 알갱이도 그 돌의 색조를 따라간다. 전부 회색 점이면 돌이 아니라 종이가 된다.
            const spec = tone === 'f' ? 'K' : tone === 'g' ? '5' : '4';
            stones.push({ x, y: y0, w: ws[si], tone });
            for (let dy = 0; dy < RH; dy++) for (let dx = 0; dx < ws[si]; dx++) {
              const wx = wrap(x + dx), wy = wrap(y0 + dy);
              // 알갱이는 아주 옅게, 아주 드물게. 예전에 이걸 세웠다가 TV 노이즈가 됐다.
              const q = H(wx * 3 + 11, wy * 5 + 7);
              px(wx, wy, q > .986 ? spec : q < .016 ? '2' : q > .965 ? (tone === 'g' ? 'f' : 'g') : tone);
            }
            x += ws[si];
          }
        }

        // 2. 줄눈 — 파인 선 하나에 아래쪽 빛받는 모서리 하나. 두 줄이 깊이를 만든다.
        const seam = (x0, y0, dx, dy, len) => {
          for (let i = 0; i < len; i++) {
            for (let t = 0; t < J; t++) px(x0 + dx * i + dy * t, y0 + dy * i + dx * t, '1');
            px(x0 + dx * i + dy * J, y0 + dy * i + dx * J, '5');
          }
        };
        for (let ry = 0; ry < 4; ry++) seam(0, yPh + ry * RH, 1, 0, S);
        for (const st of stones) seam(st.x, st.y, 0, 1, RH);

        // 3. 갈라진 틈 — 판석 하나에만. 다 갈라지면 폐허가 아니라 지저분한 무늬가 된다.
        if (H(41, 17) > .35) {
          const st = stones[Math.floor(H(5, 9) * stones.length)];
          let cx = st.x + 6 + H(3, 3) * Math.max(2, st.w - 14);
          let cy = st.y + 5;
          for (let i = 0; i < RH - 8; i++) {
            px(cx, cy, 'k');
            if (H(i, 21) > .55) px(cx + 1, cy, '2');
            cx += H(i, 2) > .72 ? 1 : (H(i, 4) > .82 ? -1 : 0);
            cy += 1;
          }
        }

        /* 3-b. 젖은 자국 — 줄눈 언저리에 고인다. 물이 고이면 그 둘레에 물때가 끼고
           그 위에 이끼가 자란다. 셋을 겹쳐 놓으면 이끼가 '붙인 것'이 아니라
           '거기서 자란 것'이 된다. */
        for (let i = 0; i < 4; i++) {
          if (H(i * 5 + 83, 11) < .48) continue;
          const ry = Math.floor(H(i, 89) * 4);
          const wx0 = Math.floor(H(i, 97) * S), wy0 = yPh + ry * RH;
          const rw = 5 + Math.round(H(i, 101) * 7), rh = 2 + Math.round(H(i, 103) * 3);
          for (let dy = -rh; dy <= rh; dy++) for (let dx = -rw; dx <= rw; dx++) {
            const q = (dx / rw) * (dx / rw) + (dy / rh) * (dy / rh);
            if (q > 1) continue;
            px(wx0 + dx, wy0 + dy, q > .72 ? 'z' : '0');
          }
        }

        // 4. 이끼 — 줄눈에만 낀다. 물이 고이는 자리라 그렇고, 그래야 판석이 도드라진다.
        for (let i = 0; i < 5; i++) {
          if (H(i * 3 + 61, 7) < .45) continue;
          const ry = Math.floor(H(i, 31) * 4);
          const mx = Math.floor(H(i, 37) * S), my = yPh + ry * RH;
          for (let k2 = 0; k2 < 9; k2++) {
            const ox = Math.round(H(i * 9 + k2, 43) * 7) - 3;
            const oy = Math.round(H(i * 9 + k2, 47) * 4) - 1;
            px(mx + ox, my + oy, H(k2, 51) > .6 ? 'V' : 'v');
            // 둘레 한 칸은 물때 — 초록이 판석에 곧바로 닿으면 스티커로 보인다
            if (H(k2, 53) > .5) px(mx + ox + 1, my + oy + 1, 'z');
          }
        }

        // 5. 잔돌 — 아주 드물게. 바닥이 완전히 평평하면 죽은 판이 된다.
        for (let i = 0; i < 3; i++) {
          if (H(i + 71, 13) < .62) continue;
          const cx = Math.floor(H(i, 67) * S), cy = Math.floor(H(i, 73) * S);
          px(cx, cy, 'R'); px(cx + 1, cy, 'r'); px(cx, cy + 1, 'r');
          px(cx + 1, cy + 1, H(i, 79) > .5 ? 'f' : 'g');      // 잔돌 옆의 부스러기
        }
        /* 6. 이 빠진 모서리 — 판석 귀퉁이가 깨져 속살이 드러난 자리.
           바닥 전체에서 가장 밝은 점이라 한 타일에 한둘만 둔다. */
        for (let i = 0; i < 2; i++) {
          if (H(i + 91, 17) < .55) continue;
          const st = stones[Math.floor(H(i + 3, 19) * stones.length)];
          const cx = st.x + (H(i, 23) > .5 ? st.w - 2 : 1), cy = st.y + (H(i, 29) > .5 ? RH - 2 : 1);
          px(cx, cy, 'K'); px(cx + 1, cy, 'f'); px(cx, cy + 1, '1');
        }
        return g;
      },

      /* 바닥 장식 — 투명 배경에 드문드문 얹는다(타일의 14% 정도).
         타일을 네 종류 더 만드는 것보다 이쪽이 변화가 크다.

         판을 128 로 올리면서 다시 그렸다. 예전 넷 중 '갈라진 금'은 뺐다 —
         이제 판석 자체에 금이 가 있어서 겹친다.
         대신 풀 · 꽃 · 자갈 무더기 · 뼈. 살아 있는 것과 부서진 것을 반씩 둔다. */
      /* 바닥 장식. 판석 위에 드문드문(14%) 얹는다.

         세 번 다시 그렸다. 매번 같은 실수를 했다 — 장식 하나를 '한 덩어리'로 그린 것이다.
         화면에서 이 타일은 64px 이고 장식은 그 안에서 20px 남짓이다.
         그 크기에서 덩어리는 형체를 못 갖는다. 이끼는 초록 손바닥이 됐고,
         풀은 빗이 됐고, 뼈는 만화에 나오는 개 뼈다귀가 됐다.

         그래서 규칙을 바꿨다 — 덩어리 하나 대신 작은 것 여럿을 흩는다.
         멀리서는 '자국'으로 뭉쳐 보이고, 가까이서는 낱개가 보인다. 둘 다 맞다. */
      floordeco(f, S) {
        const g = mk(S);
        const H = (a, b) => {
          let x = Math.imul(a * 2654435761 + b * 40503 + f * 97, 2246822519);
          x = (x ^ (x >>> 13)) >>> 0;
          return x / 4294967296;
        };
        const K = S / 64;                 // 예전 좌표계(64) 기준 배율
        const T = Math.max(1, Math.round(K));

        /* 잎 하나. 곧게 세우면 안 된다 — 곧은 선 여럿은 풀이 아니라 빗이다.
           휘어야 풀이다. 그래서 각도를 주고 끝으로 갈수록 더 눕힌다. */
        const blade = (cx, cy, ang, len, hi) => {
          const N2 = 5;
          let px1 = cx, py1 = cy;
          for (let i = 1; i <= N2; i++) {
            const t = i / N2;
            const a2 = ang * (t * t * .6 + .4);          // 끝이 조금 더 눕는다
            const x2 = cx + Math.sin(a2) * len * t, y2 = cy - Math.cos(a2) * len * t * .92;
            line(g, px1, py1, x2, y2, hi && t > .5 ? 'V' : 'v', t > .6 ? 1 : T);
            px1 = x2; py1 = y2;
          }
          return { x: px1, y: py1 };
        };
        /* 한 포기 = 한 점에서 부챗살로 퍼지는 잎 몇. 뿌리를 모아야 포기가 된다. */
        const tuft = (cx, cy, n, sd, hi, sc = 1) => {
          /* 부채를 넓게 펴면 야자수나 문어가 된다 — 실제로 두 번 다 그렇게 나왔다.
             풀은 거의 곧게 서 있고 끝만 살짝 눕는다. ±30° 안쪽이 그 경계였다. */
          const fan = .32 + H(sd, 41) * .22;
          const ends = [];
          for (let k = 0; k < n; k++) {
            const t = n === 1 ? 0 : k / (n - 1) - .5;
            const ang = t * 2 * fan + (H(sd * 7 + k, 3) - .5) * .22;
            const len = (7 + (1 - Math.abs(t)) * 3 + H(sd * 7 + k, 5) * 3) * K * sc;
            ends.push(blade(cx + t * 2 * K, cy, ang, len, hi));
          }
          return ends;
        };
        /* 얼룩 — 낱알을 흩는다. 타원 하나로 칠하면 물감 자국이 된다.
           극좌표(각도+반지름)로 흩었더니 낱알이 초승달 모양으로 줄을 섰다 —
           이 해시는 k 를 일정하게 올리면 각도도 같이 흐른다. 그래서 정사각형 안에
           x·y 를 따로 뽑고 원 밖이면 버린다. 축마다 씨앗을 달리 줘야 상관이 안 생긴다. */
        const speck = (cx, cy, rx, ry, n, ch, sd) => {
          for (let k = 0, put = 0; k < n * 4 && put < n; k++) {
            const u = H(sd * 131 + k * 7, 29) * 2 - 1, w2 = H(sd * 197 + k * 13, 71) * 2 - 1;
            if (u * u + w2 * w2 > 1) continue;
            put++;
            const x2 = cx + u * rx, y2 = cy + w2 * ry;
            rect(g, x2, y2, x2 + (H(sd * 53 + k, 11) > .6 ? T : 0), y2, ch);
          }
        };

        /* 자리 잡기. 무작위 좌표로 두면 세 개가 겹쳐 한 덩어리가 된다 —
           이끼는 초록 반달이 됐고 뼈 셋은 겹쳐서 화살촉이 됐다.
           그래서 사분면을 하나씩 나눠 주고 그 안에서만 흔든다. */
        const QUAD = [[.27, .27], [.73, .29], [.29, .73], [.71, .71]];
        const spot = (i, sd) => {
          const q = QUAD[(i + Math.floor(H(sd, 61) * 4)) % 4];
          return [(q[0] + (H(i, 43) - .5) * .16) * S, (q[1] + (H(i, 47) - .5) * .16) * S];
        };

        if (f === 0) {                    // 이끼 — 실루엣이 아예 없어야 한다. 자국뿐.
          for (let i = 0; i < 3; i++) {
            const [cx, cy] = spot(i, 1);
            /* 낱알을 촘촘히 두면 결국 색칠한 타원이 되고, 너무 흩으면 아예 안 보인다.
               한 번씩 다 겪었다. 지금은 '얼룩이 주인공, 싹은 곁들이'로 잡았다 —
               그래야 1번(풀 포기)과 구별된다. 둘 다 잎이 주인공이면 같은 그림이다. */
            speck(cx, cy, 15 * K, 5 * K, 34, 'v', i);
            speck(cx, cy - 1.5 * K, 9 * K, 3 * K, 14, 'V', i + 3);
            tuft(cx + (H(i, 19) - .5) * 9 * K, cy + 1 * K, 2, i, true, .5);   // 아주 짧은 싹
          }
        } else if (f === 1) {             // 풀 포기 몇 + 바랜 꽃
          for (let i = 0; i < 3; i++) {
            const [cx, cy] = spot(i, 2);
            const big = i === 0;
            speck(cx, cy, 5 * K, 2 * K, 6, 'v', i + 7);
            const ends = tuft(cx, cy, big ? 5 : 3, i + 2, true);
            if (big) for (let k = 0; k < 2; k++) {      // 꽃은 잎 끝에 앉힌다
              const e = ends[Math.floor(H(k, 29) * ends.length)];
              rect(g, e.x - T + 1, e.y - T + 1, e.x, e.y, H(k, 23) > .45 ? 'p' : 'P');
            }
          }
        } else if (f === 2) {             // 돌부스러기 — 판석이 깨져 흩어진 것
          /* 여기서 두 번 틀렸다. 각도를 균등하게 나눴더니 고리가 보였고,
             칸을 나눠 한 칸에 하나씩 두었더니 이번엔 벽돌을 줄 맞춰 쌓은 것이 됐다.
             조각은 한 무더기만, 줄을 어긋내고 크기를 제각각으로 둔다. */
          const [gx, gy] = spot(0, 4);
          for (let k = 0; k < 7; k++) {
            if (H(k, 53) < .15) continue;
            const row = k % 3;
            const cx = gx + ((k / 3 | 0) - 1) * 9 * K + (H(k, 3) - .5) * 8 * K + row * 3 * K;
            const cy = gy + (row - 1) * 7 * K + (H(k, 7) - .5) * 6 * K;
            const w2 = (1 + H(k, 13) * 1.5) * K, h2 = (.6 + H(k, 17) * 1.1) * K;
            rect(g, cx - w2, cy + h2, cx + w2, cy + h2 + T - 1, 'k');   // 바닥에 닿은 자리
            rect(g, cx - w2, cy - h2, cx + w2, cy + h2, 'r');
            rect(g, cx - w2, cy - h2, cx + w2 - T, cy - h2 + T - 1, 'R');
          }
          speck(gx, gy, 17 * K, 12 * K, 16, 'r', 11);   // 잔모래
        } else {                          // 뼈 — 가늘게 흩어진 것. 두개골은 작게 하나.
          /* 뼈와 두개골이 붙으면 열쇠가 된다(그렇게 나왔다). 사분면을 나눠 두면
             그런 일이 없다 — 두개골이 0번, 뼈가 1·2·3번을 쓴다. */
          const skull = H(9, 9) > .45;
          for (let i = 1; i <= 3; i++) {
            const [cx, cy] = spot(i, 0);
            const a2 = H(i, 6) * Math.PI;
            const L = (3.6 + H(i, 12) * 2.8) * K;
            const dx = Math.cos(a2) * L, dy = Math.sin(a2) * L;
            const nx = -Math.sin(a2), ny = Math.cos(a2);
            /* 그림자를 뼈보다 굵게 그으면 뼈가 아니라 망치 자루가 된다 — 그렇게 나왔었다. */
            line(g, cx - dx, cy - dy + T, cx + dx, cy + dy + T, 'k', 1);       // 그림자
            line(g, cx - dx, cy - dy, cx + dx, cy + dy, 'n', T);
            line(g, cx - dx - nx * .7 * K, cy - dy - ny * .7 * K,
                    cx + dx - nx * .7 * K, cy + dy - ny * .7 * K, 'N', 1);     // 윗면 광
            for (const sg of [-1, 1])     // 마디 한 알 — 두 알을 달면 개 뼈다귀가 된다
              ell(g, cx + dx * sg, cy + dy * sg, 1.2 * K, 1.2 * K, 'n');
          }
          if (skull) {
            const [cx, cy] = spot(0, 0);
            ell(g, cx, cy + T, 3.4 * K, 2.6 * K, 'k');
            ell(g, cx, cy, 3.4 * K, 3 * K, 'n');
            ell(g, cx - .8 * K, cy - 1 * K, 1.2 * K, .8 * K, 'N');
            rect(g, cx - 2 * K, cy - .2 * K, cx - 1 * K, cy + .7 * K, 'O');
            rect(g, cx + 1 * K, cy - .2 * K, cx + 2 * K, cy + .7 * K, 'O');
            rect(g, cx - 1.2 * K, cy + 2.2 * K, cx + 1.2 * K, cy + 2.9 * K, 'n');
          }
        }
        return g;
      },

      /* 바닥 장식 둘째 겹 — 사람이 지나간 흔적.

         첫째 겹(floordeco)이 '자연'(이끼·풀·돌·뼈)이라면 이쪽은 '유물'이다.
         레퍼런스 그림과 우리 바닥의 차이 중 큰 하나가 이것이었다 —
         저쪽 바닥에는 무늬 박은 판석과 부서진 널판이 있고 우리는 풀만 있었다.

         규칙은 첫째 겹과 같다: 밝기는 바닥의 두 배 안, 덩어리 대신 낱개,
         사분면을 나눠 겹치지 않게. */
      floordeco2(f, S) {
        const g = mk(S);
        const H = (a, b) => {
          let x = Math.imul(a * 2654435761 + b * 40503 + f * 131, 2246822519);
          x = (x ^ (x >>> 13)) >>> 0;
          return x / 4294967296;
        };
        const K = S / 64, T = Math.max(1, Math.round(K));
        const cx = S / 2, cy = S / 2;
        // 좌표를 해시로만 뽑으면 넷이 한자리에 겹친다 — 첫째 겹에서 이미 겪었다
        const QD = [[.28, .28], [.72, .3], [.3, .72], [.7, .7]];

        if (f === 0) {
          /* 무늬 박은 판석 — 상감이라 바닥과 같은 높이다.
             처음엔 크게 그리고 모서리를 밝게 둘렀더니 바닥에 놓인 상자 뚜껑이 됐다.
             박아 넣은 것은 그림자도 테두리도 없다. 톤 차이만 아주 조금. */
          const R = 12 * K;
          rect(g, cx - R, cy - R, cx + R, cy + R, '2');
          rect(g, cx - R, cy - R, cx + R, cy - R + T - 1, '1');       // 이음선만
          rect(g, cx - R, cy - R, cx - R + T - 1, cy + R, '1');
          rect(g, cx + R - T + 1, cy - R, cx + R, cy + R, '1');
          rect(g, cx - R, cy + R - T + 1, cx + R, cy + R, '1');
          for (let i = 0; i < 4; i++) {                               // 네 잎 무늬
            const a2 = i / 4 * Math.PI * 2 + Math.PI / 4;
            const d = 6 * K;
            ell(g, cx + Math.cos(a2) * d, cy + Math.sin(a2) * d, 3 * K, 3 * K, '4');
            ell(g, cx + Math.cos(a2) * d, cy + Math.sin(a2) * d, 1.6 * K, 1.6 * K, '1');
          }
          ell(g, cx, cy, 3.4 * K, 3.4 * K, '1');
          ell(g, cx, cy, 2 * K, 2 * K, '4');
          for (let i = 0; i < 8; i++)                                 // 닳은 자국
            put(g, cx + (H(i, 3) - .5) * R * 2.2, cy + (H(i, 7) - .5) * R * 2.2, '1');
        } else if (f === 1) {
          /* 물웅덩이 — 젖은 자리는 바닥보다 어둡고 그 위에 가느다란 윤이 뜬다.
             흰 테를 둘렀더니 접시가 됐고, 나란한 줄 두 개를 그으니 등호(=)가 됐다.
             윤은 하나만, 짧게, 비스듬히. */
          for (let i = 0; i < 2; i++) {
            const q = QD[(i + Math.floor(H(9, 61) * 4)) % 4];
            const px2 = (q[0] + (H(i, 43) - .5) * .14) * S;
            const py2 = (q[1] + (H(i, 47) - .5) * .14) * S;
            const rx = (9 + H(i, 3) * 5) * K, ry = rx * .52;
            ell(g, px2, py2, rx + T * 1.5, ry + T, '1');              // 젖어 번진 가장자리
            ell(g, px2, py2, rx, ry, 'k');                            // 물 — 가장 어둡다
            line(g, px2 - rx * .5, py2 + ry * .18, px2 + rx * .05, py2 - ry * .3, '5', T);
            put(g, px2 + rx * .42, py2 + ry * .3, '4');
          }
        } else if (f === 2) {
          /* 부서진 널판 — 상자였던 것.
             흙색으로 두니 바닥에 묻혔고, 좌표를 해시로 뽑으니 넷이 한자리에 겹쳐
             사다리 하나가 됐다. 사분면을 나눠 준다(첫째 겹에서 배운 것과 같다). */
          for (let i = 0; i < 4; i++) {
            const q = QD[(i + Math.floor(H(5, 61) * 4)) % 4];
            const px2 = (q[0] + (H(i, 43) - .5) * .16) * S;
            const py2 = (q[1] + (H(i, 47) - .5) * .16) * S;
            const a2 = H(i, 5) * Math.PI;
            const L = (8 + H(i, 23) * 5) * K, w2 = T * 1.6;
            const dx = Math.cos(a2) * L, dy = Math.sin(a2) * L * .55;
            line(g, px2 - dx, py2 - dy + w2, px2 + dx, py2 + dy + w2, 'k', w2);
            line(g, px2 - dx, py2 - dy, px2 + dx, py2 + dy, '6', w2);
            line(g, px2 - dx, py2 - dy - T * .6, px2 + dx, py2 + dy - T * .6, '7', T * .8);
            for (const sg of [-1, 1]) put(g, px2 + dx * sg * .64, py2 + dy * sg * .64, '5');
          }
          for (let i = 0; i < 6; i++)                                 // 튄 조각
            put(g, cx + (H(i, 31) - .5) * 40 * K, cy + (H(i, 37) - .5) * 32 * K, '6');
        } else {
          /* 덩굴 — 줄기가 판을 가로지르고 잎이 붙는다. 이끼와 달리 '길게' 뻗는다. */
          for (let i = 0; i < 2; i++) {
            const y0 = (.28 + i * .4) * S;
            let px2 = 0, py2 = y0;
            for (let k = 1; k <= 8; k++) {
              const x2 = k / 8 * S;
              const y2 = y0 + Math.sin(k * .9 + i * 2) * 5 * K;
              line(g, px2, py2 + T, x2, y2 + T, 'k', T);
              line(g, px2, py2, x2, y2, 'v', T);
              if (k % 2 === 0) {                                       // 잎
                const s2 = k % 4 === 0 ? 1 : -1;
                ell(g, x2, y2 + s2 * 3 * K, 2.6 * K, 1.8 * K, 'v');
                ell(g, x2 - K * .5, y2 + s2 * 3 * K - K * .5, 1.4 * K, 1 * K, 'V');
              }
              px2 = x2; py2 = y2;
            }
          }
        }
        return g;
      },

      /* ---------- 이펙트 ----------
         몬스터·주인공과 달리 검은 윤곽을 두르지 않는다. 빛이기 때문이다.
         B = 속성색 · G = 밝은 속성색 · W = 흰 심지. 이 세 겹이 타격감을 만든다. */


      /* 예전에는 속성 여섯이 전부 같은 별표였고 색만 달랐다. 화면에서 가장 자주,
         가장 많이 보이는 것이 이건데 형태가 하나뿐이면 '무엇에 맞았는지'가 안 읽힌다.

         지금은 속성마다 형태가 다르다 —
           물리는 베인 자국 · 화염은 혀 · 냉기는 결정 · 폭풍은 갈래 번개 ·
           신성은 빛기둥 십자 · 흡혈은 튄 자국.
         색만으로 구별하면 색맹인 사람에게는 구별이 없다. 형태가 먼저다. */

      // 피격 — 속성마다 형태가 다르다
      hit(f, S, def) {
        const g = mk(S), c = (S - 1) / 2;
        const el = def.el || 'physical';
        const gro = [.42, .85, 1, .8][f];          // 퍼짐
        const fade = [1, 1, .75, .45][f];          // 심지가 사라진다
        const R = 30 * gro;

        const stroke = (x0, y0, x1, y1, t0, t1, ch) => {
          const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 + 1;
          for (let i = 0; i <= n; i++) {
            const u = i / n, t = t0 + (t1 - t0) * u;
            if (t < .5) continue;
            const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
            const h = Math.max(1, Math.round(t));
            rect(g, x - h / 2, y - h / 2, x + h / 2 - 1, y + h / 2 - 1, ch);
          }
        };
        const arcStroke = (r, a0, a1, t0, t1, ch) => {
          const n = 40;
          let px1 = c + Math.cos(a0) * r, py1 = c + Math.sin(a0) * r;
          for (let i = 1; i <= n; i++) {
            const u = i / n, a = a0 + (a1 - a0) * u;
            const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
            stroke(px1, py1, x, y, t0 + (t1 - t0) * u, t0 + (t1 - t0) * u, ch);
            px1 = x; py1 = y;
          }
        };

        if (el === 'fire') {
          // 불꽃 혀 — 위로 갈수록 가늘고 밝다
          for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + (i - 3) * .42 + f * .12;
            const L = R * (.7 + ((i * 7) % 5) * .1);
            const bx = c + Math.cos(a) * 3, by = c + Math.sin(a) * 3;
            const mx = c + Math.cos(a - .3) * L * .6, my = c + Math.sin(a - .3) * L * .6;
            const tx = c + Math.cos(a - .55) * L, ty = c + Math.sin(a - .55) * L;
            stroke(bx, by, mx, my, 8 * gro, 5 * gro, 'D');    // 혀의 뿌리는 식어 있다
            stroke(bx, by, mx, my, 6 * gro, 3.5 * gro, 'B');
            stroke(mx, my, tx, ty, 4 * gro, 1.5, 'G');
            stroke(mx, my, tx, ty, 2 * gro, 1.5, 'o');       // 끝은 금빛
          }
          ell(g, c, c + R * .08, R * .48, R * .34, 'D');     // 밑동의 식은 테
          ell(g, c, c + R * .1, R * .42, R * .3, 'B');
          ell(g, c, c + R * .11, R * .34 * fade, R * .24 * fade, 'G');
          ell(g, c, c + R * .12, R * .24 * fade, R * .17 * fade, 'o');
          ell(g, c, c + R * .12, R * .16 * fade, R * .12 * fade, 'Z');
          if (fade > .7) ell(g, c, c + R * .12, R * .09, R * .07, 'W');
          for (let i = 0; i < 8; i++) {                     // 불티 — 뜨거운 것과 식은 것
            const px3 = c + Math.cos(i * 1.9 + f) * R * (.9 + (i % 3) * .12);
            const py3 = c + Math.sin(i * 1.9 + f) * R * .7 - R * .3;
            put(g, px3, py3, i % 3 ? 'o' : 'Z');
            put(g, px3 + 1, py3 + 1, 'D');
          }
          if (f >= 2) for (let i = 0; i < 5; i++)           // 피어오르는 연기
            ell(g, c + Math.cos(i * 2.3 + f) * R * .8, c - R * (.5 + (i % 3) * .15),
                2.4 + (i % 2), 1.8 + (i % 2), f === 2 ? '9' : '8');
        } else if (el === 'frost') {
          // 서리 결정 — 여섯 갈래에 잔가지. 눈송이는 여섯이라야 눈송이다.
          for (let i = 0; i < 6; i++) {
            const a = i / 6 * Math.PI * 2 + Math.PI / 12;
            const ex = c + Math.cos(a) * R, ey = c + Math.sin(a) * R;
            stroke(c, c, ex, ey, 6 * gro, 1.5, 'a');      // 결정의 두꺼운 그림자면
            stroke(c, c, ex, ey, 5 * gro, 1.5, 'B');
            stroke(c, c, c + Math.cos(a) * R * .7, c + Math.sin(a) * R * .7, 3.5 * gro, 1.5, 'C');
            stroke(c, c, c + Math.cos(a) * R * .55, c + Math.sin(a) * R * .55, 2.5 * gro, 1.5, 'T');
            stroke(c, c, c + Math.cos(a) * R * .3, c + Math.sin(a) * R * .3, 2 * gro, 1.5, 'W');
            for (const sd of [-1, 1])                     // 잔가지
              for (const t of [.42, .68]) {
                const bx = c + Math.cos(a) * R * t, by = c + Math.sin(a) * R * t;
                stroke(bx, by, bx + Math.cos(a + sd * .9) * R * .22,
                       by + Math.sin(a + sd * .9) * R * .22, 2.5, 1.5, 'B');
              }
          }
          for (let i = 0; i < 5; i++) {                   // 떨어져 나간 조각
            const a = i * 1.3 + f, d = R * (1.05 + (i % 2) * .12);
            rect(g, c + Math.cos(a) * d - 1, c + Math.sin(a) * d - 1,
                    c + Math.cos(a) * d + 1, c + Math.sin(a) * d + 1, 'C');
            put(g, c + Math.cos(a) * d, c + Math.sin(a) * d, 'T');
          }
          ell(g, c, c, 6 * fade, 6 * fade, 'C');
          ell(g, c, c, 4.5 * fade, 4.5 * fade, 'T');
          ell(g, c, c, 3 * fade, 3 * fade, 'W');
        } else if (el === 'storm') {
          // 갈래 번개 — 곧은 선은 번개가 아니다. 꺾여야 번개다.
          for (let i = 0; i < 4; i++) {
            const a0 = i / 4 * Math.PI * 2 + f * .6;
            let px1 = c, py1 = c, a = a0;
            for (let k = 0; k < 4; k++) {
              a += (((i * 7 + k * 13 + f * 5) % 7) / 7 - .5) * 1.1;
              const L = R * .3;
              const x = px1 + Math.cos(a) * L, y = py1 + Math.sin(a) * L;
              stroke(px1, py1, x, y, 6 * gro - k, Math.max(1.5, 5 * gro - k), k < 2 ? 'G' : 'a');
              stroke(px1, py1, x, y, 4 * gro - k, Math.max(1.5, 3 * gro - k), k < 2 ? 'W' : 'T');
              if (k < 2) stroke(px1, py1, x, y, 2 * gro, 1.5, 'Z');   // 심지는 노랗다
              if (k === 1) {                              // 갈라지는 가지
                const b = a + (k % 2 ? 1 : -1) * .9;
                stroke(x, y, x + Math.cos(b) * L * .8, y + Math.sin(b) * L * .8, 2.5, 1.5, 'B');
              }
              px1 = x; py1 = y;
            }
          }
          ell(g, c, c, 10 * fade, 10 * fade * .5, 'G');
          ell(g, c, c, 7 * fade, 7 * fade * .55, 'T');
          ell(g, c, c, 5 * fade, 5 * fade, 'Z');
          ell(g, c, c, 3 * fade, 3 * fade, 'W');
        } else if (el === 'holy') {
          // 빛기둥 십자 — 세로가 길고 가로가 짧다. 정십자는 표식이지 빛이 아니다.
          const H = R * 1.5, Wd = R * .8;
          for (const [dx, dy, len, t] of [[0, -1, H, 8], [0, 1, H * .6, 6],
                                          [-1, 0, Wd, 6], [1, 0, Wd, 6]]) {
            stroke(c, c, c + dx * len, c + dy * len, t * gro, 1.5, 'C');
            stroke(c, c, c + dx * len * .8, c + dy * len * .8, (t - 1.5) * gro, 1.5, 'o');
            stroke(c, c, c + dx * len * .6, c + dy * len * .6, (t - 3) * gro, 1.5, 'Z');
            stroke(c, c, c + dx * len * .35, c + dy * len * .35, (t - 4.5) * gro, 1.5, 'W');
          }
          for (let i = 0; i < 8; i++) {                    // 퍼지는 잔광
            const a = i / 8 * Math.PI * 2 + Math.PI / 8;
            stroke(c + Math.cos(a) * R * .35, c + Math.sin(a) * R * .35,
                   c + Math.cos(a) * R * .8, c + Math.sin(a) * R * .8, 3 * gro, 1.5, 'G');
            stroke(c + Math.cos(a) * R * .35, c + Math.sin(a) * R * .35,
                   c + Math.cos(a) * R * .6, c + Math.sin(a) * R * .6, 1.5 * gro, 1.5, 'Z');
          }
          ell(g, c, c, 9 * fade, 9 * fade, 'o');
          ell(g, c, c, 7 * fade, 7 * fade, 'Z');
          ell(g, c, c, 4 * fade, 4 * fade, 'W');
        } else if (el === 'blood') {
          // 튄 자국 — 규칙적이면 안 된다. 큰 덩어리 몇에 꼬리를 단다.
          /* 정원 방울에 곧은 꼬리를 달았더니 분자 모형이 됐다.
             튄 자국은 날아간 방향으로 늘어나고, 꼬리는 방울 쪽이 굵다. */
          for (let i = 0; i < 9; i++) {
            const a = i * 2.4 + f * .7;
            const d = R * (.45 + ((i * 11) % 6) / 6 * .6);
            const bx = c + Math.cos(a) * d, by = c + Math.sin(a) * d;
            const rr = (1.4 + ((i * 5) % 4) * .85) * gro;
            /* 방울을 한 색으로 두면 스티커다. 젖은 것은 가장자리가 굳어 어둡고
               가운데가 밝게 젖어 있고 위쪽에 점 하나가 빛난다. */
            ell(g, bx, by, rr * (1 + Math.abs(Math.cos(a)) * .7) + .6,
                          rr * (1 + Math.abs(Math.sin(a)) * .7) + .6, 'i');
            ell(g, bx, by, rr * (1 + Math.abs(Math.cos(a)) * .7),
                          rr * (1 + Math.abs(Math.sin(a)) * .7), 'D');
            ell(g, bx - .4, by - .4, rr * .7, rr * .7, 'B');
            stroke(c + Math.cos(a) * d * .3, c + Math.sin(a) * d * .3, bx, by,
                   1.5, rr * 1.3, 'D');                    // 꼬리 — 방울 쪽이 굵다
            if (i % 3 === 0) put(g, bx - 1, by - 1, 'G');
            if (i % 4 === 0) put(g, bx - 1, by - 2, 'W');   // 젖은 광
          }
          for (let i = 0; i < 3; i++) {                    // 길게 튄 줄기 몇
            const a = i * 2.1 + f * 1.1 + .6;
            stroke(c + Math.cos(a) * R * .3, c + Math.sin(a) * R * .3,
                   c + Math.cos(a) * R * 1.15, c + Math.sin(a) * R * 1.15, 3.5 * gro, 1.5, 'B');
          }
          ell(g, c, c, R * .34, R * .34, 'h');            // 바깥은 굳은 피
          ell(g, c, c, R * .3, R * .3, 'D');
          ell(g, c, c, R * .22, R * .22, 'B');
          ell(g, c, c, R * .14 * fade, R * .14 * fade, 'G');
          if (fade > .7) ell(g, c, c, R * .07, R * .07, 'W');
        } else {
          /* 물리 — 베인 자국. 별표는 '무언가 터졌다'이지 '베였다'가 아니다.
             무기가 지나간 길이 보여야 한다.
             호 둘을 마주 보게 놓았더니 괄호가 됐다 — 엇갈려야 벤 자국이다.
             가운데가 굵고 양 끝이 가늘어야 획이지, 균일하면 막대다. */
          /* 획도 한 색이면 종이 오린 자국이다. 바깥은 식은 쇳빛, 안쪽은 흰 심지 —
             네 단계로 겹치면 '날이 지나간 자리'가 된다. */
          for (const [a, L, t] of [[-.55, R * 1.05, 11], [.72, R * .85, 8]]) {
            const dx = Math.cos(a), dy = Math.sin(a);
            for (const [sg, sc] of [[1, 1], [-1, .8]]) {
              stroke(c, c, c + sg * dx * L * sc, c + sg * dy * L * sc, t * gro, 1.5, 'm');
              stroke(c, c, c + sg * dx * L * sc * .92, c + sg * dy * L * sc * .92,
                     (t - 2) * gro, 1.5, 'M');
              stroke(c, c, c + sg * dx * L * sc * .7, c + sg * dy * L * sc * .7,
                     (t - 4) * gro, 1.5, 'H');
              stroke(c, c, c + sg * dx * L * sc * .5, c + sg * dy * L * sc * .5,
                     (t - 6) * gro, 1.5, 'W');
            }
          }
          for (let i = 0; i < 9; i++) {                    // 튀는 불똥 — 꼬리가 붙는다
            const a = i * 1.7 + f * .8, d = R * (.8 + (i % 3) * .16);
            const px3 = c + Math.cos(a) * d, py3 = c + Math.sin(a) * d;
            put(g, px3, py3, i % 3 ? 'X' : 'W');
            put(g, px3 - Math.cos(a) * 1.8, py3 - Math.sin(a) * 1.8, 'H');
            put(g, px3 - Math.cos(a) * 3.2, py3 - Math.sin(a) * 3.2, 'm');
          }
          ell(g, c, c, 8 * fade, 8 * fade, 'm');
          ell(g, c, c, 6 * fade, 6 * fade, 'M');
          ell(g, c, c, 4 * fade, 4 * fade, 'H');
          ell(g, c, c, 2 * fade, 2 * fade, 'W');
        }
        return g;
      },

      // 폭발 — 흰 섬광에서 시작해 속성색 고리로 비어 간다
      boom(f, S, def) {
        const g = mk(S), c = (S - 1) / 2;
        const el = def.el || 'physical';
        const R = [S * .19, S * .34, S * .43, S * .46][f];
        const inner = [0, 0, S * .17, S * .29][f];
        const rmp = heatOf(el);
        /* 프레임이 갈수록 심지가 식는다. 램프를 바깥쪽으로 밀어 내면
           흰 심지가 줄고 가장자리의 어두운 색이 안쪽까지 올라온다 —
           '커지면서 식는' 것이 폭발이다. 예전에는 띠가 셋뿐이라 그냥 커지기만 했다. */
        const shift = [0, .12, .3, .52][f];
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
          const a = Math.atan2(dy, dx);
          /* 정원이면 폭발이 아니라 공이다. 다만 주기가 낮으면 꽃잎이 된다 —
             주기를 올리고 진폭을 낮춰 '울퉁불퉁한 덩어리'로 만든다.
             속성마다 가장자리의 성격이 다르다 — 불은 뭉실, 얼음은 각지게. */
          const amp = el === 'frost' ? .16 : el === 'fire' ? .13 : el === 'blood' ? .17 : .08;
          const freq = el === 'frost' ? 6 : el === 'fire' ? 9 : 7;
          const lump = 1 + Math.sin(a * freq + f * 1.3) * amp
                         + Math.sin(a * 11 - f * 2) * .05
                         + Math.sin(a * 3 + f) * .05;
          const rr = R * lump, ir = inner * lump;
          if (d > rr || d < ir) continue;
          const t = (d - ir) / Math.max(1, rr - ir);
          /* 두 가지를 안 하면 폭발이 과녁이 된다.

             ① 띠를 고르게 나누면 안 된다. 실제로는 뜨거운 심지가 넓고 식은 테가 얇다 —
                t 를 그대로 쓰면 폭이 같은 고리 일곱이 되어 표적판이 나온다(그렇게 나왔다).
                제곱을 먹여 안쪽을 넓히고 바깥을 좁힌다.
             ② 띠 경계가 완전한 원이면 안 된다. 띠마다 다른 위상으로 흔들어
                경계가 서로 어긋나게 한다. 한 위상으로 흔들면 꽃잎이 된다. */
          const wob = Math.sin(a * 5 + f * 2) * .05 + Math.sin(a * 9 - f * 3) * .035
                    + Math.sin(a * 2 + f * 1.7) * .03;
          const u = Math.min(.999, Math.max(0, shift + Math.pow(t, 1.65) * (1 - shift) + wob));
          g[y][x] = rmp[Math.floor(u * rmp.length)];
        }
        /* 식은 연기. 불·물리·흡혈만 연기가 난다 — 얼음과 번개와 신성은 연기가 안 맞는다. */
        if ((el === 'fire' || el === 'physical' || el === 'blood') && f === 3) {
          /* 연기는 마지막 프레임에만, 작게. 크게 두르면 고리를 덮어 회색 도넛이 된다. */
          for (let i = 0; i < 6; i++) {
            const a = i * 2.6 + f * .6, d = R * (1.06 + (i % 3) * .05);
            const rr = S * .035 * (.8 + (i % 4) * .1);
            ell(g, c + Math.cos(a) * d, c + Math.sin(a) * d, rr, rr * .8, '9');
            ell(g, c + Math.cos(a) * d - rr * .3, c + Math.sin(a) * d - rr * .3,
                rr * .5, rr * .4, '8');
          }
        }
        // 속성마다 고리 밖으로 뻗는 것이 다르다
        const spike = (n, len, th, ch, off) => {
          for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2 + off;
            const x0 = c + Math.cos(a) * R * .9, y0 = c + Math.sin(a) * R * .9;
            const x1 = c + Math.cos(a) * (R + len), y1 = c + Math.sin(a) * (R + len);
            line(g, x0, y0, x1, y1, ch, th);
          }
        };
        if (el === 'frost') { spike(8, S * .1 * (1 - f * .18), 3, 'C', f * .3);
                              spike(8, S * .07 * (1 - f * .18), 1, 'T', f * .3); }
        else if (el === 'holy') { spike(12, S * .13, 2, 'o', f * .2);
                                  spike(12, S * .09, 1, 'Z', f * .2); }
        else if (el === 'storm') {
          for (let i = 0; i < 6; i++) {                  // 고리를 가로지르는 방전
            const a = i / 6 * Math.PI * 2 + f * .7;
            let px1 = c + Math.cos(a) * R * .5, py1 = c + Math.sin(a) * R * .5, aa = a;
            for (let k = 0; k < 3; k++) {
              aa += (((i * 7 + k * 11 + f * 3) % 7) / 7 - .5) * 1.2;
              const x = px1 + Math.cos(aa) * R * .3, y = py1 + Math.sin(aa) * R * .3;
              line(g, px1, py1, x, y, k ? (k > 1 ? 'G' : 'T') : 'W', 2);
              px1 = x; py1 = y;
            }
          }
        }
        for (let i = 0; i < 11; i++) {                   // 튀는 파편
          const a = i / 11 * Math.PI * 2 + f * .5;
          const d = Math.min(R + S * .07 + f * S * .04, c - 1);
          if (el === 'blood') {
            const rr = 1 + (i % 3) * .8;
            ell(g, c + Math.cos(a) * d, c + Math.sin(a) * d, rr, rr, 'D');
            ell(g, c + Math.cos(a) * d - .4, c + Math.sin(a) * d - .4, rr * .55, rr * .55, 'B');
          } else {
            put(g, c + Math.cos(a) * d, c + Math.sin(a) * d, i % 3 ? rmp[1] : 'W');
            put(g, c + Math.cos(a) * (d + 1.6), c + Math.sin(a) * (d + 1.6), rmp[3]);
          }
        }
        return g;
      },

      // 시전 섬광 — 무기 끝에서 한 번 터진다
      cast(f, S, def) {
        const g = mk(S), c = (S - 1) / 2;
        const rmp = heatOf((def && def.el) || 'physical');
        const R = [4, 8, 11, 13][f], th = [3, 2, 2, 1][f];
        for (let i = 0; i < 8; i++) {                       // 갈래도 뿌리에서 끝으로 식는다
          const a = i / 8 * Math.PI * 2 + f * .2, L = R * (i % 2 ? .5 : 1);
          line(g, c, c, c + Math.cos(a) * L, c + Math.sin(a) * L, rmp[3], th + 1);
          line(g, c, c, c + Math.cos(a) * L * .8, c + Math.sin(a) * L * .8, rmp[2], th);
          line(g, c, c, c + Math.cos(a) * L * .5, c + Math.sin(a) * L * .5, rmp[1], Math.max(1, th - 1));
        }
        const cr = [4.5, 5.5, 3.5, 1.5][f];
        ell(g, c, c, cr, cr, rmp[3]);
        ell(g, c, c, cr * .78, cr * .78, rmp[2]);
        ell(g, c, c, cr * .55, cr * .55, rmp[1]);
        ell(g, c, c, cr * .3, cr * .3, 'W');
        return g;
      },

      /* 주인공 — 직업 4종 × 동작 4종.
         몬스터와 달리 단색이 아니다. 살·강철·가죽에 직업색(A)을 얹는다.
         항상 오른쪽을 보게 그리고, 왼쪽은 게임에서 flip 으로 뒤집는다.

         실패 기록: ① 망토를 몸 폭만큼 넓게 → 치마 ② 무기를 얇게 → 안 보인다
         ③ 영창에 두 팔을 올렸더니 → 살색 덩어리. 그래서 몸은 좁게(11px),
         무기는 굵고 밝게, 영창은 지팡이 끝 하나에 빛을 모은다. */
      /* 주인공 — 여기만 좌표계가 다르다.

         다른 실루엣은 32칸에 적고 원시함수가 2배로 늘리지만, 주인공은 64칸에 직접 적는다.
         화면에서 제일 오래 보는 것이라 여기에 제일 많이 그려 넣는다.

         몸을 조각으로 나누는 것이 핵심이다. 판 하나를 통째로 칠하면 앞치마가 되고,
         다리를 막대 하나로 두면 장화 신은 막대가 된다. 갑옷은 가슴판·허리띠·치마판,
         다리는 허벅지·무릎·정강이·장화로 나눈다. 조각 사이의 선이 형태를 만든다.

         빛은 왼쪽 위에서 온다 — lightMap 과 같은 방향이다. 그래서 손으로 넣는 광은
         전부 조각의 위·왼쪽 모서리에, 그늘은 오른쪽·아래에 놓는다. 둘이 어긋나면
         빛이 두 개 있는 것처럼 보인다. */
      hero(f, S, def) {
        const g = mk(S);
        const st = def.state, cl = def.cls;
        const cx = 30, feet = 57;

        // ── 세로 리듬 ── 발은 땅에 붙여 둔다. 같이 올리면 캐릭터가 뜬다.
        const bob = (st === 'walk' ? [0, -2, 0, -2] : st === 'idle' ? [0, 0, -1, 0]
          : st === 'cast' ? [0, -2, -3, -2] : [0, 0, 2, 0])[f];
        const sw = (st === 'walk' ? [6, 0, -6, 0] : st === 'attack' ? [2, 0, -4, -2]
          : [0, 0, 0, 0])[f];
        const flare = (st === 'walk' ? [6, 2, 8, 2] : st === 'attack' ? [0, 6, 12, 6]
          : st === 'cast' ? [4, 8, 10, 8] : [0, 0, 2, 0])[f];

        const ty = 22 + bob;            // 어깨선
        const waist = 35 + bob;
        const hip = 38 + bob;
        const hy = ty - 11;             // 머리 중심

        /* 직업마다 겉감이 다르다. 다섯 단계로 묶는다 —
           [몸통 · 빛 · 그늘 · 깊은그늘 · 광]. 셋만 두었을 때는 판마다 색이 두 개뿐이라
           갑옷이 색종이로 오려 붙인 것처럼 보였다. */
        const M5 = { paladin: ['M', 'H', 'm', 'e', 'X'], warrior: ['m', 'M', 'e', 'b', 'H'],
                     rogue: ['L', 'u', 'l', 'd', 'U'], mage: ['A', 'G', 'a', 't', 'T'] }[cl];
        const [ar, arHi, arLo, arDeep, arSpec] = M5;
        // 금은 직업을 가리지 않는다 — 성기사는 넓게, 나머지는 죔쇠와 못에만
        const GOLD = ['j', 'J', 'o', 'Z'];

        /* 판 한 장. 위·왼쪽에 광, 오른쪽에 그늘. 이 규칙 하나로 모든 조각이 같은 빛을 받는다.
           deep 을 주면 아래 모서리 한 줄을 한 단계 더 떨어뜨린다 — 판이 겹쳐 보인다. */
        const plate = (x0, y0, x1, y1, base, hi, lo, deep) => {
          rect(g, x0, y0, x1, y1, base);
          if (hi) { rect(g, x0, y0, x1 - 1, y0, hi); rect(g, x0, y0, x0, y1 - 1, hi); }
          if (lo) { rect(g, x1, y0 + 1, x1, y1, lo); rect(g, x0 + 1, y1, x1, y1, lo); }
          if (deep) rect(g, x0 + 1, y1, x1 - 1, y1, deep);
        };
        // 금 테두리 한 줄 — 갑옷 조각의 경계에 놓는다
        const trim = (x0, y0, x1, y1) => { rect(g, x0, y0, x1, y1, 'J'); rect(g, x0, y0, x1 - 1, y0, 'o'); };

        // ── 망토 ── 어깨에서 시작해야 '매달린 것'으로 보인다. 다리까지 덮으면 치마가 된다.
        if (cl !== 'mage') {
          const capeW = y => 4 + (y - ty + 2) / (feet - 3 - ty) * (5 + flare);
          for (let y = ty - 2; y <= feet - 5; y++) {
            const w = capeW(y);
            rect(g, cx - 4, y, cx - 4 - w, y, y > ty + 8 ? 'a' : 'A');
            rect(g, cx - 4 - w, y, cx - 4 - w, y, y > ty + 12 ? 't' : 'a');   // 바깥 끝은 더 깊게
          }
          /* 안감. 망토가 겉감 한 색이면 천이 아니라 판이다 —
             몸 쪽으로 접힌 면에 붉은 안감을 한 줄 넣으면 '뒤집힌 천'으로 읽힌다. */
          for (let y = ty + 2; y <= feet - 5; y++)
            rect(g, cx - 4, y, cx - 5, y, y > ty + 14 ? 'h' : 'i');
          for (const t of [.34, .68])   // 주름 두 줄 — 없으면 색종이가 된다
            for (let y = ty; y <= feet - 5; y++) {
              rect(g, cx - 4 - capeW(y) * t, y, cx - 4 - capeW(y) * t, y, 'a');
              rect(g, cx - 3 - capeW(y) * t, y, cx - 3 - capeW(y) * t, y, 'G');   // 주름의 볕 받는 쪽
            }
          rect(g, cx - 5, ty - 2, cx - 9, ty - 1, 'A');          // 어깨에 걸린 자리
          rect(g, cx - 5, ty - 2, cx - 9, ty - 2, 'T');
        }

        // ── 다리 ── 허벅지 · 무릎 · 정강이 · 장화. 네 조각이라야 다리로 읽힌다.
        for (const s2 of [-1, 1]) {
          const lx = cx + s2 * 5 + s2 * sw * .5;
          const legged = cl === 'rogue' || cl === 'warrior';       // 맨다리가 보이는 직업
          plate(lx - 3, hip, lx + 3, hip + 6, legged ? 'l' : ar, legged ? 'L' : arHi,
                'd', legged ? 'd' : arDeep);                                       // 허벅지
          plate(lx - 4, hip + 6, lx + 4, hip + 9, ar, arHi, arLo, arDeep);         // 무릎 보호대
          put(g, lx - 3, hip + 6, arSpec);                                          // 무릎의 광
          plate(lx - 3, hip + 9, lx + 3, 51, legged ? 's' : ar, legged ? 'S' : arHi,
                legged ? 'y' : arLo, legged ? 'y' : arDeep);                        // 정강이
          plate(lx - 4, 51, lx + 4, feet, 'L', 'u', 'l', 'd');                      // 장화
          rect(g, lx - 4, 51, lx + 4, 52, 'l');                                     // 장화 목
          rect(g, lx - 4, 52, lx + 4, 52, 'U');                                     // 목의 볕
          rect(g, lx - 4, feet, lx + 4, feet, 'd');                                 // 바닥에 닿는 창
          put(g, lx + 2, 53, 'J');                                                  // 장화 죔쇠
        }

        // ── 몸통 ──
        if (cl === 'mage') {                       // 로브 — 어깨에서 발까지 한 벌로 떨어진다
          for (let y = ty + 1; y <= feet - 2; y++) {
            const t = (y - ty) / (feet - 2 - ty);
            const w = 7 + t * t * 9;
            rect(g, cx - w, y, cx + w, y, 'A');
            rect(g, cx - w, y, cx - w + 1, y, 'G');              // 왼쪽 빛
            rect(g, cx - w, y, cx - w, y, 'T');                  // 그 바깥 한 줄은 더 밝게
            rect(g, cx + w - 1, y, cx + w, y, 'a');              // 오른쪽 그늘
            rect(g, cx + w, y, cx + w, y, 't');                  // 끝은 깊게
          }
          for (const t2 of [-.55, .1, .62])                       // 주름 — 그늘과 볕을 붙여 세운다
            for (let y = waist; y <= feet - 3; y++) {
              const t = (y - ty) / (feet - 2 - ty), w = 7 + t * t * 9;
              rect(g, cx + w * t2, y, cx + w * t2, y, 'a');
              rect(g, cx + w * t2 - 1, y, cx + w * t2 - 1, y, 'G');
            }
          /* 밑단의 금 자수. 로브가 한 색으로 떨어지면 목욕가운이다 —
             단이 있어야 '지어 입은 옷'이 된다. */
          for (let y = feet - 5; y <= feet - 3; y++) {
            const t = (y - ty) / (feet - 2 - ty), w = 7 + t * t * 9;
            rect(g, cx - w, y, cx + w, y, y === feet - 5 ? 'o' : 'J');
          }
          for (let i = -2; i <= 2; i++) put(g, cx + i * 5, feet - 4, 'Z');   // 단의 무늬
        } else {
          /* 어깨 8 → 허리 6 으로 좁아진다. 폭이 같으면 사람이 아니라 상자다. */
          for (let y = ty + 1; y <= waist; y++) {
            const w = 8 - (y - ty - 1) / (waist - ty - 1) * 2;
            rect(g, cx - w, y, cx + w, y, ar);
            rect(g, cx - w, y, cx - w + 1, y, arHi);
            rect(g, cx - w, y, cx - w, y, arSpec);                 // 왼쪽 모서리의 광
            rect(g, cx + w - 1, y, cx + w, y, arLo);
            rect(g, cx + w, y, cx + w, y, arDeep);
          }
          ell(g, cx, ty + 3, 8, 5, ar);                            // 가슴의 부풀린 면
          ell(g, cx - 2, ty + 2, 6, 3, arHi);
          rect(g, cx - 8, ty + 1, cx - 7, ty + 5, arHi);
          if (cl === 'warrior') {
            /* 사슬. 예전엔 어두운 점 하나였는데 32px 에서는 그냥 얼룩이었다 —
               고리는 어두운 자리와 밝은 자리가 붙어 있어야 고리로 읽힌다. */
            for (let y = ty + 3; y <= waist - 2; y += 2)
              for (let x = cx - 6 + ((y & 2) ? 1 : 0); x <= cx + 5; x += 3) {
                put(g, x, y, 'b'); put(g, x + 1, y, 'M');   // 어두운 자리와 밝은 자리를 붙여야 고리로 읽힌다
              }
          }
        }

        // 직업 표식
        if (cl === 'paladin') {
          /* 금을 넓게 칠했더니 성기사가 통째로 금덩이가 됐다 — 직업색이 이미 금빛이라
             갑옷·망토·십자가 한 색으로 붙어 버린다. 금은 '테두리'로만 쓴다.
             넓은 면은 흰 강철로 두고, 대비는 망토 안감의 붉은색이 맡는다. */
          trim(cx - 8, ty + 1, cx + 8, ty + 1);                   // 가슴판 윗단의 금
          rect(g, cx - 1, ty + 3, cx + 1, waist - 2, 'J');        // 가슴 십자
          rect(g, cx - 5, ty + 7, cx + 5, ty + 9, 'J');
          rect(g, cx, ty + 3, cx, waist - 3, 'o');
          rect(g, cx - 4, ty + 8, cx + 4, ty + 8, 'o');
          rect(g, cx - 1, ty + 3, cx - 1, waist - 3, 'j');        // 십자의 그늘 쪽
          rect(g, cx - 5, ty + 9, cx + 5, ty + 9, 'j');
          put(g, cx, ty + 3, 'Z');
        } else if (cl === 'warrior') {
          /* 어깨 갑판. 타원 하나에 흰 띠를 얹었더니 널빤지가 됐다 —
             밑에 어두운 타원을 깔고 아래쪽에 그늘을 둬야 둥근 판으로 선다. */
          for (const s2 of [-1, 1]) {
            const px2 = cx + s2 * 9;
            ell(g, px2, ty + 4, 5.6, 4.4, 'O');
            ell(g, px2, ty + 2.5, 5, 4, 'm');
            ell(g, px2 - s2, ty + 1.5, 4.2, 3, 'M');
            ell(g, px2 - s2 * 2, ty + .5, 2.6, 1.6, 'H');
            rect(g, px2 - 3, ty - 1, px2 + 2, ty, 'X');           // 윗면 광
            ell(g, px2, ty + 5.5, 4.6, 1.6, 'b');                 // 아래 그늘 — 무쇠로
            put(g, px2 + s2 * 4, ty + 1, 'o');                    // 금 못
            put(g, px2 - s2 * 3, ty + 3, 'o');
          }
          rect(g, cx - 7, ty + 8, cx + 7, ty + 9, 'L');           // 가죽끈
          rect(g, cx - 7, ty + 8, cx + 7, ty + 8, 'u');
          rect(g, cx - 7, ty + 10, cx + 7, ty + 10, 'd');
          rect(g, cx - 2, ty + 8, cx + 2, ty + 9, 'J');           // 끈의 금 고리
        } else if (cl === 'rogue') {
          line(g, cx - 6, waist - 2, cx + 6, ty + 2, 'A', 3);     // 가슴을 지르는 띠
          line(g, cx - 6, waist - 3, cx + 6, ty + 1, 'G', 1);
          line(g, cx - 6, waist - 1, cx + 6, ty + 3, 't', 1);
          for (let i = 0; i < 3; i++) {                           // 던지는 칼 세 자루
            rect(g, cx + 2 + i * 3, ty + 3, cx + 2 + i * 3, ty + 5, 'M');
            put(g, cx + 2 + i * 3, ty + 3, 'H');
            put(g, cx + 2 + i * 3, ty + 6, 'J');                  // 자루의 금테
          }
        }

        // ── 허리띠 ── 갑옷과 다리를 갈라 주는 선. 없으면 몸이 한 통이 된다.
        if (cl !== 'mage') {
          plate(cx - 8, waist, cx + 8, waist + 2, 'L', 'U', 'l', 'd');
          rect(g, cx - 3, waist, cx + 3, waist + 2, 'J');         // 버클
          rect(g, cx - 3, waist, cx + 2, waist, 'o');
          rect(g, cx - 1, waist + 1, cx + 1, waist + 1, 'Z');
          if (cl === 'paladin' || cl === 'warrior')               // 치마판 세 장
            for (let i = -1; i <= 1; i++) {
              const y1 = waist + 3 + (i ? 3 : 4);
              plate(cx + i * 5 - 2, waist + 3, cx + i * 5 + 2, y1, ar, arHi, arLo, arDeep);
              rect(g, cx + i * 5 - 2, y1, cx + i * 5 + 2, y1, 'J');   // 판 끝의 금단
            }
        }

        // ── 목 ── 없으면 머리가 어깨에 얹힌 공이 된다
        rect(g, cx - 2, ty - 3, cx + 2, ty + 1, 's');
        rect(g, cx - 2, ty - 3, cx - 2, ty, 'S');
        rect(g, cx + 2, ty - 3, cx + 2, ty + 1, 'y');            // 턱이 지우는 그늘

        // ── 머리 ──
        if (cl === 'paladin') {
          ell(g, cx, hy, 7, 7, 'M');                              // 투구
          rect(g, cx - 6, hy - 1, cx + 6, hy + 7, 'M');
          ell(g, cx - 2, hy - 2, 5, 4, 'H');                      // 정수리에 도는 빛
          rect(g, cx - 7, hy - 1, cx - 6, hy + 4, 'X');           // 왼쪽 광
          rect(g, cx + 7, hy, cx + 7, hy + 5, 'e');
          rect(g, cx + 6, hy + 4, cx + 7, hy + 7, 'e');
          trim(cx - 6, hy - 5, cx + 6, hy - 4);                   // 금 이마띠
          rect(g, cx - 6, hy + 1, cx + 6, hy + 3, 'O');           // 눈매
          rect(g, cx - 1, hy - 4, cx + 1, hy + 8, 'M');           // 코가리개
          rect(g, cx - 1, hy + 1, cx - 1, hy + 3, 'H');
          rect(g, cx - 6, hy + 5, cx + 6, hy + 8, 'M');           // 볼가리개
          rect(g, cx - 6, hy + 5, cx + 6, hy + 5, 'm');
          rect(g, cx - 6, hy + 8, cx + 6, hy + 8, 'e');
          rect(g, cx - 5, hy + 6, cx - 4, hy + 7, 'J');           // 볼가리개의 못
          rect(g, cx + 4, hy + 6, cx + 5, hy + 7, 'J');
          eyes(g, cx + 2, hy + 2, 3, 'T', 1);
          /* 깃털. 위로 세우면 판을 넘어 잘리고(예전 그림이 그랬다),
             굵은 한 획으로 뒤로 눕히면 바나나가 된다. 가늘어지는 여러 가닥으로 나눈다. */
          const pt = Math.max(1, hy - 9), wag = (f & 1) * 2;
          rect(g, cx - 2, hy - 8, cx + 1, hy - 6, 'A');            // 꽂힌 자리
          for (let i = 0; i < 3; i++) {
            const t0 = i * .18;
            line(g, cx - 1 - t0 * 6, hy - 7 - i, cx - 9 - i * 2 - wag, pt + 1 + i * 3,
                 i === 0 ? 'G' : 'A', 3 - i);
          }
          line(g, cx - 3, hy - 8, cx - 10 - wag, pt + 2, 'G', 1);
        } else if (cl === 'warrior') {
          ell(g, cx, hy + 1, 6.5, 6.5, 'S');                      // 얼굴
          ell(g, cx - 2, hy, 4, 3.4, 'Y');                        // 이마·광대의 볕
          rect(g, cx + 4, hy - 1, cx + 6, hy + 5, 's');           // 오른뺨 그늘
          rect(g, cx + 6, hy, cx + 6, hy + 4, 'y');
          rect(g, cx - 7, hy - 5, cx + 7, hy - 1, 'm');           // 투구
          ell(g, cx, hy - 2, 7, 5, 'm');
          ell(g, cx - 2, hy - 3, 4.4, 2.6, 'M');
          rect(g, cx - 7, hy - 4, cx - 6, hy - 1, 'H');
          trim(cx - 7, hy - 1, cx + 7, hy - 1);                   // 투구 아래 금테
          rect(g, cx - 7, hy, cx + 7, hy, 'e');
          /* 뿔을 강철로 두면 투구와 한 덩어리가 된다. 뼈는 이 화면에서
             유일한 중립색이라, 그것만으로 '뿔'이 떨어져 나온다. */
          for (const s2 of [-1, 1]) {
            line(g, cx + s2 * 6, hy - 4, cx + s2 * 11, hy - 9, 'E', 3);
            line(g, cx + s2 * 6, hy - 5, cx + s2 * 10, hy - 9, 'F', 1);
            line(g, cx + s2 * 11, hy - 9, cx + s2 * 13, hy - 12, 'E', 2);
            put(g, cx + s2 * 13, hy - 13, 'F');
            put(g, cx + s2 * 6, hy - 3, 'J');                     // 뿔을 무는 금테
          }
          eyes(g, cx + 1, hy + 1, 3, 'O', 2);
          put(g, cx - 3, hy + 1, 'W'); put(g, cx + 4, hy + 1, 'W');   // 눈의 빛
          /* 수염이 얼굴을 다 덮으면 갈색 덩어리가 된다. 턱 아래만 남긴다. */
          rect(g, cx - 5, hy + 5, cx + 5, hy + 8, 'L');
          rect(g, cx - 5, hy + 5, cx - 3, hy + 7, 'u');           // 볕 받는 쪽
          rect(g, cx + 3, hy + 6, cx + 5, hy + 8, 'l');
          rect(g, cx - 1, hy + 4, cx + 3, hy + 5, 'l');            // 콧수염
          rect(g, cx - 3, hy + 8, cx + 3, hy + 9, 'L');
          rect(g, cx - 3, hy + 9, cx + 3, hy + 9, 'd');
        } else if (cl === 'rogue') {
          ell(g, cx, hy + 1, 6, 6, 'S');
          /* 두건을 가죽색으로 두면 조끼·바지와 합쳐져 갈색 덩어리 하나가 된다.
             직업색을 넓은 면에 얹어야 32px 에서 '추적자'로 읽힌다.
             다만 직업색 원본(#8ef0b0)을 그대로 칠하면 민트색 머리카락이 된다 —
             천은 어두운 면이 기본이고 밝은 색은 빛 받는 모서리에만 온다. */
          ell(g, cx, hy - 1, 7, 7, 'a');                          // 두건
          rect(g, cx - 7, hy - 1, cx + 7, hy + 2, 'a');
          rect(g, cx - 6, hy - 8, cx + 3, hy - 6, 'a');           // 정수리 각
          rect(g, cx + 6, hy - 3, cx + 7, hy + 2, 't');           // 오른쪽 깊은 그늘
          rect(g, cx - 7, hy - 4, cx - 5, hy + 2, 'A');           // 왼쪽 빛
          rect(g, cx - 5, hy - 7, cx + 2, hy - 6, 'A');
          rect(g, cx - 7, hy - 4, cx - 7, hy + 1, 'G');
          put(g, cx - 6, hy - 6, 'T');                            // 정수리 모서리의 광
          rect(g, cx - 6, hy + 1, cx + 6, hy + 2, 'd');           // 두건 앞단 — 얼굴에 그늘
          rect(g, cx - 4, hy + 2, cx + 6, hy + 3, 'd');
          rect(g, cx - 1, hy + 1, cx + 6, hy + 4, 'S');           // 드러난 눈매·턱
          rect(g, cx - 1, hy + 1, cx + 2, hy + 1, 'Y');
          rect(g, cx + 5, hy + 1, cx + 6, hy + 4, 's');
          put(g, cx + 6, hy + 3, 'y');
          rect(g, cx - 1, hy + 5, cx + 6, hy + 6, 'l');           // 입가리개
          rect(g, cx - 1, hy + 5, cx + 5, hy + 5, 'L');
          eyes(g, cx + 3, hy + 2, 2, 'O', 2);
          put(g, cx + 4, hy + 2, 'T');
          /* 꼬리를 옆으로 뻗으면 새 부리가 된다. 짧게, 아래로 늘어뜨린다. */
          line(g, cx - 6, hy + 3, cx - 9 - flare * .4, hy + 9 + flare * .5, 'a', 3);
          line(g, cx - 7, hy + 2, cx - 9 - flare * .4, hy + 7 + flare * .5, 'A', 1);
        } else {
          ell(g, cx, hy + 2, 5.5, 5.5, 'S');                      // 얼굴
          rect(g, cx - 3, hy + 1, cx, hy + 2, 'Y');
          rect(g, cx + 3, hy, cx + 5, hy + 6, 's');
          rect(g, cx + 5, hy + 1, cx + 5, hy + 5, 'y');
          /* 수염을 강철색으로 두면 얼굴 밑에 판을 댄 것 같다. 상아가 따뜻해서 털로 읽힌다. */
          rect(g, cx - 5, hy + 4, cx + 4, hy + 10, 'F');          // 흰 수염
          rect(g, cx - 5, hy + 4, cx - 3, hy + 9, 'E');
          rect(g, cx + 2, hy + 6, cx + 4, hy + 10, 'E');
          rect(g, cx - 3, hy + 10, cx + 2, hy + 11, 'F');
          rect(g, cx - 1, hy + 11, cx + 1, hy + 12, 'E');         // 수염 끝
          eyes(g, cx + 1, hy + 1, 3, 'O', 2);
          rect(g, cx - 8, hy - 2, cx + 8, hy, 'A');               // 모자 챙
          rect(g, cx - 8, hy - 2, cx + 7, hy - 2, 'G');
          rect(g, cx - 8, hy - 2, cx - 6, hy - 2, 'T');
          rect(g, cx - 7, hy, cx + 8, hy, 't');
          trim(cx - 7, hy - 1, cx + 7, hy - 1);                   // 챙 위의 금띠
          for (let i = 0; i <= 14; i++) {                         // 고깔
            const w = 6.2 - i * .42, yy = hy - 3 - i;
            if (w < 0 || yy < 1) break;
            rect(g, cx - w + i * .35, yy, cx + w + i * .35, yy, 'A');
            rect(g, cx - w + i * .35, yy, cx - w + i * .35 + 1, yy, 'G');
            rect(g, cx + w + i * .35, yy, cx + w + i * .35, yy, 't');
            if (i === 5 || i === 9) rect(g, cx - w + i * .35, yy, cx + w + i * .35, yy, 'J');   // 두른 띠
          }
          for (const [ix, iy] of [[-2, -7], [2, -10], [-1, -12]])  // 고깔의 별
            put(g, cx + ix, hy + iy, 'Z');
          put(g, cx + 5, hy - 15, 'o'); put(g, cx + 5, hy - 16, 'Z');
        }

        /* ── 손 위치와 무기 각도 ── [x, y, 각도] · 전부 예전 32칸 값의 두 배 */
        const POSE = {
          idle: [[10, waist - 10, .50], [10, waist - 10, .45], [10, waist - 12, .55], [10, waist - 10, .45]],
          walk: [[12, waist - 12, .35], [10, waist - 10, .55], [8, waist - 10, .40], [10, waist - 12, .50]],
          attack: [[2, ty - 4, -2.2], [12, ty + 2, -0.9], [8, waist - 10, 0.15], [12, waist - 4, 0.9]],
          cast: [[8, ty, -0.95], [8, ty - 2, -0.98], [8, ty - 2, -1.00], [8, ty - 2, -0.98]],
        }[st][f];
        // 평상시 자세는 직업마다 다르다. 도끼를 수평으로 들면 걸레가 되고
        // 지팡이를 수평으로 들면 빗자루가 된다.
        const rest = (st === 'idle' || st === 'walk')
          ? (cl === 'mage' ? -1.45 : cl === 'warrior' ? -0.60 : 0) : 0;
        const hx = cx + POSE[0] + (rest && cl === 'mage' ? 4 : 0), hh = POSE[1];
        const ang = rest || POSE[2];
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const px = -dy, py = dx;                                  // 무기 축의 수직

        // ── 팔 ── 위팔·아래팔을 나누고 어깨에 판을 얹는다
        // 마법사 소매를 로브와 같은 색으로 두면 팔이 통째로 안 보인다 — 한 단계 어둡게
        const sleeve = cl === 'warrior' ? 'S' : cl === 'mage' ? 'a' : ar;
        const sleeveHi = cl === 'warrior' ? 'S' : cl === 'mage' ? 'A' : arHi;
        const ex = cx + 7, ey = ty + 7;                           // 팔꿈치
        line(g, cx + 5, ty + 3, ex, ey, sleeve, 4);
        line(g, ex, ey, hx, hh, sleeve, 3);
        line(g, cx + 5, ty + 2, ex, ey - 1, sleeveHi, 1);
        line(g, cx + 6, ty + 5, ex + 1, ey + 1, cl === 'warrior' ? 'y' : arLo, 1);   // 팔 아래 그늘
        put(g, ex, ey, cl === 'warrior' ? 's' : arLo);            // 팔꿈치 마디
        /* 어깨판이 몸통과 같은 색이면 통째로 사라진다(성기사가 그랬다).
           밑에 어두운 타원을 먼저 깔면 그 테두리가 삐져나와 판을 떼어 놓는다. */
        if (cl !== 'warrior' && cl !== 'mage') {
          for (const s2 of [-1, 1]) {
            const px2 = cx + s2 * 8;
            ell(g, px2, ty + 4.5, 4.8, 3.8, 'O');
            ell(g, px2, ty + 3, 4.5, 3.5, ar);
            ell(g, px2 - 1, ty + 2, 3, 2, arHi);
            rect(g, px2 - s2 * 3 - 1, ty, px2 + s2 * 3, ty + 1, arHi);
            rect(g, px2 - 3, ty + 5, px2 + 3, ty + 5, arLo);      // 아래 모서리
            put(g, px2 + s2 * 3, ty + 3, 'J');                    // 금 못
          }
        }
        rect(g, hx - 2, hh - 2, hx + 2, hh + 2, 'L');             // 장갑
        rect(g, hx - 2, hh - 2, hx + 1, hh - 2, 'U');
        rect(g, hx - 2, hh + 2, hx + 2, hh + 2, 'd');
        put(g, hx + 2, hh - 1, 'J');                              // 손등의 금판

        // ── 무기 ── 자루·손잡이·날을 나눈다. 막대 하나면 막대로 보인다.
        if (cl === 'paladin') {
          // 방패 — 예전엔 몸통에 겹쳐 통째로 사라졌다. 바깥으로 뺀다.
          const sx = cx - 12, sy = ty + 6;
          ell(g, sx, sy, 6, 8, 'J');                              // 금 테두리
          rect(g, sx - 6, sy - 8, sx + 6, sy - 6, 'J');
          ell(g, sx, sy, 4.8, 6.8, 'M');                          // 강철 면
          rect(g, sx - 5, sy - 7, sx + 5, sy - 5, 'M');
          ell(g, sx, sy, 3.6, 5.4, 'm');                          // 안쪽 그늘
          rect(g, sx - 1, sy - 6, sx + 1, sy + 6, 'J');           // 금 십자
          rect(g, sx - 4, sy - 2, sx + 4, sy, 'J');
          rect(g, sx, sy - 6, sx, sy + 5, 'o');
          rect(g, sx - 4, sy - 1, sx + 3, sy - 1, 'o');
          ell(g, sx, sy - 1, 1.8, 1.8, 'Z');                      // 보스
          rect(g, sx - 6, sy - 7, sx - 5, sy + 3, 'Z');           // 테두리 빛
          rect(g, sx + 5, sy - 2, sx + 6, sy + 5, 'j');           // 테두리 그늘
          // 검 — 자루·코등이·날·혈조
          line(g, hx - dx * 5, hh - dy * 5, hx + dx * 2, hh + dy * 2, 'L', 3);   // 손잡이
          line(g, hx - dx * 5 - px, hh - dy * 5 - py, hx + dx * 2 - px, hh + dy * 2 - py, 'u', 1);
          ell(g, hx - dx * 6, hh - dy * 6, 2, 2, 'o');                            // 자루 끝 — 금
          put(g, hx - dx * 6 - px, hh - dy * 6 - py, 'Z');
          line(g, hx + dx * 2 - px * 5, hh + dy * 2 - py * 5,
                  hx + dx * 2 + px * 5, hh + dy * 2 + py * 5, 'J', 3);            // 코등이 — 금
          line(g, hx + dx * 1 - px * 5, hh + dy * 1 - py * 5,
                  hx + dx * 1 + px * 5, hh + dy * 1 + py * 5, 'o', 1);
          line(g, hx + dx * 3, hh + dy * 3, hx + dx * 22, hh + dy * 22, 'M', 4);  // 날
          line(g, hx + dx * 4, hh + dy * 4, hx + dx * 20, hh + dy * 20, 'm', 1);  // 혈조
          line(g, hx + dx * 4 - px, hh + dy * 4 - py,
                  hx + dx * 21 - px, hh + dy * 21 - py, 'X', 1);                  // 날의 광
          line(g, hx + dx * 5 + px, hh + dy * 5 + py,
                  hx + dx * 20 + px, hh + dy * 20 + py, 'e', 1);                  // 날의 그늘
        } else if (cl === 'warrior') {
          line(g, hx - dx * 8, hh - dy * 8, hx + dx * 16, hh + dy * 16, 'L', 4);  // 자루
          line(g, hx - dx * 8 - px, hh - dy * 8 - py, hx + dx * 16 - px, hh + dy * 16 - py, 'u', 1);
          line(g, hx - dx * 8 + px, hh - dy * 8 + py, hx + dx * 16 + px, hh + dy * 16 + py, 'd', 1);
          for (let k = -6; k <= 12; k += 5)                        // 감은 가죽끈
            line(g, hx + dx * k - px * 2, hh + dy * k - py * 2,
                    hx + dx * k + px * 2, hh + dy * k + py * 2, 'l', 1);
          const ax = hx + dx * 15, ay = hh + dy * 15;
          line(g, ax - dx * 2 - px * 3, ay - dy * 2 - py * 3,
                  ax - dx * 2 + px * 3, ay - dy * 2 + py * 3, 'J', 2);             // 도끼 목테 — 금
          for (const sg of [-1, 1]) {                             // 양날 도끼
            line(g, ax + px * sg * 2, ay + py * sg * 2, ax + px * sg * 8, ay + py * sg * 8, 'b', 3);
            line(g, ax + dx * 5 + px * sg * 6, ay + dy * 5 + py * sg * 6,
                    ax - dx * 4 + px * sg * 6, ay - dy * 4 + py * sg * 6, 'm', 3);
            line(g, ax + dx * 5 + px * sg * 7, ay + dy * 5 + py * sg * 7,
                    ax - dx * 4 + px * sg * 7, ay - dy * 4 + py * sg * 7, 'M', 3);
            line(g, ax + dx * 5 + px * sg * 8, ay + dy * 5 + py * sg * 8,
                    ax - dx * 4 + px * sg * 8, ay - dy * 4 + py * sg * 8, 'X', 1);
          }
          ell(g, ax + dx * 4, ay + dy * 4, 2, 2, 'o');            // 자루 끝 못 — 금
        } else if (cl === 'rogue') {
          line(g, hx - dx * 4, hh - dy * 4, hx + dx * 2, hh + dy * 2, 'L', 3);   // 손잡이
          line(g, hx - dx * 4 - px, hh - dy * 4 - py, hx + dx * 2 - px, hh + dy * 2 - py, 'u', 1);
          line(g, hx + dx * 2 - px * 3, hh + dy * 2 - py * 3,
                  hx + dx * 2 + px * 3, hh + dy * 2 + py * 3, 'J', 2);            // 코등이 — 금
          line(g, hx + dx * 3, hh + dy * 3, hx + dx * 15, hh + dy * 15, 'M', 3);  // 날
          line(g, hx + dx * 4 - px, hh + dy * 4 - py,
                  hx + dx * 14 - px, hh + dy * 14 - py, 'X', 1);
          line(g, hx + dx * 4 + px, hh + dy * 4 + py,
                  hx + dx * 13 + px, hh + dy * 13 + py, 'm', 1);
          /* 왼손 단검을 오른손과 같은 각도로 두면 양팔을 벌린 T 자세가 된다.
             역수로 잡아 날이 아래·뒤를 향하게 한다 — 추적자의 자세는 그쪽이다. */
          const bx = cx - 9, bb = ty + 8, ba = 2.5 - (st === 'attack' ? f * .35 : 0);
          const bdx = Math.cos(ba), bdy = Math.sin(ba);
          line(g, bx - bdx * 4, bb - bdy * 4, bx + bdx * 2, bb + bdy * 2, 'L', 3);
          put(g, bx + bdx * 2, bb + bdy * 2, 'J');
          line(g, bx + bdx * 2, bb + bdy * 2, bx + bdx * 13, bb + bdy * 13, 'M', 3);
          line(g, bx + bdx * 3 + bdy, bb + bdy * 3 - bdx,
                  bx + bdx * 12 + bdy, bb + bdy * 12 - bdx, 'X', 1);
        } else {
          line(g, hx - dx * 7, hh - dy * 7, hx + dx * 16, hh + dy * 16, 'L', 4);  // 지팡이
          line(g, hx - dx * 7 - px, hh - dy * 7 - py, hx + dx * 16 - px, hh + dy * 16 - py, 'u', 1);
          line(g, hx - dx * 7 + px, hh - dy * 7 + py, hx + dx * 16 + px, hh + dy * 16 + py, 'd', 1);
          for (let i = -1; i <= 1; i++)                             // 감은 끈
            line(g, hx + dx * (i * 4) - px * 2, hh + dy * (i * 4) - py * 2,
                    hx + dx * (i * 4 + 1) + px * 2, hh + dy * (i * 4 + 1) + py * 2, 'd', 1);
          const ox2 = hx + dx * 19, oy2 = hh + dy * 19;
          // 보석을 감싸는 발톱 — 구슬만 두면 사탕이 된다. 금이라야 지팡이로 읽힌다
          for (const sg of [-1, 1]) {
            line(g, ox2 + px * sg * 4, oy2 + py * sg * 4,
                    ox2 - dx * 4 + px * sg * 3, oy2 - dy * 4 + py * sg * 3, 'J', 2);
            put(g, ox2 + px * sg * 4, oy2 + py * sg * 4, 'o');
          }
          line(g, ox2 - dx * 5 - px * 3, oy2 - dy * 5 - py * 3,
                  ox2 - dx * 5 + px * 3, oy2 - dy * 5 + py * 3, 'J', 2);            // 목테
          const R = st === 'cast' ? [5, 6.4, 7.6, 6.4][f] : 5;
          ell(g, ox2, oy2, R, R, 'a');
          ell(g, ox2, oy2, R * .82, R * .82, 'A');
          ell(g, ox2 - R * .18, oy2 - R * .18, R * .58, R * .58, 'G');
          ell(g, ox2 - R * .3, oy2 - R * .3, R * .3, R * .3, 'T');
          ell(g, ox2 - R * .38, oy2 - R * .38, R * .16, R * .16, 'W');
        }

        outline(g);

        // ── 내부 경계 ── 윤곽은 겉만 잡는다. 안쪽도 갈라줘야 형태가 읽힌다.
        rect(g, cx, hip + 1, cx, feet - 6, 'O');                  // 두 다리 사이
        if (cl !== 'mage') rect(g, cx - 8, waist - 1, cx + 8, waist - 1, 'O');

        // ── 동작 효과 ── 휘두른 자취 · 영창의 빛 (윤곽 뒤라 지워지지 않는다)
        if (st === 'attack' && f >= 1 && f <= 2) {
          const a0 = f === 1 ? -1.5 : -.7, a1 = f === 1 ? -.2 : .9;
          const R = f === 1 ? 24 : 28;
          for (let i = 0; i <= 40; i++) {
            const a = a0 + (a1 - a0) * i / 40;
            const r2 = R - (i % 5 === 0 ? 2 : 0);
            put(g, cx + 4 + Math.cos(a) * r2, ty + 6 + Math.sin(a) * r2, i % 3 === 2 ? 'W' : 'G');
          }
        }
        if (st === 'cast') {
          const R2 = [3, 4.5, 6, 4.5][f];                         // 치켜든 무기 앞의 빛
          const tx = cx + 17, tt = ty - 19;    // 머리에 겹치면 등불을 든 것으로 보인다
          ell(g, tx, tt, R2, R2, 'G'); ell(g, tx, tt, R2 * .5, R2 * .5, 'W');
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2 + f * .4;
            put(g, tx + Math.cos(a) * (R2 + 3), tt + Math.sin(a) * (R2 + 3), 'W');
          }
          const R = [6, 10, 14, 10][f];                           // 발밑 마법진
          for (let i = 0; i < 36; i++) {
            const a = i / 36 * Math.PI * 2;
            put(g, cx + Math.cos(a) * R * 1.6, feet - 1 + Math.sin(a) * R * .45,
              i % 3 === 0 ? 'W' : 'G');
          }
          for (let i = 0; i < 5; i++)                             // 떠오르는 불티
            put(g, cx - 14 + i * 10, ty - 8 - ((f * 6 + i * 10) % 18), 'G');
        }
        return g;
      },
      /* 보스 — 128칸에 직접 그린다(주인공과 같은 갈래).

         예전 보스는 몸 전체가 def.color 한 색이었다. 확대해 보면 색종이로 오린 나방이다.
         덩치는 있는데 아무 재질도 없으니 '큰 몹'이지 '보스'가 아니었다.

         세 재질로 나눈다 —
           천(C·B·D·c 네 단계) · 갑옷(Q·q, 채도를 죽인 두 단계) · 뼈(F·E, 유일한 중립색).
         갑옷을 진짜 강철로 두면 보스 넷이 다 같아 보인다. 색은 남기고 채도만 죽였다.

         여기까지 오면서 세 번 다시 그렸다. 배운 것:

         ① **부위마다 어두운 경계를 먼저 깔아야 판이 판으로 읽힌다.**
            갑옷이 전부 q 한 톤이라 어깨판·팔·몸통이 한 덩어리가 됐다 — 팔이 통째로 사라졌다.
            edged/edgedLine 이 그것이다.

         ② **뼈에는 예산이 있다.** 뼈는 이 그림에서 대비가 가장 센 색이다.
            뿔·어깨가시·발톱·엄니 네 군데에 다 쓰고 전부 바깥 모서리에 두었더니 벌레가 됐다.
            지금은 뿔과 엄니, 그리고 발톱 끝에만 쓴다. 어깨 가시는 갑옷색이다.

         ③ **위엄은 실루엣의 비례에서 온다.** 어깨와 팔을 넓히면 넓힐수록 정사각형이 되고,
            정사각형은 크기와 무관하게 위엄이 없다. 위는 좁게(뿔), 아래는 넓게(망토) —
            삼각형이라야 선다. 그래서 이제 가장 넓은 곳은 망토 아랫단이다.

         예전 실패 기록도 그대로 유효하다:
           ④ 망토를 넓게 → 드레스 ⑤ 팔을 망토 안에 → 개미
           ⑥ 어깨 가시를 여러 개 세우면 울타리(또는 이빨)가 된다 — 하나만. */
      boss(f, S) {
        const g = mk(S);
        const p = [0, 1, 2, 1][f];              // 숨 쉬는 리듬
        const sway = [0, 1, 0, -1][f];          // 천이 흔들린다
        const cx = 63;
        const sh = 62 + p;                      // 어깨선
        const hy = sh - 26;                     // 머리 중심
        const hem = 118;

        const plate = (x0, y0, x1, y1, base, hi, lo) => {
          rect(g, x0, y0, x1, y1, base);
          rect(g, x0, y0, x1 - 1, y0 + 1, hi); rect(g, x0, y0, x0 + 1, y1 - 1, hi);
          rect(g, x1 - 1, y0 + 2, x1, y1, lo); rect(g, x0 + 2, y1 - 1, x1, y1, lo);
        };
        const edged = (x0, y0, x1, y1, base, hi, lo, m = 2) => {
          rect(g, Math.min(x0, x1) - m, Math.min(y0, y1) - m,
                  Math.max(x0, x1) + m, Math.max(y0, y1) + m, 'O');
          plate(x0, y0, x1, y1, base, hi, lo);
        };
        const edgedLine = (x0, y0, x1, y1, ch, t) => {
          line(g, x0, y0, x1, y1, 'O', t + 4);
          line(g, x0, y0, x1, y1, ch, t);
        };

        // ── 망토 ── 가장 넓은 곳. 실루엣의 밑변이다.
        const capeW = y => 19 + Math.pow((y - sh) / (hem - sh), 1.5) * 25;
        for (let y = sh; y <= hem; y++) {
          const w = capeW(y);
          rect(g, cx - w, y, cx + w, y, 'D');
          rect(g, cx - w, y, cx - w + 3, y, 'B');            // 왼쪽 빛
          rect(g, cx - w, y, cx - w, y, 'C');
          rect(g, cx + w - 2, y, cx + w, y, 'c');            // 오른쪽 그늘
          rect(g, cx + w, y, cx + w, y, 't');
          // 안감 — 몸에 가려 접힌 안쪽 면. 붉은 한 줄이 갑옷의 채도를 살린다
          if (y > sh + 6) { rect(g, cx - 18, y, cx - 16, y, 'i'); rect(g, cx + 16, y, cx + 18, y, 'h'); }
        }
        for (const t of [-.66, -.3, .26, .64])               // 주름
          for (let y = sh + 8; y <= hem; y++) {
            const w = capeW(y), x = cx + w * t + sway * (y - sh) * .04;
            rect(g, x, y, x + 1, y, 'c');
            rect(g, x + 2, y, x + 3, y, 'B');                // 주름 옆면이 빛을 받는다
          }
        for (let x = cx - capeW(hem); x <= cx + capeW(hem); x++) {   // 해진 아랫단
          const h = 3 + Math.sin((x + f * 4) * .55) * 3 + Math.sin(x * 1.9) * 2;
          rect(g, x, hem, x, hem + h, 'c');
          rect(g, x, hem, x, hem + 1, 'D');
        }

        /* ── 팔 ── 망토 앞으로 내려온다. 팔꿈치를 너무 벌리면 게 집게가 된다 —
           손은 허리께에서 멈추고 발톱은 아래·안쪽을 향한다. */
        for (const s2 of [-1, 1]) {
          const ex = cx + s2 * 39, ey = sh + 24 + p;         // 팔꿈치
          const wx = cx + s2 * 41, wy = sh + 42 + p;         // 손목
          edgedLine(cx + s2 * 28, sh + 10, ex, ey, 'q', 11);
          edgedLine(ex, ey, wx, wy, 'q', 9);
          line(g, cx + s2 * 28, sh + 8, ex - s2 * 2, ey - 3, 'Q', 3);
          line(g, ex - s2 * 2, ey - 2, wx - s2 * 2, wy - 2, 'Q', 2);
          ell(g, ex + s2, ey + 1, 8, 7, 'O');                 // 팔꿈치 판
          ell(g, ex, ey, 7.5, 6.5, 'q');
          rect(g, ex - 5, ey - 7, ex + 4, ey - 4, 'Q');
          ell(g, wx, wy + 2, 7, 6, 'O');                      // 주먹
          ell(g, wx, wy + 1, 6, 5, 'q');
          for (let k = -1; k <= 1; k++) {                     // 발톱 — 끝만 뼈
            const a = .35 + k * .42;
            const mx = wx + s2 * Math.sin(a) * 7, my = wy + 4 + Math.cos(a) * 7;
            const tx = wx + s2 * Math.sin(a) * 14, tt = wy + 4 + Math.cos(a) * 14;
            edgedLine(wx, wy + 3, mx, my, 'q', 4 - Math.abs(k));
            line(g, mx, my, tx, tt, 'E', 3 - Math.abs(k));
            put(g, tx, tt, 'F');
          }
        }

        // ── 몸통 ── 망토보다 좁게. 갑옷이라 채도가 낮다.
        edged(cx - 16, sh + 2, cx + 16, sh + 34, 'q', 'Q', 'c');
        for (let i = 0; i < 3; i++)                          // 갈비 능선
          rect(g, cx - 14 + i * 2, sh + 10 + i * 7, cx + 14 - i * 2, sh + 11 + i * 7, 'c');
        // 가슴의 보석 — 유일하게 빛나는 곳. 눈과 함께 시선을 잡는다.
        ell(g, cx, sh + 14, 9, 10, 'O');
        ell(g, cx, sh + 14, 6, 7, 'B');
        ell(g, cx, sh + 14, 4, 5, 'G');
        ell(g, cx - 1, sh + 12, 2, 2, 'W');
        for (let i = 0; i < 6; i++) {                        // 보석을 문 발톱 — 금
          const a = i / 6 * Math.PI * 2 + .5;
          line(g, cx + Math.cos(a) * 6, sh + 14 + Math.sin(a) * 7,
                  cx + Math.cos(a) * 10, sh + 14 + Math.sin(a) * 11, 'J', 2);
          put(g, cx + Math.cos(a) * 6, sh + 14 + Math.sin(a) * 7, 'o');
        }
        edged(cx - 18, sh + 34, cx + 18, sh + 41, 'q', 'Q', 'c');   // 허리띠
        rect(g, cx - 18, sh + 34, cx + 18, sh + 35, 'J');            // 띠의 금단
        rect(g, cx - 18, sh + 34, cx + 17, sh + 34, 'o');
        rect(g, cx - 5, sh + 36, cx + 4, sh + 40, 'J');              // 버클
        rect(g, cx - 4, sh + 37, cx + 3, sh + 38, 'o');
        put(g, cx - 3, sh + 37, 'Z');

        // ── 어깨 갑판 ── 두 겹. 가시는 하나만, 그리고 갑옷색이다(뼈로 두면 벌레가 된다).
        for (const s2 of [-1, 1]) {
          edged(cx + s2 * 16, sh - 4, cx + s2 * 33, sh + 9, 'q', 'Q', 'c');
          rect(g, cx + s2 * 16, sh + 8, cx + s2 * 33, sh + 9, 'J');   // 갑판 아래 금단
          edged(cx + s2 * 19, sh + 7, cx + s2 * 31, sh + 16, 'q', 'Q', 'c');
          rect(g, cx + s2 * 19, sh + 15, cx + s2 * 31, sh + 16, 'J');
          edgedLine(cx + s2 * 27, sh - 3, cx + s2 * 33, sh - 13 - p, 'q', 8);
          line(g, cx + s2 * 26, sh - 5, cx + s2 * 31, sh - 12 - p, 'Q', 3);
          put(g, cx + s2 * 21, sh - 6, 'o');                  // 금 못 하나
        }

        // ── 깃 ── 머리 뒤로만. 어깨와 겹치지 않게 위쪽에만.
        for (const s2 of [-1, 1]) {
          edged(cx + s2 * 13, hy - 8, cx + s2 * 20, sh - 6, 'q', 'Q', 'c');
          edgedLine(cx + s2 * 17, hy - 8, cx + s2 * 20, hy - 20 - p, 'q', 4);
        }

        // ── 머리 ── 해골 투구. 눈구멍이 깊어야 보스가 된다.
        ell(g, cx, hy + 1, 16, 15, 'O');
        ell(g, cx, hy, 14, 13, 'q');
        rect(g, cx - 12, hy, cx + 12, hy + 12, 'q');
        rect(g, cx - 14, hy - 6, cx + 14, hy - 2, 'Q');       // 이마가 빛을 받는다
        rect(g, cx - 14, hy - 2, cx + 14, hy, 'c');           // 눈두덩이 드리우는 그늘
        rect(g, cx + 11, hy - 2, cx + 14, hy + 7, 'c');
        /* 눈구멍은 둘로 떼어 놓는다. 한 줄로 이으면 로봇 바이저가 된다. */
        for (const s2 of [-1, 1]) rect(g, cx + s2 * 3, hy, cx + s2 * 11, hy + 6, 'O');
        eyes(g, cx, hy + 2, 6, 'G', 4);
        eyes(g, cx, hy + 3, 6, 'W', 2);
        rect(g, cx - 2, hy - 1, cx + 1, hy + 9, 'q');         // 콧등
        rect(g, cx - 2, hy - 1, cx - 1, hy + 8, 'Q');
        edged(cx - 10, hy + 8, cx + 10, hy + 15, 'q', 'Q', 'c', 1);   // 턱
        for (let i = -2; i <= 2; i++)                         // 엄니
          line(g, cx + i * 4, hy + 14, cx + i * 4, hy + 17 + (i % 2 ? 2 : 0), 'F', 2);

        // ── 뿔 ── 뼈. 마디가 있어야 뿔이지, 매끈하면 더듬이다.
        for (const s2 of [-1, 1]) {
          /* 위로만 뻗으면 뿔이 아니라 치켜든 팔로 보인다(V 자가 됐었다).
             밖으로 나갔다가 끝에서 아래로 말려야 뿔로 읽힌다. */
          const seg = [[9, hy - 10, 23, hy - 26 - p, 10], [23, hy - 26 - p, 36, hy - 22 - p, 7],
                       [36, hy - 22 - p, 42, hy - 9 - p, 4]];
          for (const [x0, y0, x1, y1, t] of seg) {
            edgedLine(cx + s2 * x0, y0, cx + s2 * x1, y1, 'E', t);
            line(g, cx + s2 * x0 - s2 * 2, y0 - 2, cx + s2 * x1 - s2 * 2, y1 - 2, 'F',
                 Math.max(1, t - 5));
          }
          for (let i = 1; i <= 4; i++)                        // 마디
            line(g, cx + s2 * (8 + i * 3.4), hy - 10 - i * 4.1,
                    cx + s2 * (12 + i * 3.4), hy - 13 - i * 4.1, 'O', 1);
          // 뿔 밑동을 무는 금관 — 뼈만 있으면 짐승이고, 금이 붙으면 왕이다
          edgedLine(cx + s2 * 7, hy - 8, cx + s2 * 13, hy - 14, 'J', 5);
          line(g, cx + s2 * 7, hy - 10, cx + s2 * 12, hy - 15, 'o', 2);
        }
        // ── 왕관 ── 셋이 밖으로 벌어진다. 가운데 하나만 세우면 더듬이가 된다.
        for (let i = -1; i <= 1; i++) {
          const h = i ? 9 : 15;
          edgedLine(cx + i * 5, hy - 11, cx + i * 11, hy - 11 - h - p, 'q', i ? 5 : 6);
          line(g, cx + i * 5 - 1, hy - 12, cx + i * 11 - 1, hy - 11 - h - p, 'Q', 2);
        }
        edged(cx - 10, hy - 16, cx + 10, hy - 10, 'q', 'Q', 'c', 1);
        ell(g, cx, hy - 13, 3, 3, 'G');                        // 왕관의 보석
        put(g, cx - 1, hy - 14, 'W');

        outline(g, 3);
        return g;
      },

    };

    /* ---------- 색 ---------- */
    const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
    const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v)))
      .toString(16).padStart(2, '0')).join('');
    const mix = (c, t, k) => c.map((v, i) => v + (t[i] - v) * k);

    /* ---------- 시트 ----------
       SCALE 이 해상도다. 규격에 적힌 h 는 '손으로 그린 좌표계'의 크기고,
       실제 판은 그 SCALE 배로 나온다. 몹 32→64 · 보스 64→128 · 바닥 64→128.

       바닥·폭발은 격자를 직접 훑어(g[y][x]) 배율을 먹일 수 없다 —
       대신 함수 자체가 S 로 매개화돼 있으므로 최종 크기를 그대로 넘긴다. */
    const SCALE = 2;
    const RAW = new Set(['floor', 'floordeco', 'floordeco2', 'boom']);
    const NATIVE = new Set(['hero', 'boss', 'blob', 'bat', 'ghost', 'humanoid', 'hound',
                            'hit', 'cast']);
    const rows = Object.entries(SPEC.frames);
    let maxS = 0, H = 0;
    for (const [, f] of rows) { const S = f.h * SCALE; H += S; if (S > maxS) maxS = S; }
    const W = maxS * N;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    const frames = {};
    let y0 = 0;
    for (const [key, def] of rows) {
      /* RAW 는 격자를 직접 훑어 배율을 못 먹이는 것들이다. 대신 함수가 S 로 매개화돼 있어
         최종 크기를 그대로 넘기면 그 크기로 알아서 그린다 — 결과는 같다. */
      const raw = RAW.has(def.shape);
      /* NATIVE 는 '최종 해상도에 직접 적힌' 실루엣이다.
         RAW 와 달리 빛 처리는 그대로 받는다 — 빼야 할 이유가 바닥 타일(이음매)뿐이라서다.
         2배로 늘린 32칸 그림은 '픽셀이 큰 32px 그림'이지 64px 그림이 아니다.
         투구의 볼가리개, 갑옷의 능선, 무릎 보호대, 칼의 혈조는 홀수 픽셀에 놓여야 나온다. */
      const nat = NATIVE.has(def.shape);
      const S = def.h * SCALE;
      const base = hex(def.color);
      const pal = {
        O: '#0a0a12',
        B: def.color,
        D: toHex(mix(base, [0, 0, 0], .3)),      // 그늘
        /* 보스용. 몸 전체가 B 한 색이라 색종이로 오린 것 같았다 —
           천은 네 단계(C·B·D·c), 갑옷은 채도를 죽인 두 단계(Q·q)로 나눈다.
           갑옷을 진짜 강철로 두면 보스 넷이 다 같아 보인다. 색은 남기고 채도만 죽인다. */
        /* 몸색 여덟 단계. 이 표는 처음부터 t·c·a·D·B·C·G·T 를 갖고 있었는데
           몹은 그중 넷(c·D·B·C)만 썼다. 색이 모자랐던 게 아니라 안 쓰고 있었던 것이다. */
        C: toHex(mix(base, [255, 255, 255], .34)),
        c: toHex(mix(base, [0, 0, 0], .58)),
        q: toHex(mix(base, [46, 44, 62], .62)),
        Q: toHex(mix(mix(base, [46, 44, 62], .62), [255, 255, 255], .32)),
        // 뼈 — 뿔·엄니·발톱. 보스에 쓰는 유일한 중립색이라 이것만으로 '뿔'이 읽힌다.
        F: '#ded2b4', E: '#9d8c6f',
        G: toHex(mix(base, [255, 255, 255], .62)), // 광택 · 눈
        /* 주인공용 재질.

           예전에는 살 2 · 강철 3 · 가죽 4 · 직업색 3 이었다. 그 폭으로는 갑옷의
           금 테두리도, 망토의 붉은 안감도, 뺨의 그늘도 놓을 자리가 없다 —
           멀리서 보면 흰 갑옷에 노란 십자 하나였다.
           재질마다 단계를 늘리고 금·안감·상아를 새로 들인다. 주인공 한 명에
           서른 색이 오른다. */
        A: def.color,                               // 직업색 — 몸통
        a: toHex(mix(base, [0, 0, 0], .42)),        // 직업색 그늘 (망토 안쪽)
        t: toHex(mix(base, [0, 0, 0], .68)),        // 직업색 깊은 그늘
        T: toHex(mix(base, [255, 255, 255], .84)),  // 직업색 광
        // 살 넷 — 얼굴이 판판한 색면이면 인형이 된다
        Y: '#ffeeda', S: '#f2d8b4', s: '#c99b74', y: '#9b6448',
        // 강철 다섯 — 광(X)은 lightMap 을 타고, W 는 안 탄다. 둘을 갈라 둔 이유다
        X: '#fbfdff', H: '#eef2fa', M: '#d9dee9', m: '#8d94a8', e: '#565d73',
        b: '#2f3446',                               // 검은 무쇠 — 사슬·도끼 뒷날
        // 가죽 다섯
        U: '#c19170', u: '#93694a', L: '#6d4c33', l: '#452e1f', d: '#2a1a10',
        // 금 넷 — 갑옷 테두리 · 코등이 · 버클 · 자수
        Z: '#ffe9a8', o: '#e6b845', J: '#a8791f', j: '#6b4a10',
        // 붉은 안감 셋 — 망토 안쪽과 허리천. 금 옆에 붉은 게 있어야 갑옷이 산다.
        // 몬스터에서는 마른 피와 상처, 박쥐 귀 안쪽으로도 쓴다
        I: '#c04452', i: '#8f2530', h: '#57141d',
        /* 녹슨 쇠 둘 — 몬스터 전용. 강철(M·m·e)은 차가운 회색이라 주인공 갑옷의 색이고,
           족쇄·목줄·화살촉처럼 '버려진 쇠'는 따뜻하게 삭아야 한다. */
        w: '#8a5326', x: '#4a2d13',
        /* 연기 둘 — 이펙트 전용. 폭발이 속성색만으로 끝나면 '색 원'이지 폭발이 아니다.
           식은 가장자리에 중립색이 있어야 안쪽의 뜨거운 색이 뜨거워 보인다. */
        8: '#6d6a7d', 9: '#3b3849',
        W: '#ffffff',
        /* 바닥용 밝기 단계. 판석마다 톤이 조금씩 달라야 '바닥'이지,
           한 톤이면 벽지가 된다. 폭은 좁게 잡는다 —
           대비를 세우면 바닥이 TV 노이즈가 되어 그 위의 몬스터와 싸운다(예전에 실제로 그랬다). */
        k: toHex(mix(base, [0, 0, 0], .45)),        // 갈라진 틈 — 가장 깊다
        1: toHex(mix(base, [0, 0, 0], .30)),        // 줄눈
        2: toHex(mix(base, [0, 0, 0], .10)),
        3: def.color,
        4: toHex(mix(base, [255, 255, 255], .055)),
        5: toHex(mix(base, [255, 255, 255], .13)),  // 줄눈 아래 빛받는 모서리
        /* 판석의 색조 변화. 바닥에서 '색을 늘린다'는 밝기를 늘린다는 뜻이 될 수 없다 —
           바닥은 배경이라 대비를 세우는 순간 그 위의 몬스터와 싸운다(예전에 그랬다).
           그래서 밝기는 거의 그대로 두고 색조만 돌린다.
           같은 밝기의 따뜻한 돌 · 차가운 돌 · 젖은 자국 · 물때. */
        f: toHex(mix(base, [56, 42, 36], .24)),     // 따뜻한 판석 (갈색 쪽)
        g: toHex(mix(base, [26, 44, 62], .28)),     // 차가운 판석 (청록 쪽)
        0: toHex(mix(base, [14, 30, 34], .42)),     // 젖은 자국 — 어둡고 푸르다
        z: toHex(mix(base, [30, 42, 30], .40)),     // 물때 — 이끼와 줄눈 사이
        K: toHex(mix(base, [92, 84, 70], .30)),     // 이 빠진 모서리 — 따뜻하게 밝다
        /* 바닥 장식용. 여기서 한 번 크게 틀렸다 — 풀을 '풀색'(#4a6b3a)으로,
           꽃을 흰색으로 칠했더니 어두운 남색 바닥 위에서 형광 얼룩이 됐다.
           바닥 밝기가 28 언저리인데 풀 끝이 95 였다. 3배가 넘으면 장식이 아니라 표적이다.
           그래서 전부 바닥 밝기의 2배 안으로 눌렀다. 채도도 같이 내렸다 —
           이 게임에서 채도가 높은 것은 몬스터와 이펙트뿐이어야 한다. */
        v: '#313f24', V: '#46592a',                 // 이끼 뿌리 · 잎 끝
        r: '#353341', R: '#494551',                 // 돌부스러기 (바닥과 같은 계열)
        /* 나무. 돌부스러기 색(차가운 회색)으로 널판을 그렸더니 뼈로 보였다 —
           둘째 겹에 이미 뼈가 있어서 더 헷갈렸다. 나무는 따뜻해야 나무다. */
        6: '#3e2e22', 7: '#523d28',
        n: '#4d4a41', N: '#5f5b4e',                 // 뼈 · 뼈 마디
        p: '#7a6a48', P: '#5f4d63',                 // 꽃 — 바랜 금빛 · 바랜 자주
      };
      for (let f = 0; f < N; f++) {
        CURK = (raw || nat) ? 1 : SCALE;
        const g = SIL[def.shape](f, (raw || nat) ? S : def.h, def);
        /* 이펙트는 빛을 입히지 않는다 — 발광체라 방향을 가진 그림자가 붙으면 거짓이 된다.
           바닥 타일도 뺀다. 이어 붙는 그림이라 방향광이 들어가면 이음매가 드러난다. */
        const lm = (def.fx || raw) ? null : lightMap(g);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const v = g[y][x];
          if (v === '.') continue;
          let col = pal[v];
          if (lm && v !== 'O' && v !== 'W') {
            const t = lm[y][x];
            if (t > 0) col = toHex(mix(hex(col), [255, 250, 235], t * .46));
            else if (t < 0) col = toHex(mix(hex(col), [12, 10, 26], -t * .52));
          }
          c.fillStyle = col;
          c.fillRect(f * S + x, y0 + y, 1, 1);
        }
      }
      /* 화면 크기는 예전 그대로 두고 픽셀 밀도만 올린다.
         크기까지 같이 키우면 보스가 84 → 96px 로 커져 게임 자체가 달라진다 —
         이번에 바꾸려는 건 '더 선명한가'지 '더 큰가'가 아니다.
         예전 화면 크기: 32px 판은 32, 그 외(48·64)는 28.
         고밀도 화면(dpr 2)에서 64 기기픽셀 = 64px 판과 1:1 이 된다. */
      frames[key] = { x: 0, y: y0, w: S, h: S, n: N, fps: def.fps || 8 };
      if (!def.fx && !raw) frames[key].s = +((def.h === 32 ? 32 : 28) / S).toFixed(4);
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

/* 회귀: 바위가 손그림으로 서고, 보이는 폭이 막히는 원과 맞는가.

   ── 왜 바위인가

   장애물 14종 중 바위가 인스턴스의 44%, **화면의 97% 에 나온다.** 한 화면에
   중앙 3개 · 최대 9개가 같이 보인다. 그래서 넉 장(변종)을 그렸다 — 한 장이면
   복사 붙여넣기가 눈에 띈다. 나머지 종류는 90분위가 2라 두 장이면 된다.
   **장수는 취향이 아니라 실측이 정한다.**

   ── 무엇을 재는가

   1. 보이는 폭 = 막히는 지름. 그림이 옛 도형보다 넓으면 바위 안에 서 있게 되고,
      좁으면 허공에서 막힌다. 둘 다 화면만 봐서는 안 잡히고 걸어 봐야 아는
      종류의 회귀다(§76 장식 · §86 건물과 같은 규칙).

   2. 넉 장이 서로 다른가. 같은 그림이 두 번 들어가면 변종을 그린 뜻이 없다.

   3. 밝기. 이 게임은 겹마다 밝기가 정해져 있다 — 바닥 36, 장식 48~52,
      장애물 57~97. 장애물이 장식보다 어두우면 **주워야 할 것처럼 보인다.**
      바꿔 넣은 절차 바위가 평균 97 이었으므로 거기에 맞춘다.

      (카드에는 '평균 45 · 최대 70' 을 적었는데 그건 장식 겹의 규칙이었다.
       그대로 넣었으면 바위가 곁의 잔해 더미보다 어두워질 뻔했다. 겹마다 밝기가
       다르다는 것을 재고 나서야 알았다.)

   실행: node tests/obs-art.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const r = await pg.evaluate(() => {
    cam.x = 0; cam.y = 0;
    const out = { kinds: [], shots: [], sigs: [], lum: {}, dry: null };
    for (const [kind, A] of Object.entries(OBS_ART)) {
      const f = Sprites.frames[A.key], d = A.dry && Sprites.frames[A.dry];
      out.kinds.push({ kind, name: OBS_KINDS[kind].name, n: A.f.length,
        fits: !!(f && Sprites.atlas && f.y + f.h <= Sprites.atlas.height),
        dryFits: A.dry ? !!(d && Sprites.atlas && d.y + d.h <= Sprites.atlas.height) : null });
    }

    /* 한 장을 마젠타 위에 그리고 **가로로 뻗은 너비**를 잰다.
       standUp 은 세로만 늘리므로 폭 측정에는 영향이 없다.

       두 번 틀렸던 자리다.

       하나, 바탕을 「G 채널이 낮으면 배경」으로 골랐다. 그랬더니 폐허의 **까만
       아치 안쪽**과 덤불의 어두운 줄기가 배경으로 세어져 구멍이 뚫린 것처럼
       나왔다. 게다가 어두운 칸이 빠지니 **밝기 평균이 부풀었다** — 절차 그림도
       같은 자를 대고 쟀으므로 비교값까지 같이 틀려 있었다. 지금은 게임이 쓰는
       마젠타 키(min(R,B) - G > 55)를 그대로 쓴다.

       둘, '가장 긴 연속 가로줄'로 폭을 쟀다. 덤불은 줄기 사이가 비어 있어
       한 줄이 끝까지 이어지지 않는다. 폭 100 짜리가 55 로 나왔다. 지금은
       왼쪽 끝에서 오른쪽 끝까지의 너비를 잰다 — base 를 정한 방식과 같다. */
    const shot = (kind, v, rr, hpFrac) => {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, 520, 520);
      ctx.restore();
      drawObstacle({ key: 'p' + v, kind, K: OBS_KINDS[kind], x: 260, y: 260, r: rr,
        st: { hp: 1000 * (hpFrac == null ? 1 : hpFrac), max: 1000 }, seed: .4, v, flip: false });
      const d = ctx.getImageData(0, 0, 520, 520).data;
      const on = (x, y) => {
        const i = (y * 520 + x) << 2;
        return Math.min(d[i], d[i + 2]) - d[i + 1] <= 55;   // 게임과 같은 마젠타 키
      };
      let x0 = 1e9, x1 = -1, top = -1, bot = -1, lum = 0, cnt = 0, sig = 0;
      for (let y = 0; y < 520; y++) {
        for (let x = 0; x < 520; x++) {
          if (!on(x, y)) continue;
          const i = (y * 520 + x) << 2;
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (top < 0) top = y; bot = y;
          lum += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; cnt++;
          sig = (sig * 31 + (d[i] >> 4) + x) % 1e9;
        }
      }
      /* 발치 폭 — **기준 줄 한 줄**의 좌우 끝 너비. base 를 뽑을 때와 같은 자다.

         띠의 평균으로 재면 안 된다. 맨 아래 몇 줄은 뿌리 끝만 닿아 가늘어서
         평균이 실제보다 좁게 나오고, 그 값을 base 로 쓰면 나무가 부푼다.
         (§86 첨탑에서 '띠의 평균은 띠 어디에도 없는 값'이라고 배운 자리다.)

         기준 줄의 화면 위치: 그림은 sy + r*0.06 에 앉는데, standUp 이 sy 를
         축으로 세로를 1/TILT 로 늘리므로 화면에서는 sy + r*0.06/TILT 다. */
      const ay = Math.round(260 + rr * .06 / TILT);
      let foot = 0, a = -1, b2 = -1;
      if (ay >= 0 && ay < 520) {
        for (let x = 0; x < 520; x++) if (on(x, ay)) { if (a < 0) a = x; b2 = x; }
        foot = a < 0 ? 0 : b2 - a + 1;
      }
      return { v, r: rr, wide: cnt ? x1 - x0 + 1 : 0, h: cnt ? bot - top + 1 : 0,
        foot: Math.round(foot), mean: cnt ? lum / cnt : 0, sig };
    };
    for (const [kind, A] of Object.entries(OBS_ART)) {
      out.lum[kind] = [];
      for (let v = 0; v < A.f.length; v++) {
        const s = shot(kind, v, 50);
        out.shots.push({ kind, v, r: 50, wide: s.wide, foot: s.foot, collider: 100, h: s.h });
        out.sigs.push(s.sig);
        out.lum[kind].push(+s.mean.toFixed(0));
      }
      /* 크기를 흔들어도 관계가 유지되는가 — 배율이 잘못 걸리면 여기서 벌어진다.
         **그 종류가 실제로 갖는 크기**만 흔든다. 한때 모든 종류를 12·25·90 으로
         쟀는데, 고목은 반지름이 26 밑으로 안 내려간다 — 게임에 없는 크기에서
         빨개졌다. 없는 것을 재면 없는 결함이 나온다.
         (huge 는 6% 확률로 1.75배가 되므로 위 끝은 거기까지 본다.) */
      const K = OBS_KINDS[kind];
      for (const rr of [K.r[0], Math.round((K.r[0] + K.r[1]) / 2), Math.round(K.r[1] * 1.75)]) {
        const s = shot(kind, 1 % A.f.length, rr);
        out.shots.push({ kind, v: 1 % A.f.length, r: rr, wide: s.wide, foot: s.foot, collider: rr * 2, h: s.h });
      }
    }
    /* 시든 판 — 체력이 절반 밑으로 내려가면 그림이 바뀌되 **모양은 그대로**여야
       한다. 자리(폭·높이)가 달라지면 다른 덤불로 바뀐 것처럼 보인다. */
    out.dry = {};
    for (const kind of ['thorn', 'tree']) {
      const wet = shot(kind, 0, 50, 1), dry = shot(kind, 0, 50, .2);
      out.dry[kind] = { wetW: wet.wide, dryW: dry.wide, wetH: wet.h, dryH: dry.h,
        wetL: +wet.mean.toFixed(0), dryL: +dry.mean.toFixed(0), same: wet.sig === dry.sig };
    }
    return out;
  });

  let bad = 0;
  // 변종 장수는 실측이 정했다 — 한 화면에 같이 보이는 개수의 90분위
  const WANT = { rock: 4, ruin: 2, thorn: 2, tree: 2, bones: 2 };
  for (const k of r.kinds) {
    if (!k.fits) { console.log(`!! ${k.name} — 판이 그 줄까지 자라지 않았다, 자리만 예약된 상태다`); bad++; }
    if (k.dryFits === false) { console.log(`!! ${k.name} — 시든 판이 판 밖이다`); bad++; }
    if (WANT[k.kind] && k.n !== WANT[k.kind]) {
      console.log(`!! ${k.name} — 변종이 ${k.n}장이다, 실측은 ${WANT[k.kind]}장을 요구한다`); bad++; }
  }
  for (const k of Object.keys(WANT))
    if (!r.kinds.some(x => x.kind === k)) { console.log(`!! OBS_ART 에 ${k} 가 없다`); bad++; }

  /* 판정에 맞춰야 할 것이 종류마다 다르다. 자도 그에 맞춰 갈아 끼운다 —
     한 자로 다 재면 멀쩡한 고목이 빨개진다.

       바위·폐허  땅에 닿는 가장 넓은 줄 (= 상자 폭)   막히는 것은 밑동
       가시덤불   상자 전체                            가시 끝이 곧 아픈 경계
       거대 유해  상자 전체                            깔린 것 자체가 발판
       고목       발치(뿌리)                           가지 밑은 지나가도 된다 */
  const FOOT = { tree: true };
  console.log('종류     변종  반지름   맞춰야 할 폭 / 판정 지름   높이   상자폭');
  for (const s of r.shots) {
    const useFoot = !!FOOT[s.kind];
    const w = useFoot ? s.foot : s.wide, d = w - s.collider;
    console.log(`${s.kind.padEnd(7)}  ${s.v + 1}    ${String(s.r).padStart(3)}      ${String(w).padStart(4)} / ${String(s.collider).padStart(4)}`
      + `   (${d >= 0 ? '+' : ''}${d})${useFoot ? ' 발치' : '     '}   ${String(s.h).padStart(3)}   ${s.wide}`);
    if (Math.abs(d) > Math.max(4, s.collider * .06)) {
      console.log(`  !! ${s.kind} 변종 ${s.v + 1} r=${s.r} — ${useFoot ? '발치' : '보이는'} 폭 ${w} 와 판정 지름 ${s.collider} 가 어긋난다`); bad++; }
    if (s.h < 8) { console.log(`  !! ${s.kind} 변종 ${s.v + 1} r=${s.r} — 아무것도 안 그려졌다`); bad++; }
    /* 고목은 수관이 발치보다 넓어야 나무다. 다만 한없이 넓으면 판정과 그림이
       너무 벌어져 '어디서 막히는지'를 못 배운다. 절차 고목이 1.41 배다. */
    if (useFoot && s.foot) {
      const spread = s.wide / s.foot;
      if (spread < 1.15) { console.log(`  !! ${s.kind} — 수관이 발치보다 안 넓다(${spread.toFixed(2)}배), 나무로 안 보인다`); bad++; }
      if (spread > 1.9) { console.log(`  !! ${s.kind} — 수관이 발치의 ${spread.toFixed(2)}배다, 판정과 그림이 너무 벌어졌다`); bad++; }
    }
  }

  /* 밝기는 겹의 자리다. 바닥 36 · 장식 48~52 · 장애물 57~97.
     장애물이 장식보다 어두우면 주워야 할 것처럼 보인다. 바꿔 넣은 절차
     그림의 값에 맞춘다 — 바위 97 · 폐허 58 · 덤불 86 · 고목 56 · 유해 185.
     유해가 유독 밝은 것은 의도다. 이 게임 유일한 중립색(뼈) 지형이다.

     이 값들은 한 번 다시 쟀다. 처음엔 어두운 칸을 배경으로 오해하는 자로 재서
     기준 자체가 부풀어 있었다. 자가 틀리면 비교 대상도 같이 틀린다. */
  const BAND = { rock: [84, 110], ruin: [48, 70], thorn: [76, 100],
                 tree: [46, 68], bones: [168, 205] };
  for (const [kind, list] of Object.entries(r.lum)) {
    const [lo, hi] = BAND[kind] || [55, 135];
    const PROC = { rock: 97, ruin: 58, thorn: 86, tree: 56, bones: 185 };
    console.log(`\n${kind} 밝기 ${list.join(' · ')}   (절차 ${PROC[kind]})`);
    for (const L of list) {
      if (L < lo) { console.log(`!! 밝기 ${L} — 바꿔 넣은 절차 그림(${lo}~${hi})보다 어둡다`); bad++; }
      if (L > hi) { console.log(`!! 밝기 ${L} — 바꿔 넣은 절차 그림(${lo}~${hi})보다 밝다`); bad++; }
    }
  }
  /* 상하는 신호 — 덤불은 색조가 바뀌고(그림을 따로 만든다) 고목은 밝기만
     내려간다(어두운 판을 얹는다). 방법은 달라도 지켜야 할 것은 같다:
     **모양은 그대로, 색만.** 실루엣까지 바뀌면 '상해 간다'가 아니라 '다른
     것으로 바뀌었다'로 읽힌다. */
  for (const [kind, D] of Object.entries(r.dry)) {
    console.log(`\n상한 ${kind} — 폭 ${D.wetW}→${D.dryW} · 높이 ${D.wetH}→${D.dryH} · 밝기 ${D.wetL}→${D.dryL}`);
    if (D.same) { console.log(`!! ${kind} — 체력이 깎여도 같은 그림이다, 신호가 사라졌다`); bad++; }
    if (Math.abs(D.wetW - D.dryW) > 2 || Math.abs(D.wetH - D.dryH) > 2) {
      console.log(`!! ${kind} — 상하면서 모양이 바뀐다, 다른 것으로 바뀐 것처럼 보인다`); bad++; }
    if (!(D.dryL < D.wetL - 8)) { console.log(`!! ${kind} — 상한 것이 눈에 띄게 어둡지 않다`); bad++; }
  }
  if (new Set(r.sigs).size !== r.sigs.length) { console.log('!! 같은 그림이 두 번 들어갔다'); bad++; }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

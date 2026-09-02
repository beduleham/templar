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
      /* 축 대칭 폭 — 기준 줄에서 **축(sx=260)에서 왼끝까지의 두 배.**
         부러진 기둥·첨탑은 윗단이 받침 오른쪽에 누워 있어 줄 전체를 재면
         받침이 아니라 부스러기까지 들어간다. 부스러기는 늘 오른쪽이다(카드). */
      const sym = a < 0 ? 0 : Math.round((260 - a) * 2);
      return { v, r: rr, wide: cnt ? x1 - x0 + 1 : 0, h: cnt ? bot - top + 1 : 0,
        foot: Math.round(foot), sym, mean: cnt ? lum / cnt : 0, sig };
    };
    for (const [kind, A] of Object.entries(OBS_ART)) {
      out.lum[kind] = [];
      for (let v = 0; v < A.f.length; v++) {
        const s = shot(kind, v, 50);
        out.shots.push({ kind, v, r: 50, wide: s.wide, foot: s.foot, sym: s.sym, collider: 100, h: s.h });
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
        out.shots.push({ kind, v: 1 % A.f.length, r: rr, wide: s.wide, foot: s.foot, sym: s.sym, collider: rr * 2, h: s.h });
      }
    }
    /* 시든 판 — 체력이 절반 밑으로 내려가면 그림이 바뀌되 **모양은 그대로**여야
       한다. 자리(폭·높이)가 달라지면 다른 덤불로 바뀐 것처럼 보인다. */
    /* 맥동하는 신호가 살아 있는가 — 손그림으로 갈면서 절차 가지를 통째로
       건너뛰면 그 안에 있던 연출이 조용히 사라진다. 실제로 수정 기둥의 후광을
       한 번 잃었다. 두 시각에서 찍어 화면이 달라지는지 본다. */
    out.glow = {};
    for (const [kind, A] of Object.entries(OBS_ART)) {
      if (!A.glow && !A.bubbles && !A.fire && !A.lamp) continue;   // 후광·거품·불 — 움직이는 것들
      const t0 = Game.time;
      Game.time = 0;   const a = shot(kind, 0, 50);
      Game.time = 1.21; const b2 = shot(kind, 0, 50);   // 맥동 반 바퀴 뒤
      Game.time = t0;
      out.glow[kind] = { same: a.sig === b2.sig, w: a.wide, gw: Math.max(a.wide, b2.wide) };
    }
    out.dry = {};
    for (const kind of ['thorn', 'tree', 'crate']) {
      const wet = shot(kind, 0, 50, 1), dry = shot(kind, 0, 50, .2);
      out.dry[kind] = { wetW: wet.wide, dryW: dry.wide, wetH: wet.h, dryH: dry.h,
        wetL: +wet.mean.toFixed(0), dryL: +dry.mean.toFixed(0), same: wet.sig === dry.sig };
    }
    return out;
  });

  let bad = 0;
  // 변종 장수는 실측이 정했다 — 한 화면에 같이 보이는 개수의 90분위
  const WANT = { rock: 4, ruin: 2, thorn: 2, tree: 2, bones: 2, statue: 2, crystal: 2, bog: 2, wall: 2, obelisk: 2, pillar: 2, crate: 1, brazier: 2, lantern: 2 };
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
       고목       발치(뿌리)                           가지 밑은 지나가도 된다
       수정 기둥  발치(바위 밑동)                      살이 위로 벌어진다

     값은 발치 밖으로 얼마나 벌어져도 되는지의 위아래 한계다. 아예 안 벌어지면
     기둥이지 나무·수정이 아니고, 한없이 벌어지면 어디서 막히는지를 못 배운다. */
  const FOOT = { tree: [1.15, 1.9], crystal: [1.05, 1.45] };
  /* 부러진 변형이 있는 종류 — 받침은 축 대칭으로 재고, 누운 윗단이 오른쪽으로
     얼마나 삐져나와도 되는지의 한계다. 성한 변형은 1.0 이라야 한다. */
  const SYM = { pillar: [.96, 1.5], obelisk: [.96, 1.7] };
  const OBS_ART_FRAC = { brazier: .72, lantern: .75 };
  console.log('종류     변종  반지름   맞춰야 할 폭 / 판정 지름   높이   상자폭');
  for (const s of r.shots) {
    /* 광원 둘은 판정이 그림보다 넓다 — 화톳불의 판정은 태우는 원, 등불은 빛의 자리.
       절차 그림도 판정의 0.72·0.75 였다. 그 비율을 그대로 요구한다. */
    const frac = (OBS_ART_FRAC[s.kind] || 1);
    const useFoot = !!FOOT[s.kind], useSym = !!SYM[s.kind];
    const w = useFoot ? s.foot : useSym ? s.sym : s.wide, d = w - Math.round(s.collider * frac);
    console.log(`${s.kind.padEnd(7)}  ${s.v + 1}    ${String(s.r).padStart(3)}      ${String(w).padStart(4)} / ${String(s.collider).padStart(4)}`
      + `   (${d >= 0 ? '+' : ''}${d})${useFoot ? ' 발치' : '     '}   ${String(s.h).padStart(3)}   ${s.wide}`);
    if (Math.abs(d) > Math.max(4, s.collider * frac * .06)) {
      console.log(`  !! ${s.kind} 변종 ${s.v + 1} r=${s.r} — ${useFoot ? '발치' : '보이는'} 폭 ${w} 와 판정 지름 ${s.collider} 가 어긋난다`); bad++; }
    if (s.h < 8) { console.log(`  !! ${s.kind} 변종 ${s.v + 1} r=${s.r} — 아무것도 안 그려졌다`); bad++; }
    // 절차 고목이 1.41 배, 절차 수정은 오히려 판정보다 좁았다(0.84 배 — 허공에서
    // 막히던 쪽이다). 새것은 발치를 판정에 맞추고 위만 벌어진다.
    if (useSym && s.sym) {
      const spread = s.wide / s.sym, [lo, hi] = SYM[s.kind];
      if (spread < lo) { console.log(`  !! ${s.kind} — 상자가 받침보다 좁다(${spread.toFixed(2)}배), 축이 틀렸다`); bad++; }
      if (spread > hi) { console.log(`  !! ${s.kind} — 누운 돌이 받침의 ${spread.toFixed(2)}배까지 나간다`); bad++; }
    }
    if (useFoot && s.foot) {
      const spread = s.wide / s.foot, [lo, hi] = FOOT[s.kind];
      if (spread < lo) { console.log(`  !! ${s.kind} — 위가 발치보다 안 넓다(${spread.toFixed(2)}배)`); bad++; }
      if (spread > hi) { console.log(`  !! ${s.kind} — 위가 발치의 ${spread.toFixed(2)}배다, 판정과 그림이 너무 벌어졌다`); bad++; }
    }
  }

  /* 밝기는 겹의 자리다. 바닥 36 · 장식 48~52 · 장애물 57~97.
     장애물이 장식보다 어두우면 주워야 할 것처럼 보인다. 바꿔 넣은 절차
     그림의 값에 맞춘다 — 바위 97 · 폐허 58 · 덤불 86 · 고목 56 · 유해 185 ·
     석상 88 · 수정 159.
     유해가 유독 밝은 것은 의도다. 이 게임 유일한 중립색(뼈) 지형이다.

     이 값들은 한 번 다시 쟀다. 처음엔 어두운 칸을 배경으로 오해하는 자로 재서
     기준 자체가 부풀어 있었다. 자가 틀리면 비교 대상도 같이 틀린다. */
  const BAND = { rock: [84, 110], ruin: [48, 70], thorn: [76, 100],
                 tree: [46, 68], bones: [168, 205], statue: [76, 100], crystal: [138, 178],
                 bog: [62, 98], wall: [60, 90], obelisk: [72, 104], pillar: [82, 112], crate: [64, 92], brazier: [40, 70], lantern: [40, 70] };
  for (const [kind, list] of Object.entries(r.lum)) {
    const [lo, hi] = BAND[kind] || [55, 135];
    const PROC = { rock: 97, ruin: 58, thorn: 86, tree: 56, bones: 185, statue: 88, crystal: 159, bog: 81, wall: 74, obelisk: 87, pillar: 96, crate: 78, brazier: '그릇만 ~60', lantern: '기둥만 ~65' };
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
  for (const [kind, G] of Object.entries(r.glow)) {
    console.log(`\n${kind} 움직임(후광·거품) — 두 시각의 화면이 ${G.same ? '같다' : '다르다'}`);
    if (G.same) { console.log(`!! ${kind} — 맥동이 멈췄다. 절차 가지에 있던 신호가 사라졌다`); bad++; }
  }
  for (const [kind, D] of Object.entries(r.dry)) {
    console.log(`\n상한 ${kind} — 폭 ${D.wetW}→${D.dryW} · 높이 ${D.wetH}→${D.dryH} · 밝기 ${D.wetL}→${D.dryL}`);
    if (D.same) { console.log(`!! ${kind} — 체력이 깎여도 같은 그림이다, 신호가 사라졌다`); bad++; }
    if (Math.abs(D.wetW - D.dryW) > 2 || Math.abs(D.wetH - D.dryH) > 2) {
      console.log(`!! ${kind} — 상하면서 모양이 바뀐다, 다른 것으로 바뀐 것처럼 보인다`); bad++; }
    // 상자는 금이 가는 것이라 어두워지지 않는다 — 그림이 달라지고 모양이 같으면 된다
    if (kind !== 'crate' && !(D.dryL < D.wetL - 8)) { console.log(`!! ${kind} — 상한 것이 눈에 띄게 어둡지 않다`); bad++; }
  }
  if (new Set(r.sigs).size !== r.sigs.length) { console.log('!! 같은 그림이 두 번 들어갔다'); bad++; }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

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
      let x0 = 1e9, x1 = -1, top = -1, bot = -1, lum = 0, cnt = 0, sig = 0;
      for (let y = 0; y < 520; y++) {
        for (let x = 0; x < 520; x++) {
          const i = (y * 520 + x) << 2, R = d[i], G = d[i + 1], B = d[i + 2];
          if (Math.min(R, B) - G > 55) continue;         // 게임과 같은 마젠타 키
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (top < 0) top = y; bot = y;
          lum += R * .299 + G * .587 + B * .114; cnt++;
          sig = (sig * 31 + (R >> 4) + x) % 1e9;
        }
      }
      return { v, r: rr, wide: cnt ? x1 - x0 + 1 : 0, h: cnt ? bot - top + 1 : 0,
        mean: cnt ? lum / cnt : 0, sig };
    };
    for (const [kind, A] of Object.entries(OBS_ART)) {
      out.lum[kind] = [];
      for (let v = 0; v < A.f.length; v++) {
        const s = shot(kind, v, 50);
        out.shots.push({ kind, v, r: 50, wide: s.wide, collider: 100, h: s.h });
        out.sigs.push(s.sig);
        out.lum[kind].push(+s.mean.toFixed(0));
      }
      // 크기를 흔들어도 관계가 유지되는가 — 배율이 잘못 걸리면 여기서 벌어진다
      for (const rr of [12, 25, 90]) {
        const s = shot(kind, 1 % A.f.length, rr);
        out.shots.push({ kind, v: 1 % A.f.length, r: rr, wide: s.wide, collider: rr * 2, h: s.h });
      }
    }
    /* 시든 판 — 체력이 절반 밑으로 내려가면 그림이 바뀌되 **모양은 그대로**여야
       한다. 자리(폭·높이)가 달라지면 다른 덤불로 바뀐 것처럼 보인다. */
    const wet = shot('thorn', 0, 50, 1), dry = shot('thorn', 0, 50, .3);
    out.dry = { wetW: wet.wide, dryW: dry.wide, wetH: wet.h, dryH: dry.h,
      wetL: +wet.mean.toFixed(0), dryL: +dry.mean.toFixed(0), same: wet.sig === dry.sig };
    return out;
  });

  let bad = 0;
  // 변종 장수는 실측이 정했다 — 한 화면에 같이 보이는 개수의 90분위
  const WANT = { rock: 4, ruin: 2, thorn: 2 };
  for (const k of r.kinds) {
    if (!k.fits) { console.log(`!! ${k.name} — 판이 그 줄까지 자라지 않았다, 자리만 예약된 상태다`); bad++; }
    if (k.dryFits === false) { console.log(`!! ${k.name} — 시든 판이 판 밖이다`); bad++; }
    if (WANT[k.kind] && k.n !== WANT[k.kind]) {
      console.log(`!! ${k.name} — 변종이 ${k.n}장이다, 실측은 ${WANT[k.kind]}장을 요구한다`); bad++; }
  }
  for (const k of Object.keys(WANT))
    if (!r.kinds.some(x => x.kind === k)) { console.log(`!! OBS_ART 에 ${k} 가 없다`); bad++; }

  console.log('종류     변종  반지름   보이는 폭 / 판정 지름   높이');
  for (const s of r.shots) {
    const d = s.wide - s.collider;
    console.log(`${s.kind.padEnd(7)}  ${s.v + 1}    ${String(s.r).padStart(3)}      ${String(s.wide).padStart(4)} / ${String(s.collider).padStart(4)}`
      + `   (${d >= 0 ? '+' : ''}${d})      ${s.h}`);
    if (Math.abs(d) > Math.max(4, s.collider * .06)) {
      console.log(`  !! ${s.kind} 변종 ${s.v + 1} r=${s.r} — 보이는 폭 ${s.wide} 와 판정 지름 ${s.collider} 가 어긋난다`); bad++; }
    if (s.h < 8) { console.log(`  !! ${s.kind} 변종 ${s.v + 1} r=${s.r} — 아무것도 안 그려졌다`); bad++; }
  }

  /* 밝기는 겹의 자리다. 바닥 36 · 장식 48~52 · 장애물 57~97.
     장애물이 장식보다 어두우면 주워야 할 것처럼 보인다. 바꿔 넣은 절차
     그림의 값에 맞춘다 — 바위 97 · 폐허 58 · 덤불 86.

     이 값들은 한 번 다시 쟀다. 처음엔 어두운 칸을 배경으로 오해하는 자로 재서
     기준 자체가 부풀어 있었다. 자가 틀리면 비교 대상도 같이 틀린다. */
  const BAND = { rock: [84, 110], ruin: [48, 70], thorn: [76, 100] };
  for (const [kind, list] of Object.entries(r.lum)) {
    const [lo, hi] = BAND[kind] || [55, 135];
    console.log(`\n${kind} 밝기 ${list.join(' · ')}   (절차 ${kind === 'rock' ? 97 : kind === 'ruin' ? 58 : 86})`);
    for (const L of list) {
      if (L < lo) { console.log(`!! 밝기 ${L} — 바꿔 넣은 절차 그림(${lo}~${hi})보다 어둡다`); bad++; }
      if (L > hi) { console.log(`!! 밝기 ${L} — 바꿔 넣은 절차 그림(${lo}~${hi})보다 밝다`); bad++; }
    }
  }
  const D = r.dry;
  console.log(`\n시든 덤불 — 폭 ${D.wetW}→${D.dryW} · 높이 ${D.wetH}→${D.dryH} · 밝기 ${D.wetL}→${D.dryL}`);
  if (D.same) { console.log('!! 체력 절반 밑에서도 같은 그림이다 — 시드는 신호가 사라졌다'); bad++; }
  if (D.wetW !== D.dryW || Math.abs(D.wetH - D.dryH) > 2) {
    console.log('!! 시들면서 모양이 바뀐다 — 다른 덤불로 바뀐 것처럼 보인다'); bad++; }
  if (!(D.dryL < D.wetL - 8)) { console.log('!! 시든 것이 성한 것보다 눈에 띄게 어둡지 않다'); bad++; }
  if (new Set(r.sigs).size !== r.sigs.length) { console.log('!! 같은 그림이 두 번 들어갔다'); bad++; }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

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
    const A = OBS_ART.rock, f = Sprites.frames[A.key];
    const out = { has: !!A, frame: !!f,
      fits: !!(f && Sprites.atlas && f.y + f.h <= Sprites.atlas.height),
      n: A ? A.f.length : 0, shots: [], sigs: [], lum: null };

    /* 한 장을 마젠타 위에 그리고 가장 긴 연속 가로줄을 잰다.
       standUp 은 세로만 늘리므로 폭 측정에는 영향이 없다. */
    const shot = (v, rr) => {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, 520, 520);
      ctx.restore();
      drawObstacle({ key: 'p' + v, kind: 'rock', K: OBS_KINDS.rock, x: 260, y: 260, r: rr,
        st: { hp: 200, max: 200 }, seed: .4, v, flip: false });
      const d = ctx.getImageData(0, 0, 520, 520).data;
      let best = 0, lum = 0, cnt = 0, sig = 0, top = -1, bot = -1;
      for (let y = 0; y < 520; y++) {
        let run = 0;
        for (let x = 0; x < 520; x++) {
          const i = (y * 520 + x) << 2;
          if (d[i + 1] < 25) { run = 0; continue; }      // 마젠타 바탕과 그 그림자를 뺀다
          run++; if (run > best) best = run;
          const L = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
          lum += L; cnt++;
          sig = (sig * 31 + (d[i] >> 4) + x) % 1e9;
          if (top < 0) top = y; bot = y;
        }
      }
      return { v, r: rr, wide: best, h: bot - top + 1, mean: cnt ? lum / cnt : 0, sig };
    };
    for (let v = 0; v < out.n; v++) {
      const s = shot(v, 50);
      out.shots.push({ v, r: 50, wide: s.wide, collider: 100, h: s.h });
      out.sigs.push(s.sig);
      if (v === 0) out.lum = [];
      out.lum.push(+s.mean.toFixed(0));
    }
    // 크기를 흔들어도 관계가 유지되는가 — 배율이 잘못 걸리면 여기서 벌어진다
    for (const rr of [12, 25, 90]) {
      const s = shot(1, rr);
      out.shots.push({ v: 1, r: rr, wide: s.wide, collider: rr * 2, h: s.h });
    }
    return out;
  });

  let bad = 0;
  if (!r.has) { console.log('!! OBS_ART 에 바위가 없다'); bad++; }
  if (!r.fits) { console.log('!! 판이 바위 줄까지 자라지 않았다 — 자리만 예약된 상태다'); bad++; }
  if (r.n !== 4) { console.log(`!! 변종이 ${r.n}장이다 — 바위는 한 화면에 최대 9개라 4장이 필요하다`); bad++; }

  console.log('변종  반지름   보이는 폭 / 막히는 지름   높이');
  for (const s of r.shots) {
    const d = s.wide - s.collider;
    console.log(`  ${s.v + 1}     ${String(s.r).padStart(3)}      ${String(s.wide).padStart(4)} / ${String(s.collider).padStart(4)}`
      + `   (${d >= 0 ? '+' : ''}${d})      ${s.h}`);
    // 3px 격자에 붙는 것과 반올림을 감안한다
    if (Math.abs(d) > Math.max(4, s.collider * .06)) {
      console.log(`  !! 변종 ${s.v + 1} r=${s.r} — 보이는 폭 ${s.wide} 와 막히는 지름 ${s.collider} 가 어긋난다`); bad++; }
    if (s.h < 8) { console.log(`  !! 변종 ${s.v + 1} r=${s.r} — 아무것도 안 그려졌다`); bad++; }
  }

  console.log(`\n밝기 평균 ${r.lum.join(' · ')}   (바닥 36 · 장식 48~52 · 절차 바위 97)`);
  for (const L of r.lum) {
    if (L < 60) { console.log(`!! 밝기 ${L} — 장식 겹(48~52)에 붙었다. 장애물이 주울 것처럼 보인다`); bad++; }
    if (L > 135) { console.log(`!! 밝기 ${L} — 절차 바위(97)보다 너무 밝다`); bad++; }
  }
  if (new Set(r.sigs).size !== r.sigs.length) { console.log('!! 같은 그림이 두 번 들어갔다'); bad++; }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

/* 회귀: 걸을 때 이동감이 있는가 — 보폭(그림)과 몸의 오르내림(코드).

   「보폭이 약해 이동감이 덜하다」는 느낌이라 자가 없으면 고쳤는지 못 가른다.
   그래서 두 가지를 따로 잰다.

   ■ 보폭 — 그림이 만든다

   걷기 넉 장에서 **발 구간(인물 아래 16%)의 가로 폭**이 한 바퀴 동안 얼마나
   변하는지가 보폭이다. 재 보니 직업마다 딴판이었다.

       추적자   47~85   38px   접지 → 지나가기 → 접지 → 지나가기. 제대로 된 걷기
       성기사   64~80   16px   있긴 하다
       전사     46~52    6px   사실상 없다 — 서 있는 그림 넷이다
       마법사   51~54    3px   없다. 게다가 로브가 발목을 덮어 보일 자리도 없다

   전사·마법사는 **새 그림이 필요하다**(art-spec §107). 그때까지 이 자는 「있는
   것을 잃지 않는가」를 지킨다 — 추적자·성기사의 보폭이 줄면 잡는다.

   ■ 몸의 오르내림 — 코드가 만든다

   로브 입은 인물의 이동감은 발이 아니라 몸의 오르내림으로 읽힌다. 그리고 그건
   그림이 아니라 코드로 넣을 수 있어서 네 직업에 한꺼번에 걸린다.

   **그림자가 같이 안 올라가는 것이 요점이다.** 그림자는 몸 변환 밖에서 바닥에
   그려지므로 몸만 뜨고 그림자는 남아 「발이 땅을 밀었다」로 읽힌다. 둘이 같이
   움직이면 그냥 그림이 흔들리는 것이다 — 그래서 그림자의 y 도 함께 잰다.

   실행: node tests/walk-feel.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '../game/index.html'));
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const r = await pg.evaluate(() => {
    const out = { stride: {}, bob: {} };

    /* ① 보폭 — 아틀라스에서 직접 잰다. 화면을 안 거치므로 잡음이 없다. */
    const c = document.createElement('canvas'), g = c.getContext('2d');
    const footWidth = (key, i) => {
      const f = Sprites.frames[key];
      c.width = f.w; c.height = f.h;
      g.clearRect(0, 0, f.w, f.h);
      g.drawImage(Sprites.atlas, f.x + i * f.w, f.y, f.w, f.h, 0, 0, f.w, f.h);
      const d = g.getImageData(0, 0, f.w, f.h).data;
      let y0 = 1e9, y1 = -1;
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++)
        if (d[((y * f.w + x) << 2) + 3] > 40) { if (y < y0) y0 = y; if (y > y1) y1 = y; break; }
      const fy0 = Math.round(y1 - (y1 - y0 + 1) * .16);
      let fx0 = 1e9, fx1 = -1;
      for (let x = 0; x < f.w; x++)
        for (let y = fy0; y <= y1; y++)
          if (d[((y * f.w + x) << 2) + 3] > 40) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; break; }
      return fx1 - fx0 + 1;
    };
    for (const cls of ['paladin', 'warrior', 'rogue', 'mage']) {
      const ws = [0, 1, 2, 3].map(i => footWidth('hero_' + cls + '_walk', i));
      out.stride[cls] = { w: ws, span: Math.max(...ws) - Math.min(...ws) };
    }

    /* ② 몸의 오르내림 — 그리는 순간을 가로채 몸과 그림자의 y 를 함께 본다.
       걷는 위상 여덟을 돌며 각각 한 프레임씩 그린다. */
    const S0 = Sprites.draw.bind(Sprites), D0 = window.drawShadow;
    for (const [ci, cls] of [[0, 'paladin'], [1, 'warrior'], [2, 'rogue'], [3, 'mage']]) {
      selectedClass = ci; Game.reset(); Game.state = 'playing'; player.godMode = true;
      /* 무기를 뺀다. 안 그러면 자동 공격이 걸려 그림이 walk 가 아니라 attack 이 된다 —
         추적자·마법사는 아예 한 장도 안 잡혔다(전사 4장). 재려는 것은 걷기다. */
      player.weapons.length = 0;
      const body = [], shadow = [];
      Sprites.draw = function (key, sx, sy, ...rest) {
        if (key === 'hero_' + cls + '_walk') body.push(sy);
        return S0(key, sx, sy, ...rest);
      };
      window.drawShadow = function (sx, sy, ...rest) { shadow.push(sy); return D0(sx, sy, ...rest); };
      /* 실제로 걷게 한다. player.moving 을 손으로 켜 봐야 frame() 안의 update() 가
         입력을 다시 읽어 꺼 버린다 — 키를 잡아 두는 게 맞다.
         그리고 frame() 은 실시간 델타를 쓰므로 시각을 손으로 먹인다(1/60씩). */
      keys.add('d');
      const t0 = performance.now();
      for (let i = 0; i < 34; i++) {
        for (const e of enemies) e.active = false;
        Game.state = 'playing';
        player.actT = 0; player.castT = 0; player.dash = 0;
        frame(t0 + i * (1000 / 60));
      }
      keys.delete('d');
      Sprites.draw = S0; window.drawShadow = D0;
      const rel = body.map((y, i) => y - shadow[i]);          // 그림자 기준 몸의 높이
      out.bob[cls] = {
        n: body.length,
        span: +((Math.max(...rel) - Math.min(...rel)) * HERO_GROW).toFixed(2),
        shadowMoved: +(Math.max(...shadow) - Math.min(...shadow)).toFixed(2),
      };
    }
    return out;
  });

  const fail = [];
  console.log('보폭(발 폭 범위 · 한 바퀴)');
  for (const [k, v] of Object.entries(r.stride))
    console.log(`  ${k.padEnd(9)} ${v.w.join(' ')}  →  ${v.span}px`);
  console.log('몸의 오르내림(화면 px · 그림자 기준)');
  for (const [k, v] of Object.entries(r.bob))
    console.log(`  ${k.padEnd(9)} ${v.span}  (그림자 움직임 ${v.shadowMoved})`);

  /* 보폭은 **있는 것을 잃지 않는가**만 본다. 전사·마법사는 새 그림을 받기 전이라
     문턱을 못 세운다 — 세우면 오늘 당장 빨간불이고, 빨간불로 두면 다른 회귀를 못 본다.
     대신 그 둘의 값을 늘 찍어 둔다(위 줄). 그림이 오면 문턱을 세운다. */
  if (r.stride.rogue.span < 30)
    fail.push(`추적자 보폭이 ${r.stride.rogue.span}px — 30 아래로 떨어졌다(기준선 38)`);
  if (r.stride.paladin.span < 12)
    fail.push(`성기사 보폭이 ${r.stride.paladin.span}px — 12 아래로 떨어졌다(기준선 16)`);

  for (const [k, v] of Object.entries(r.bob)) {
    if (v.n < 8) fail.push(`${k}: 걷는 그림이 ${v.n}번만 그려졌다 — 장면이 안 만들어졌다`);
    if (!(v.span > 2 && v.span < 6))
      fail.push(`${k}: 몸이 ${v.span}px 오르내린다 — 2~6px 이어야 한다(안 움직이면 이동감이 없고, 크면 뜬다)`);
    if (v.shadowMoved > .01)
      fail.push(`${k}: 그림자가 ${v.shadowMoved}px 같이 움직였다 — 그림자는 바닥에 남아야 「발이 땅을 밀었다」가 된다`);
  }

  fail.push(...errs);
  await b.close();
  console.log(fail.length ? '\nFAIL\n - ' + fail.join('\n - ') : '\nPASS');
  process.exit(fail.length ? 1 : 0);
})();

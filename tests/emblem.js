/* 회귀: 문장 넉 장이 제자리에 그려지는가. 그리고 제단의 구슬이 여전히 자라는가.

   문장은 한 아틀라스 줄(emblem)에 넉 장이 들어 있고, 부르는 자리가 넷 다 다르다 —
   인트로 대문장 · 영혼의 제단 · 승리 · 쓰러짐. 줄 하나에 배율 하나를 두면
   어딘가는 반드시 어긋나므로 배율은 부르는 자리에서 준다. 그래서 '아틀라스에
   들어갔다'만으로는 부족하고, 네 화면을 실제로 그려 봐야 한다.

   ── 제단이 까다롭다

   제단 그림은 기둥과 구슬이 한 장에 같이 그려져 있는데, **구슬은 그림이 아니라
   신호다** — 곳간이 찰수록 자라고 사면 켜진다(숫자를 안 읽어도 얼마나 모았는지
   보이라고 넣은 것이다). 그래서 받은 그림에서 구슬 자리(칸의 y 6~39)를 잘라 내고
   돌만 쓰고, 구슬은 절차로 남겼다.

   잘라내기가 풀리면 **곳간이 비어도 큰 구슬이 얹혀 있게 된다.** 화면은 멀쩡해
   보이는데 신호만 죽는, 눈으로는 못 잡는 종류다. 그래서 곳간 0 과 가득 참을
   둘 다 그려 보라색 넓이를 견준다 — 자라지 않으면 두 값이 같다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const r = await pg.evaluate(() => {
    const out = { frame: null, cells: [], screens: {}, orb: {} };
    const f = Sprites.frames.emblem;
    out.frame = f ? { ...f, fits: f.y + f.h <= Sprites.atlas.height } : null;

    // 넉 장이 아틀라스에 실제로 있고 서로 다른가
    const c = document.createElement('canvas'); c.width = f.w * f.n; c.height = f.h;
    const g = c.getContext('2d');
    g.drawImage(Sprites.atlas, f.x, f.y, f.w * f.n, f.h, 0, 0, f.w * f.n, f.h);
    for (let i = 0; i < f.n; i++) {
      const d = g.getImageData(i * f.w, 0, f.w, f.h).data;
      let op = 0, sig = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 200) { op++; sig = (sig * 31 + (d[k] >> 4) + (k >> 8)) % 1e9; }
      out.cells.push({ op, sig });
    }

    // 네 화면을 실제로 그린다. 문장이 앉는 상자에 무엇이 찍혔는지 센다.
    const shot = (x, y, w, h) => {
      const d = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).data;
      let lit = 0, violet = 0;
      for (let k = 0; k < d.length; k += 4) {
        const R = d[k], G = d[k + 1], B = d[k + 2];
        if (R * .299 + G * .587 + B * .114 > 70) lit++;
        if (B - G > 26 && R - G > 8 && B > 70) violet++;
      }
      return { lit, violet };
    };
    const draw = () => { mouse.x = -99; mouse.y = -99; ctx.setTransform(1, 0, 0, 1, 0, 0); frame(performance.now()); };

    Game.state = 'intro'; draw();
    out.screens.intro = shot(W / 2 - 60, 150 - 60, 120, 120);

    selectedClass = 0; Game.reset(); Game.time = 900; Game.kills = 14000;
    Game.state = 'won'; Game.endRun(); draw();
    out.screens.won = shot(W / 2 - 60, H / 2 - 186 - 104, 120, 104);

    selectedClass = 0; Game.reset(); Game.time = 300; Game.kills = 9000;
    Game.state = 'dead'; Game.endRun(); draw();
    out.screens.dead = shot(W / 2 - 60, H / 2 - 186 - 104, 120, 104);

    /* 제단 — 곳간이 비었을 때와 가득 찼을 때의 구슬 넓이를 견준다.
       잘라내기가 풀리면 그림의 큰 구슬이 늘 얹혀 있어 두 값이 같아진다. */
    Game.introFrom = 'title'; Game.state = 'altar'; Game.altarFlash = 0;
    for (const [name, souls] of [['empty', 0], ['full', 40000]]) {
      Meta.souls = souls; draw();
      out.orb[name] = shot(W / 2 - 90, 0, 180, H);
    }
    out.screens.altar = out.orb.full;
    return out;
  });

  let bad = 0;
  const F = r.frame;
  if (!F) { console.log('!! emblem 줄이 없다'); bad++; }
  else {
    console.log(`아틀라스 emblem  x=${F.x} y=${F.y} ${F.w}×${F.h} ×${F.n}장  판 안에 들어감 ${F.fits}`);
    if (!F.fits) { console.log('!! 판이 그 줄까지 자라지 않았다 — 그림 없이 자리만 잡혔다'); bad++; }
    if (F.n !== 4) { console.log('!! 넉 장이 아니다'); bad++; }
  }
  const ops = r.cells.map(c => c.op);
  console.log('장별 불투명 칸: ' + ops.join(' · '));
  r.cells.forEach((c, i) => { if (c.op < 1500) { console.log(`!! ${i}번 장이 비었다 (${c.op}칸)`); bad++; } });
  if (new Set(r.cells.map(c => c.sig)).size !== r.cells.length) { console.log('!! 같은 그림이 두 번 들어갔다'); bad++; }

  for (const [k, v] of Object.entries(r.screens)) {
    console.log(`${k.padEnd(6)} 문장 자리 밝은 픽셀 ${v.lit}`);
    if (v.lit < 900) { console.log(`!! ${k} 화면에 문장이 안 그려졌다`); bad++; }
  }

  const e = r.orb.empty.violet, fl = r.orb.full.violet;
  console.log(`제단 구슬 — 곳간 0: 보라 ${e}px · 가득: ${fl}px  (${(fl / Math.max(1, e)).toFixed(2)}배)`);
  if (fl < e * 1.25) { console.log('!! 구슬이 곳간을 따라 자라지 않는다 — 그림의 구슬이 잘리지 않았을 수 있다'); bad++; }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

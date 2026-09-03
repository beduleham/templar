/* 회귀: 첫 화면의 배경 그림이 제자리에 있고, 글자를 먹지 않는가.

   이 화면은 두 번 어긋났고 두 번 다 눈으로만 잡혔다(§106).
     너무 누르면 — 그림이 통째로 사라져 검은 화면에 글자만 남는다
     덜 누르면  — 기사의 밝은 갑주 위에 작은 글자가 얹혀 안 읽힌다
   그래서 양쪽을 다 재는 자를 둔다.

   재는 것:
     1. 그림이 실렸다 (Bg.ready, 1280px 이상)
     2. 인트로·직업 선택에서만 그린다 — 판 안에서는 안 그린다
     3. 글자 대비 — 글자띠에서 99.3분위(글자) − 중앙값(바탕) ≥ 110
     4. 바탕이 어둡다 — 글자띠 중앙값 ≤ 45 (문지르는 겹이 일한다)
     5. 그림이 보인다 — 좌우 가장자리의 밝기 표준편차 ≥ 5
        (통째로 눌러 평평해지면 0 에 가까워진다. 관측 10.7~32.6)
     6. 가로·세로 둘 다에서

   실행: node tests/main-bg.js */
const { chromium } = require('playwright');

/* 픽셀은 판 안에서 잰다 — 다른 회귀들과 같은 방식이고, 스크린샷을 풀 의존성이 없다. */
const MEASURE = `(() => {
  const cv = document.getElementById('game');
  const cx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const d = cx.getImageData(0, 0, W, H).data;
  const band = [], side = [];
  const step = Math.max(1, Math.round(Math.min(W, H) / 480));   // 큰 화면에서는 성기게 훑는다
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    const i = (y * W + x) * 4;
    const L = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
    const fy = y / H, fx = x / W;
    if (fy >= .30 && fy < .86 && fx >= .10 && fx < .90) band.push(L);
    else if (fy < .55 && (fx < .16 || fx >= .84)) side.push(L);
  }
  band.sort((a, b) => a - b);
  const q = f => band[Math.min(band.length - 1, Math.floor(band.length * f))];
  const mean = side.reduce((a, b) => a + b, 0) / side.length;
  const sd = Math.sqrt(side.reduce((a, b) => a + (b - mean) * (b - mean), 0) / side.length);
  return { text: q(.993), base: q(.5), sideSd: sd };
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const fail = [];
  const out = [];
  for (const [tag, w, h] of [['가로', 1280, 720], ['세로', 420, 860]]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } });
    const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await pg.goto('file:///home/user/templar/game/index.html');
    await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
    await pg.waitForFunction('Bg.ready', null, { timeout: 20000 }).catch(() => {});

    const info = await pg.evaluate(() => ({ ready: Bg.ready, w: Bg.img && Bg.img.width, h: Bg.img && Bg.img.height }));
    if (!info.ready) { fail.push(`${tag}: 배경 그림이 안 실렸다`); }
    if ((info.w | 0) < 1280) fail.push(`${tag}: 배경 그림이 ${info.w}px — 1280 이상이어야 한다`);

    // 2. 어느 화면에서 그리는가 — draw 를 세어 본다
    const drawn = await pg.evaluate(async () => {
      const D = Bg.draw.bind(Bg); const n = {};
      let cur = '';
      Bg.draw = function () { n[cur] = (n[cur] || 0) + 1; return D(); };
      const wait = ms => new Promise(r => setTimeout(r, ms));
      for (const st of ['intro', 'title', 'altar']) { cur = st; Game.state = st; await wait(120); }
      cur = 'playing'; selectedClass = 0; Game.reset(); Game.state = 'playing'; await wait(120);
      Bg.draw = D; Game.state = 'intro'; await wait(60);
      return n;
    });
    if (!(drawn.intro > 0)) fail.push(`${tag}: 인트로에 배경 그림이 안 그려진다`);
    if (!(drawn.title > 0)) fail.push(`${tag}: 직업 선택에 배경 그림이 안 그려진다`);
    if (drawn.playing) fail.push(`${tag}: 판 안에서 배경 그림이 그려진다 (${drawn.playing}회)`);
    if (drawn.altar) fail.push(`${tag}: 제단에서 배경 그림이 그려진다 — 거기는 데모가 보여야 한다`);

    // 3~5. 글자 대비와 그림의 결
    for (const st of ['intro', 'title']) {
      await pg.evaluate((s) => { Game.state = s; }, st);
      await pg.waitForTimeout(200);
      const s = await pg.evaluate(MEASURE);
      const contrast = s.text - s.base;
      out.push(`${tag} ${st === 'intro' ? '인트로' : '직업선택'}  글자 ${s.text.toFixed(0)} · 바탕 ${s.base.toFixed(0)} · 대비 ${contrast.toFixed(0)} · 옆결 ${s.sideSd.toFixed(1)}`);
      if (contrast < 110) fail.push(`${tag}/${st}: 글자 대비 ${contrast.toFixed(0)} — 110 이상이어야 한다 (글자가 그림에 먹힌다)`);
      if (s.base > 45) fail.push(`${tag}/${st}: 글자띠 바탕이 ${s.base.toFixed(0)} — 45 이하여야 한다 (문지르는 겹이 약하다)`);
      if (s.sideSd < 5) fail.push(`${tag}/${st}: 가장자리 결이 ${s.sideSd.toFixed(1)} — 5 이상이어야 한다 (그림이 통째로 눌려 사라졌다)`);
    }
    fail.push(...errs);
    await pg.close();
  }
  await b.close();
  console.log(out.join('\n'));
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  process.exit(fail.length ? 1 : 0);
})();

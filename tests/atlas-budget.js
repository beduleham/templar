/* 회귀: 아틀라스가 예산 안에 있고, 브라우저가 실제로 푼다.

   파일의 90% 가 아틀라스 하나였다(9.67MB 중 8.70MB). WebP 무손실로 바꿔 6.39MB 가
   됐는데, 여기에는 조용히 깨질 수 있는 자리가 둘 있다(§109).

     ① WebP 는 한 변이 16383px 을 못 넘는다. 넘기면 인코더가 거부하므로 도구가
        멈춘다 — 그건 잡힌다. 문제는 **한 변이 16383 에 가까워지는 것**이다.
        그림을 몇 장 더 넣으면 어느 날 갑자기 도구가 안 돈다.
     ② data URI 의 형식이 틀려도 코드는 안 죽는다. Sprites.load 는 onerror 에서
        조용히 ready=false 로 두고 게임은 도형 렌더링으로 계속 돈다 — 그림이 통째로
        사라진 채로 '정상 동작'한다.

   재는 것:
     1. game/index.html 이 7MB 안
     2. 아틀라스가 WebP 로 실려 있다
     3. 브라우저가 실제로 풀었다 — Sprites.ready 이고 프레임이 다 있다
     4. 아틀라스 한 변이 15000 안 (16383 까지 여유 1383)

   실행: node tests/atlas-budget.js */
const { chromium } = require('playwright');
const fs = require('fs');

const MB = 1024 * 1024, BUDGET = 7 * MB, SIDE_MAX = 15000, WEBP_MAX = 16383;

(async () => {
  const fail = [], out = [];
  const path = '/home/user/templar/game/index.html';
  const size = fs.statSync(path).size;
  out.push(`game/index.html ${(size / MB).toFixed(2)}MB (예산 ${BUDGET / MB}MB)`);
  if (size > BUDGET) fail.push(`파일이 ${(size / MB).toFixed(2)}MB — 예산 ${BUDGET / MB}MB 를 넘었다`);

  const html = fs.readFileSync(path, 'utf8');
  const m = html.match(/Sprites\.load\("data:image\/(\w+);base64,/);
  if (!m) fail.push('Sprites.load 의 data URI 를 못 찾았다');
  else {
    out.push(`아틀라스 형식 ${m[1]}`);
    if (m[1] !== 'webp') fail.push(`아틀라스가 ${m[1]} 로 실려 있다 — WebP 무손실이어야 한다 (PNG 보다 36% 작다)`);
  }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file://' + path);
  await pg.waitForFunction('typeof Game !== "undefined"', null, { timeout: 20000 });
  await pg.waitForFunction('Sprites.ready', null, { timeout: 20000 })
    .catch(() => fail.push('브라우저가 아틀라스를 못 풀었다 — Sprites.ready 가 안 선다 (형식이 틀리면 조용히 도형으로 떨어진다)'));

  const r = await pg.evaluate(() => ({
    ready: Sprites.ready,
    w: Sprites.atlas && Sprites.atlas.naturalWidth,
    h: Sprites.atlas && Sprites.atlas.naturalHeight,
    n: Object.keys(Sprites.frames).length,
    /* 선언한 프레임이 그림 밖으로 나가면 그 칸은 빈칸으로 그려진다 — 재묶기가
       y 를 잘못 옮기면 여기서 잡힌다. */
    outside: Object.entries(Sprites.frames).filter(([, f]) =>
      f.y + f.h > (Sprites.atlas ? Sprites.atlas.naturalHeight : 0) ||
      f.x + f.w * (f.n || 1) > (Sprites.atlas ? Sprites.atlas.naturalWidth : 0)).map(([k]) => k),
  }));
  out.push(`아틀라스 ${r.w}x${r.h} · 프레임 ${r.n}개`);
  if (!r.ready) fail.push('Sprites.ready 가 false 다');
  if (Math.max(r.w || 0, r.h || 0) > SIDE_MAX)
    fail.push(`아틀라스 한 변이 ${Math.max(r.w, r.h)} — ${SIDE_MAX} 안이어야 한다 (WebP 한계 ${WEBP_MAX} 까지 여유를 남긴다)`);
  if (r.n < 150) fail.push(`프레임이 ${r.n}개뿐이다`);
  if (r.outside.length) fail.push(`그림 밖으로 나간 프레임 ${r.outside.length}개: ${r.outside.slice(0, 5).join(', ')}`);

  fail.push(...errs);
  await b.close();
  console.log(out.join('\n'));
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  process.exit(fail.length ? 1 : 0);
})();

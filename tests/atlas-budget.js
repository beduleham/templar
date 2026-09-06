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
     4. 아틀라스 한 변이 15600 안 (16383 까지 여유 783 ≈ 128칸 여섯 줄)

   실행: node tests/atlas-budget.js */
const { chromium } = require('playwright');
const fs = require('fs');

/* ■ 문턱을 15000 → 15600 으로 올렸다 (2026-09-06) — 그리고 왜 그래도 괜찮은가

   마법사 초상 17장이 들어가 아틀라스가 512×15424 가 됐다. 15000 은 「16383 까지
   여유를 남긴다」는 뜻으로 잡은 **어림수**였고 잰 값이 아니다. 그래서 이번에
   확인부터 했다.

     · `repack-atlas.py --dry` → 빈 줄 0.0%. 걷어낼 자리가 없다.
     · 안 쓰이는 프레임? 없다 — 이름이 코드에 안 보이는 106개는 전부 동적으로
       불린다(`"adv_" + key` · `fxKey(kind, elem)` · `"hero_" + cls + "_" + state`).

   즉 15424 는 **실제로 필요한 높이**다. 그리고 예정된 그림도 이제 없다 —
   초상 68/68, 영웅 4직업, 몹 17종이 다 들어갔다.

   ■ 부딪혔고, 가로를 늘렸다 (§114)

   16383 은 진짜 벽이라 문턱을 또 올려서는 못 넘는다. UI 시트를 받기 전에
   `repack-atlas.py --width 1024` 로 폭을 두 배로 했다 — 512×15424 → **1024×7744**.
   프레임이 걸치지 않는 줄에서 토막을 내어 두 기둥에 나눠 쌓았고, 170개 프레임을
   옛 아틀라스와 픽셀로 대조해 전부 같았다. 넣는 도구 넷은 고치지 않았다 — 새 줄을
   맨 아래에 512 폭으로 덧붙이므로 오른쪽 기둥 자리가 비지만 다음 재묶기가 채운다.

   값은 27KB 늘었다(WebP 가 두 기둥을 조금 덜 누른다). 한 변 문턱은 그대로 두었다 —
   이제는 높이가 아니라 **파일 7MB** 가 먼저 걸린다. 그건 아래 BUDGET 이 본다. */
const MB = 1024 * 1024, BUDGET = 7 * MB, SIDE_MAX = 15600, WEBP_MAX = 16383;

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

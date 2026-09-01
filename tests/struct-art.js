/* 회귀: 배경 건물 넷이 손그림으로 서고, 밑동이 충돌 원과 맞는가.

   ── 무엇이 문제였나

   건물은 화면에서 157~276px 로 이 게임에서 가장 큰 물건인데 **색칠한 상자**였다.
   바닥과 장식을 손그림으로 갈면서 건물만 빠져 있었다.

   ── 왜 밑동을 재는가

   받은 그림은 옛 도형보다 통통하다. 높이를 예전에 맞추면 밑동이 충돌 원보다
   1.24~1.54배 넓어져 **건물 안에 서 있게 된다.** 옛 도형은 밑동 = R,
   충돌 지름 = R×1.04 로 거의 같았으므로 그 규칙을 잇는다 — 그림이 아니라
   땅에 닿는 부분에 맞춘다(§76 장식과 같다).

   그래서 이 테스트는 **보이는 밑동과 막히는 원이 같은지**를 잰다. 둘이 어긋나면
   화면은 멀쩡한데 걸어 보면 이상한, 눈으로는 못 잡는 종류의 회귀가 된다.

   ── 맥동 자리

   켜졌을 때 빛나는 심장부의 좌표는 옛 도형에 박혀 있었다. 그림이 바뀌면 벽
   한복판이 빛난다. 지금은 그림에서 잰 어두운 구멍(ST_ART.hx·hy)을 쓰므로,
   그 자리가 실제로 그림의 어두운 곳인지 확인한다.

   실행: node tests/struct-art.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const r = await pg.evaluate(() => {
    const out = { kinds: Object.keys(ST_KINDS), art: {}, dark: !!Sprites.darkAtlas };
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    for (const kind of out.kinds) {
      const A = ST_ART[kind], K = ST_KINDS[kind];
      if (!A) { out.art[kind] = null; continue; }
      const f = Sprites.frames[A.key];
      const fits = f && Sprites.atlas && f.y + f.h <= Sprites.atlas.height;
      let op = 0, base = 0, holeDark = 0, sig = 0;
      if (fits) {
        g.clearRect(0, 0, 256, 256);
        g.drawImage(Sprites.atlas, f.x + A.idx * f.w, f.y, f.w, f.h, 0, 0, 256, 256);
        const d = g.getImageData(0, 0, 256, 256).data;
        const at = (x, y) => d[((y * 256 + x) << 2) + 3] > 200;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { op++; sig = (sig * 31 + (d[i] >> 4) + (i >> 9)) % 1e9; }
        // 아래 8% 줄의 평균 폭 = 땅에 닿는 폭
        const y1 = A.y0 + A.h - 1, n = Math.max(1, Math.round(A.h * .08));
        let sum = 0;
        for (let y = y1 - n + 1; y <= y1; y++) { let w = 0; for (let x = 0; x < 256; x++) if (at(x, y)) w++; sum += w; }
        base = sum / n;
        // 맥동이 앉는 자리가 실제로 어두운가
        const hx = Math.round(A.x0 + A.w / 2 + A.hx * A.w);
        const hy = Math.round(A.y0 + A.h + A.hy * A.h);
        let lum = 0, cnt = 0;
        for (let y = hy - 6; y <= hy + 6; y++) for (let x = hx - 6; x <= hx + 6; x++) {
          if (x < 0 || x > 255 || y < 0 || y > 255) continue;
          const i = (y * 256 + x) << 2;
          if (d[i + 3] < 100) continue;
          lum += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; cnt++;
        }
        holeDark = cnt ? lum / cnt : 999;
      }
      const k = K.r * 1.04 / A.base;
      out.art[kind] = { name: K.name, fits: !!fits, op, sig,
        declBase: A.base, realBase: +base.toFixed(1),
        drawnBase: +(base * k).toFixed(1), collider: +(K.r * 1.04).toFixed(1),
        drawnH: +(A.h * k).toFixed(0), holeDark: +holeDark.toFixed(0) };
    }
    return out;
  });

  let bad = 0;
  if (!r.dark) { console.log('!! 어두운 판(darkAtlas)이 구워지지 않았다 — 꺼진 건물이 안 잠든다'); bad++; }
  console.log('건물      그림칸  선언밑동/실측  화면 밑동 / 충돌지름   화면높이  구멍밝기');
  const sigs = [];
  for (const [kind, v] of Object.entries(r.art)) {
    if (!v) { console.log(`!! ${kind} 의 그림 표(ST_ART)가 없다`); bad++; continue; }
    console.log(`${v.name.padEnd(9)} ${String(v.op).padStart(6)}  ${String(v.declBase).padStart(4)}/${String(v.realBase).padStart(6)}`
      + `   ${String(v.drawnBase).padStart(6)} / ${String(v.collider).padStart(6)}   ${String(v.drawnH).padStart(6)}   ${v.holeDark}`);
    if (!v.fits) { console.log(`!! ${v.name} — 판이 그 줄까지 자라지 않았다`); bad++; }
    if (v.op < 12000) { console.log(`!! ${v.name} 그림이 비었다 (${v.op}칸)`); bad++; }
    // 적어 둔 밑동이 실제 그림과 맞는가 — 그림을 갈면 여기부터 어긋난다
    if (Math.abs(v.declBase - v.realBase) > 6) {
      console.log(`!! ${v.name} — ST_ART.base(${v.declBase}) 가 그림의 실측(${v.realBase}) 과 다르다`); bad++; }
    // 보이는 밑동 = 막히는 원
    if (Math.abs(v.drawnBase - v.collider) > 8) {
      console.log(`!! ${v.name} — 보이는 밑동 ${v.drawnBase} 와 충돌 지름 ${v.collider} 가 어긋난다`); bad++; }
    // 맥동 자리가 어두운 구멍인가
    if (v.holeDark > 70) { console.log(`!! ${v.name} — 맥동 자리(밝기 ${v.holeDark})가 어두운 구멍이 아니다`); bad++; }
    sigs.push(v.sig);
  }
  if (new Set(sigs).size !== sigs.length) { console.log('!! 같은 그림이 두 번 들어갔다'); bad++; }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

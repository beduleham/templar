/* 회귀: 10분 화면이 읽히는가 — 후반 가독성(§101).

   재평가에서 10분 이후 화면이 고리·폭발·정예 체력바로 포화되어 주인공을 찾기 어려웠다.
   실측(고치기 전): 활성 적의 31~35% 가 등급, 체력바 62~91개, 입자 460~470, 화면 중앙의
   밝은 픽셀 3.6~21%, 파동 15~19개. 고친 뒤: 등급 15~17%, 체력바 11~14, 입자 258~358,
   밝은 픽셀 3.4~5.1%.

   재는 법: 성기사 봇(자세 켬·무적)으로 600초를 돌린 뒤 한 프레임을 그려 센다. 봇 판은
   무작위라 문턱은 넉넉히 잡는다 — 잡으려는 것은 '다시 포화되는 회귀'다.

   실행: node tests/late-readability.js */
const { chromium } = require('playwright');
const { BOT } = require('./bot.js');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '../game/index.html'));
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  await pg.evaluate((B) => { (0, eval)(B); }, BOT);
  const r = await pg.evaluate(() => {
    selectedClass = 0; Game.reset(); botInstall(); Game.state = 'playing';
    while (Game.time < 600) {
      if (Game.state === 'levelup' || Game.state === 'advance') { Game.applyChoice(Game.choices.find(c => c.type !== 'heal') || Game.choices[0]); continue; }
      if (Game.state !== 'playing') break;
      botTick(1 / 60, true); player.hp = player.stats.maxHp; update(1 / 60);
    }
    Game.state = 'playing';
    // 여덞 프레임을 0.25초 간격으로 재어 평균 — 폭발 타이밍 하나에 휘둘리지 않게
    const acc = { bars: 0, bright: 0, particles: 0, waves: 0 }; const N = 8;
    for (let k = 0; k < N; k++) {
      for (let i = 0; i < 15; i++) { botTick(1 / 60, true); player.hp = player.stats.maxHp; update(1 / 60); }
      Game.state = 'playing';
      let bars = 0; const ofr = ctx.fillRect.bind(ctx);
      ctx.fillRect = function (x, y, w, h) { if (this.fillStyle === '#ff4d6d' && h < 12) bars++; return ofr(x, y, w, h); };
      frame(performance.now()); ctx.fillRect = ofr;
      const d = ctx.getImageData(0, 0, W, H).data; let bright = 0, n = 0;
      for (let y = H * .18; y < H * .85; y += 2) for (let x = W * .2; x < W * .8; x += 2) {
        const i = ((y | 0) * W + (x | 0)) << 2; n++; if (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114 > 170) bright++;
      }
      let npt = 0; for (const p of particles) if (p.active) npt++;
      let nw = 0; for (const w of waves) if (w.active) nw++;
      acc.bars += bars / N; acc.bright += bright / n * 100 / N; acc.particles += npt / N; acc.waves += nw / N;
    }
    let ne = 0, ranked = 0; for (const e of enemies) if (e.active) { ne++; if (e.rank && e.rank.ring) ranked++; }
    // 폭발 그림의 최대 크기 — 상한(130px)이 코드에서 빠지면 여기서 잡힌다
    let boomMax = 0; for (const f of fxs) if (f.active && f.key.indexOf('fx_boom') === 0) boomMax = Math.max(boomMax, Math.round(f.scale * ATLAS_FRAMES[f.key].w));
    return { boomMax, enemies: ne, ranked, ratio: +(ranked / ne).toFixed(3), bars: +acc.bars.toFixed(1), bright: +acc.bright.toFixed(1), particles: Math.round(acc.particles), waves: +acc.waves.toFixed(1), lv: player.level };
  });
  console.log(`10분: 적 ${r.enemies} · 등급 ${r.ranked} (${(r.ratio * 100).toFixed(0)}%) · 체력바 ${r.bars} · 밝은 픽셀 ${r.bright}% · 입자 ${r.particles} · 파동 ${r.waves} · 폭발 최대 ${r.boomMax}px · lv${r.lv}`);
  let bad = 0;
  if (r.ratio > .22) { console.log(`!! 등급 적 비율 ${(r.ratio * 100).toFixed(0)}% — 22% 를 넘는다(고치기 전 31~35%)`); bad++; }
  if (r.bars > 25) { console.log(`!! 체력바 ${r.bars}개 — 25 를 넘는다(고치기 전 62~91)`); bad++; }
  /* 밝은 픽셀 비율은 빌드(연쇄 폭발 유무)와 폭발 타이밍에 따라 10~14% 를 오간다. 층별로 꺼 보면
     폭발 그림이 4포인트, 나머지 5% 는 적·수정·보스 자체다. 그래서 이 값은 정밀 문턱이 아니라
     '다시 포화되지 않았나'의 상한(18%)이고, 정밀한 것은 등급 비율·체력바·입자·폭발 크기다. */
  if (r.bright > 18) { console.log(`!! 화면 중앙 밝은 픽셀 ${r.bright}% — 18% 를 넘는다(고치기 전 한 프레임 21%)`); bad++; }
  if (r.boomMax > 130) { console.log(`!! 폭발 그림 ${r.boomMax}px — 상한 130 이 빠졌다`); bad++; }
  if (r.particles > 420) { console.log(`!! 입자 ${r.particles} — 예산(300마리에서 40%)이 안 먹는다`); bad++; }
  if (r.enemies < 150) { console.log(`!! 10분에 적이 ${r.enemies} — 판이 제대로 안 굴렀다`); bad++; }
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close(); process.exit(bad ? 1 : 0);
})();

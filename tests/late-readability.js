/* 회귀: 10분 화면이 읽히는가 — 후반 가독성(§101).

   재평가에서 10분 이후 화면이 고리·폭발·정예 체력바로 포화되어 주인공을 찾기 어려웠다.
   실측(고치기 전): 활성 적의 31~35% 가 등급, 체력바 62~91개, 입자 460~470, 화면 중앙의
   밝은 픽셀 3.6~21%, 파동 15~19개. 고친 뒤: 등급 15~17%, 체력바 11~14, 입자 258~358,
   밝은 픽셀 3.4~5.1%.

   재는 법: 성기사 봇(자세 켬·무적)으로 600초를 돌린 뒤 한 프레임을 그려 센다. 봇 판은
   무작위라 문턱은 넉넉히 잡는다 — 잡으려는 것은 '다시 포화되는 회귀'다.

   그리고 **이펙트 예산은 만든 장면에서 따로 잰다.** 봇 판의 밝은 픽셀은 같은 코드로
   5.3~11.5% 를 오가서 그것만으로는 고쳤는지 못 가른다(성기사 회복에서 배운 것과
   같다). 적도 봇도 없는 빈 판에 이펙트만 정해진 수만큼 놓으면 잡음이 없다.

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
  /* ── 이펙트 예산은 **만든 장면**에서 잰다

     위의 10분 판 수치는 봇 판이라 잡음이 크다(같은 코드로 밝은 픽셀 5.3~11.5%).
     그래서 「고쳤는가」는 그것으로 안 가른다 — 적도 봇도 없는 빈 판에 이펙트만
     정해진 수만큼 놓고 잰다. 잡음이 없다.

     13분 화면을 층별로 꺼서 밝기의 근원을 셌더니 이랬다(고치기 전):
         이펙트 39% · 파동 25% · 보석 20% · 숫자 -4% · 입자 -6%
     숫자와 입자는 **끄면 오히려 밝아졌다** — 검은 테와 어두운 알갱이가 뒤를 가리고
     있었다. 「숫자가 많아서 눈부시다」는 틀린 진단이었다(가리는 문제지 빛나는 문제가
     아니다). 그래서 셋을 각각 다르게 고쳤고, 여기서 셋을 각각 잰다. */
  const bud = await pg.evaluate(() => {
    const wait = () => { frame(performance.now()); };
    const clearAll = () => {
      for (const pool of [enemies, fxs, waves, numbers, particles, gems, projectiles, hazards, pickups])
        for (const o of pool) o.active = false;
      fxLive = 0; numLive = 0;
    };
    const bright = () => {
      const d = ctx.getImageData(0, 0, W, H).data; let n = 0, hit = 0;
      for (let y = H * .2; y < H * .8; y += 2) for (let x = W * .2; x < W * .8; x += 2) {
        const i = ((y | 0) * W + (x | 0)) << 2; n++;
        if (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114 > 170) hit++;
      }
      return hit / n * 100;
    };
    selectedClass = 0; Game.reset(); Game.state = 'playing';
    const o = {};
    // ① 이펙트: 여덟 발과 마흔 발. 가산 합성이라 예산이 없으면 다섯 배로 탄다.
    const booms = (n) => {
      clearAll();
      for (let i = 0; i < n; i++)
        spawnFx('fx_boom_holy', player.x + (i % 8 - 4) * 70, player.y + ((i / 8 | 0) - 2) * 70, 120, 0);
      wait(); return bright();
    };
    o.boom8 = +booms(8).toFixed(2); o.boom40 = +booms(40).toFixed(2);
    o.boomRatio = +(o.boom40 / Math.max(.01, o.boom8)).toFixed(2);
    /* ② 파동: 큰 고리는 화면을 가로지르는 줄일 뿐이라 흐려야 한다.

       화면 픽셀로 재려다 세 번 헛짚었다 — 파동은 r = maxR × √t 로 퍼져서 maxR 자리에는
       고리가 없고, 자리를 옮기니 이번엔 주인공의 방벽이 띠에 걸렸다. 값이 안 움직이는
       검사는 검사가 아니다. 모양은 함수에서 재고, 실제로 조용해졌는지는 눈으로 본다. */
    o.ink = [40, 90, 160, 240, 400].map(r => +waveInk(r).toFixed(2));

    // ③ 숫자: 예산이 걸리는가. 치명타가 아닌 것은 NUM_BUDGET 에서 멈춘다.
    clearAll();
    for (let i = 0; i < 200; i++) spawnNumber(player.x + i % 40 * 12, player.y, 100, '#fff', 14, 1000 + i);
    o.plain = numbers.filter(n => n.active).length;
    clearAll();
    for (let i = 0; i < 200; i++) spawnNumber(player.x + i % 40 * 12, player.y, 100, '#fff', 19, 2000 + i);
    o.crit = numbers.filter(n => n.active).length;
    // 붙는 것은 안 막힌다 — 같은 적을 계속 때리면 숫자가 자란다
    clearAll();
    spawnNumber(player.x, player.y, 100, '#fff', 14, 7);
    for (let i = 0; i < 300; i++) spawnNumber(player.x + i, player.y, 100, '#fff', 14, 1000 + i);
    const before = numbers.find(n => n.active && n.eid === 7);
    spawnNumber(player.x, player.y, 55, '#fff', 14, 7);
    o.merged = before ? before.val : 0;
    o.budget = NUM_BUDGET;
    clearAll();
    return o;
  });
  console.log(`예산: 폭발 8발 ${bud.boom8}% → 40발 ${bud.boom40}% (${bud.boomRatio}배)`
    + ` · 고리 세기 40/90/160/240/400 = ${bud.ink.join(' ')}`
    + ` · 숫자 일반 ${bud.plain} / 치명타 ${bud.crit} (예산 ${bud.budget}) · 붙기 ${bud.merged}`);
  console.log(`10분: 적 ${r.enemies} · 등급 ${r.ranked} (${(r.ratio * 100).toFixed(0)}%) · 체력바 ${r.bars} · 밝은 픽셀 ${r.bright}% · 입자 ${r.particles} · 파동 ${r.waves} · 폭발 최대 ${r.boomMax}px · lv${r.lv}`);
  let bad = 0;
  if (!(bud.boom40 > bud.boom8)) { console.log(`!! 폭발 40발이 8발보다 안 밝다 — 장면이 안 만들어졌다`); bad++; }
  if (bud.boomRatio > 3) { console.log(`!! 폭발 40발이 8발의 ${bud.boomRatio}배 — 겹칠수록 하나씩 조용해져야 한다(가산 합성)`); bad++; }
  if (bud.ink[0] !== 1 || bud.ink[1] !== 1) { console.log(`!! 작은 고리(${bud.ink[0]}/${bud.ink[1]})가 온전하지 않다 — 부딪히는 자리는 또렷해야 한다`); bad++; }
  if (!(bud.ink[2] < .8 && bud.ink[3] < .5 && bud.ink[4] <= .2)) { console.log(`!! 큰 고리가 안 흐려진다 (${bud.ink.join(' ')})`); bad++; }
  if (bud.plain > bud.budget + 2) { console.log(`!! 일반 숫자 ${bud.plain}개 — 예산 ${bud.budget} 이 안 먹는다`); bad++; }
  if (bud.crit <= bud.plain || bud.crit > bud.budget * 2 + 2) { console.log(`!! 치명타 ${bud.crit}개 — 일반보다 넉넉하되 천장은 있어야 한다`); bad++; }
  if (bud.merged !== 155) { console.log(`!! 예산이 걸린 뒤 같은 적의 숫자가 안 자란다 (${bud.merged}) — 막히면 피해가 사라진다`); bad++; }
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

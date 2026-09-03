/* 회귀: 소리에 자리와 예산이 있는가.

   §103 의 결정을 지킨다. 헤드리스에는 스피커가 없으므로 **울릴지 말지를 정하는
   규칙**을 직접 부른다 — place(자리) · gap(간격) · gate(예산) · duck(더킹).
   실제 파형은 tests/tools/measure-audio.js 가 잰다.

   재는 것:
     1. 화면 밖 소리는 울리지 않는다. 멀수록 작고, 좌우로 갈린다
     2. 예산 — 동시 발음이 차면 판 소리는 떨어지고, 안내음·내 소리는 안 떨어진다
     3. 안 들릴 소리가 쿨다운을 먼저 먹지 않는다
     4. 적이 많을수록 타격·처치의 간격이 벌어진다
     5. 리미터가 master 와 스피커 사이에 있다
     6. 무기 여덟의 발사음이 서로 다르다
     7. 더킹은 얕은 것으로 되돌리지 않는다
     8. 10분 판에서 초당 소리 수가 상한 안이다

   ■ 8번은 판마다 흔들린다(관측 39~52). 여기서 세는 방식은 계측 도구와 조금 달라
     (동시 발음 상한을 안 보고 자리만 본다) 값이 조금 높게 나온다. 파형 기준값은
     tests/tools/measure-audio.js 의 44.8 이고, 여기 바는 그 1.7 배인 75 다 —
     '조금 달라졌다' 가 아니라 '규칙이 빠졌다' 를 잡으려는 자리다.

   실행: node tests/audio-mix.js */
const { chromium } = require('playwright');
const { BOT } = require('../tests/bot.js');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  await pg.evaluate((S) => { (0, eval)(S); }, BOT);

  const r = await pg.evaluate(() => {
    Sfx.init();
    if (!Sfx.ctx) return { noCtx: true };
    const o = {};
    Game.reset();
    cam.x = player.x - W / 2; cam.y = player.y - HT / 2;

    // 1. 자리 — 가운데 · 오른쪽 · 왼쪽 · 화면 밖
    const mid = Sfx.place(player.x, player.y);
    const rgt = Sfx.place(player.x + 300, player.y);
    const lft = Sfx.place(player.x - 300, player.y);
    const out = Sfx.place(player.x + 4000, player.y);
    o.place = { midG: +mid[0].toFixed(3), midP: +mid[1].toFixed(3),
      rgtG: +rgt[0].toFixed(3), rgtP: +rgt[1].toFixed(3), lftP: +lft[1].toFixed(3), far: out === null };

    // 2. 예산 — 판 소리는 떨어지고, 자리 없는 소리는 안 떨어진다
    const ends0 = Sfx.ends.slice();
    const far = Sfx.ctx.currentTime + 9;
    Sfx.ends = new Array(Sfx.CAP).fill(far);
    o.budget = { world: Sfx.gate(1, { x: player.x, y: player.y }) === null,
      ui: Sfx.gate(1, null) !== null };
    // 지난 것은 저절로 걷힌다 — 카운터가 어긋나 영영 막히는 일이 없어야 한다
    Sfx.ends = new Array(Sfx.CAP).fill(Sfx.ctx.currentTime - 1);
    o.budget.selfHeal = Sfx.live() === 0;
    Sfx.ends = ends0;

    // 3. 안 들릴 소리가 쿨다운을 먹지 않는다
    Sfx.last = {}; Game.alive = 0;
    Sfx.kill(player.x + 4000, player.y);              // 화면 밖 — 아무것도 안 써야 한다
    const spent = Object.keys(Sfx.last).length;
    let played = 0;
    const P = Sfx.play, B = Sfx.burst;
    Sfx.play = () => { played++; }; Sfx.burst = () => { played++; };
    Sfx.kill(player.x + 40, player.y);                // 눈앞 — 울려야 한다
    o.cooldown = { farSpent: spent, nearPlayed: played };
    Sfx.play = P; Sfx.burst = B;

    // 4. 적이 많을수록 간격이 벌어진다
    Game.alive = 0;   const gLow = [Sfx.gap(85, 260), Sfx.gap(170, 420)];
    Game.alive = 300; const gHi = [Sfx.gap(85, 260), Sfx.gap(170, 420)];
    Game.alive = 0;
    o.gap = { lowHit: Math.round(gLow[0]), hiHit: Math.round(gHi[0]),
      lowKill: Math.round(gLow[1]), hiKill: Math.round(gHi[1]) };

    // 5. 리미터가 사이에 있다
    o.limiter = !!(Sfx.master && Sfx.master.numberOfOutputs) && (() => {
      // master 가 destination 에 바로 붙었는지 확인할 방법이 없으므로,
      // init 이 만든 압축기를 이름표로 남겨 둔다.
      return typeof Sfx.comp === "object" && Sfx.comp !== null &&
        Sfx.comp.threshold !== undefined && Sfx.comp.ratio.value > 1;
    })();

    // 6. 무기 여덟의 발사음이 서로 다르다
    const heard = [];
    const P2 = Sfx.play, B2 = Sfx.burst, T2 = Sfx.throttled;
    Sfx.throttled = (k, ms, fn) => fn();
    Sfx.play = (f, d, ty, v, s) => heard.push([Math.round(f), ty, Math.round(s || 0)]);
    Sfx.burst = () => {};
    const sigs = {};
    for (const k of Object.keys(WEAPONS)) {
      heard.length = 0;
      const w = { key: k, level: 1, fx: 0, hitAt: new Map(), t: 0, ang: 0 };
      try { WEAPONS[k].fire(player, w); } catch (e) { /* 표적이 없어 못 쏘는 무기는 넘어간다 */ }
      if (heard.length) sigs[k] = JSON.stringify(heard[0]);
    }
    Sfx.play = P2; Sfx.burst = B2; Sfx.throttled = T2;
    o.weapon = { n: Object.keys(sigs).length, uniq: new Set(Object.values(sigs)).size, sigs };

    // 7. 더킹 — 얕은 것으로 되돌리지 않는다
    Music.start('play');
    Sfx.duckAmt = 0; Sfx.duckEnd = 0;
    Sfx.duck(.6, 1.2); const deep = Sfx.duckAmt;
    Sfx.duck(.2, .3);  const after = Sfx.duckAmt;
    o.duck = { deep, after };
    Music.stop();
    return o;
  });

  if (r.noCtx) { console.log('SKIP: WebAudio 없음'); await b.close(); return; }

  // 8. 10분 판의 초당 소리 수
  const rate = await pg.evaluate(() => {
    selectedClass = 0; Game.reset(); botInstall(); player.godMode = true;
    let n = 0, from = 0;
    const P = Sfx.play, B = Sfx.burst, T = Sfx.throttled, A = Sfx.arp;
    const lastG = {};
    Sfx.throttled = function (key, ms, fn) {
      const now = Game.time * 1000;
      if (lastG[key] !== undefined && now - lastG[key] < ms) return;
      lastG[key] = now; fn();
    };
    Sfx.play = function (f, d, ty, v, s, pos) { if (!pos || Sfx.place(pos.x, pos.y)) n++; };
    Sfx.burst = function (d, v, band, pos) { if (!pos || Sfx.place(pos.x, pos.y)) n++; };
    Sfx.arp = function (notes) { n += notes.length; };
    const marks = {};
    for (let i = 0; i < 60 * 606; i++) {
      if (Game.state === 'playing') { botTick(1 / 60, true); player.hp = player.stats.maxHp; }
      update(1 / 60);
      let g = 0;
      while ((Game.state === 'levelup' || Game.state === 'advance') && g++ < 50)
        Game.applyChoice(Game.choices.find(c => c.type === 'passive') || Game.choices.find(c => c.type !== 'heal') || Game.choices[0]);
      const s = Math.round(Game.time);
      if (s === 595 && !from) { from = n; }
      if (s === 605 && from && !marks.late) { marks.late = (n - from) / 10; break; }
      if (Game.state === 'dead' || Game.state === 'won') break;
    }
    Object.assign(Sfx, { play: P, burst: B, throttled: T, arp: A }); botRestore();
    return { late: marks.late, alive: Game.alive };
  });

  const fail = [];
  const p = r.place;
  if (!p.far) fail.push(`화면 밖 소리가 울린다`);
  if (!(p.midG > p.rgtG)) fail.push(`가운데(${p.midG})가 옆(${p.rgtG})보다 크지 않다`);
  if (!(p.rgtP > .3 && p.lftP < -.3)) fail.push(`좌우가 안 갈린다 (오른쪽 ${p.rgtP}, 왼쪽 ${p.lftP})`);
  if (Math.abs(p.midP) > .01) fail.push(`가운데 소리가 한쪽으로 치우쳤다 (${p.midP})`);
  if (!r.budget.world) fail.push('예산이 차도 판 소리가 안 떨어진다');
  if (!r.budget.ui) fail.push('예산이 차면 안내음까지 떨어진다');
  if (!r.budget.selfHeal) fail.push('지난 목소리가 걷히지 않는다 — 카운터가 막힌 채로 남는다');
  if (r.cooldown.farSpent !== 0) fail.push(`화면 밖 소리가 쿨다운을 먹었다 (${r.cooldown.farSpent})`);
  if (r.cooldown.nearPlayed < 2) fail.push(`눈앞의 처치가 안 울린다 (${r.cooldown.nearPlayed})`);
  const g = r.gap;
  if (!(g.hiHit > g.lowHit * 2)) fail.push(`적이 많아도 타격 간격이 안 벌어진다 (${g.lowHit}→${g.hiHit})`);
  if (!(g.hiKill > g.lowKill * 2)) fail.push(`적이 많아도 처치 간격이 안 벌어진다 (${g.lowKill}→${g.hiKill})`);
  if (!r.limiter) fail.push('master 뒤에 리미터가 없다');
  if (r.weapon.n < 5) fail.push(`발사음을 내는 무기가 ${r.weapon.n}종뿐이다`);
  if (r.weapon.uniq !== r.weapon.n) fail.push(`발사음이 겹친다 (${r.weapon.n}종 중 ${r.weapon.uniq}가지 소리)`);
  if (r.duck.deep !== .6) fail.push('깊은 더킹이 안 걸린다');
  if (r.duck.after !== .6) fail.push(`얕은 더킹이 깊은 것을 되돌렸다 (${r.duck.after})`);
  if (!(rate.late > 8)) fail.push(`10분 화면이 조용하다 (초당 ${rate.late})`);
  if (!(rate.late <= 75)) fail.push(`10분 화면이 소음이다 (초당 ${rate.late}, 상한 75)`);

  console.log('자리   가운데 크기 ' + p.midG + ' / 옆 ' + p.rgtG + ' · 좌우 ' + p.lftP + '~' + p.rgtP + ' · 화면 밖 ' + (p.far ? '무음' : '울림'));
  console.log('간격   타격 ' + g.lowHit + '→' + g.hiHit + 'ms · 처치 ' + g.lowKill + '→' + g.hiKill + 'ms (적 0 → 300)');
  console.log('무기   발사음 ' + r.weapon.n + '종 · 서로 다른 소리 ' + r.weapon.uniq + '가지');
  console.log('10분   초당 ' + rate.late + '개 · 동시 적 ' + rate.alive);
  if (errs.length) fail.push(...errs);
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();

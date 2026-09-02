/* 회귀: 첫 징표가 손에 닿는가 — 2:30 에 제단이 가까이 있고, 전직 대기 상태에 표지가 뜨는가.

   1차 전직(레벨 8 · 3:00 · 징표 1)의 징표는 제단 파수꾼 아니면 보스(5:00)가 준다.
   제단은 칸의 7% 에만 서서 평균 세 화면 밖이고 표지는 1500 안에서만 떴다. 봇 12판이
   제단을 한 번도 못 열었다. 96경로짜리 전직이 안 보이는 콘텐츠였다.

   재는 것:
     1. 2:30 을 지나면 (징표 0 · 연 제단 0 일 때) 안 연 제단이 1300 안에 있다
     2. 강제 배치는 한 판에 한 번을 넘지 않고, 이미 가까운 제단이 있으면 하지 않는다
     3. 전직 대기·가능 상태면 Game.guideShrine 이 잡히고, 아니면 null
     4. reset 이 강제 배치를 지운다

   실행: node tests/sigil-guide.js */
const { chromium } = require('playwright');
const { BOT } = require('./bot.js');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '../game/index.html'));
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  const r = await pg.evaluate(async (BOT_SRC) => {
    (0, eval)(BOT_SRC);
    const out = { runs: [] };
    for (let run = 0; run < 3; run++) {
      selectedClass = 0; Game.reset(); botInstall();
      player.base.maxHp = 1e7; recomputeStats(); player.hp = 1e7;
      player.x = 20000 + run * 9000; player.y = 20000 - run * 7000;   // 판마다 다른 자리
      const before = { forced: forcedLm.size };
      let nearAt150 = null, forcedAt150 = 0;
      while (Game.time < 152) {
        if (Game.state !== 'playing') { Game.applyChoice(Game.choices.find(c => c.type !== 'heal') || Game.choices[0]); continue; }
        botTick(1 / 60, true); update(1 / 60); player.hp = 1e7;
        player.sigils = 0;                                    // 징표를 못 얻은 사람
      }
      const sh = nearestShrine();
      nearAt150 = sh ? Math.round(sh.d) : null; forcedAt150 = forcedLm.size;
      // 레벨을 채우고 관문(180초)까지 가서 대기 → 가능 상태를 만든다
      while (Game.time < 183) {
        if (Game.state !== 'playing') { Game.applyChoice(Game.choices.find(c => c.type !== 'heal') || Game.choices[0]); continue; }
        botTick(1 / 60, true); update(1 / 60); player.hp = 1e7; player.sigils = 0;
      }
      while (player.level < 8) { player.xp = player.xpNext; update(1 / 60); if (Game.state !== 'playing') Game.applyChoice(Game.choices.find(c => c.type !== 'heal') || Game.choices[0]); }
      player.sigils = 0; Game.checkAdvance();
      drawHUD();                                              // 표지가 guideShrine 을 잡는다
      const pend = Game.advancePending, wait = Game.advanceWaitT, guide = Game.guideShrine ? Math.round(Game.guideShrine.d) : null;
      // 상태를 풀면 안내도 풀리는가
      Game.advancePending = 0; Game.advanceWaitT = 0; drawHUD();
      const guideOff = Game.guideShrine;
      botRestore();
      out.runs.push({ nearAt150, forcedAt150, forcedBefore: before.forced, pend, wait, guide, guideOff: guideOff === null, lv: player.level, t: Math.round(Game.time) });
    }
    Game.reset(); out.afterReset = forcedLm.size;
    return out;
  }, BOT);
  let bad = 0;
  for (const [i, x] of r.runs.entries()) {
    console.log(`판 ${i + 1}: 2:30 가장 가까운 제단 ${x.nearAt150}u · 강제 ${x.forcedAt150}개 (시작 ${x.forcedBefore}) · 관문 뒤 pending ${x.pend} wait ${x.wait.toFixed ? x.wait.toFixed(1) : x.wait} · 안내 ${x.guide}u · 상태 해제 시 안내 null ${x.guideOff}`);
    if (x.nearAt150 == null || x.nearAt150 > 1300) { console.log(`  !! 2:30 에 제단이 1300 안에 없다 (${x.nearAt150})`); bad++; }
    if (x.forcedAt150 > 1) { console.log(`  !! 강제 배치가 ${x.forcedAt150}개 — 한 판에 하나여야 한다`); bad++; }
    if (x.forcedBefore !== 0) { console.log('  !! reset 뒤에도 강제 배치가 남아 있었다'); bad++; }
    if (!(x.pend || x.wait > 0)) { console.log('  !! 관문 뒤 레벨 8 인데 전직 대기·가능 상태가 아니다'); bad++; }
    if (x.guide == null) { console.log('  !! 전직 대기 상태인데 안내 제단이 없다'); bad++; }
    if (!x.guideOff) { console.log('  !! 상태가 풀렸는데 안내가 남았다'); bad++; }
  }
  if (r.afterReset !== 0) { console.log('!! reset 이 강제 배치를 지우지 않는다'); bad++; }
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close(); process.exit(bad ? 1 : 0);
})();

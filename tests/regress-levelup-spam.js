/* 회귀: 전직 이후 레벨업 창이 끝없이 이어지지 않는가.
   후반에 무기·패시브가 모두 최대치가 되면 rollChoices 가 회복 카드 3장만 돌려주는데,
   그걸 그대로 띄우면 "확인만 계속 누르는" 상태가 되어 게임을 진행할 수 없다.
   levelUp() 은 그런 레벨을 화면 없이 넘겨야 한다. */
const { chromium } = require('playwright');
/* 봇은 저장소 안(tests/bot.js)에서 온다.
   예전에는 임시 폴더의 계측 스크립트를 읽었는데, 그 파일을 덮어쓴 날
   게임은 멀쩡한데 이 테스트만 죽었다. */
const { BOT } = require('./bot.js');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(300);

  const out = await pg.evaluate((BOT_SRC) => {
    selectedClass = 3; Game.reset();
    /* 이 테스트가 보려는 것은 '후반에 고를 게 없어지는가'다. 봇이 22초에 죽으면
       레벨이 2 에서 멈춰 정작 그 구간에 닿지 못한다 — 죽지 않게 체력을 준다.
       살아남는 능력이 아니라 레벨업 창의 논리를 재는 자리다. */
    player.base.maxHp = 1e7; recomputeStats(); player.hp = player.stats.maxHp;
    let screens = 0, allHeal = 0, maxStreak = 0, streak = 0;
    // 제자리에 서 있으면 난이도가 오른 뒤로는 1분도 못 버텨 측정이 안 된다.
    (0, eval)(BOT_SRC);
    botInstall();
    for (let i = 0; i < 60 * 60 * 15; i++) {
      if (Game.state === 'playing') botTick(1 / 60);
      update(1 / 60);
      player.hp = player.stats.maxHp;
      let opened = false;
      // 한 프레임 안에서 창이 연달아 뜨는 횟수를 센다
      let inner = 0;
      while ((Game.state === 'levelup' || Game.state === 'advance') && inner < 500) {
        if (Game.state === 'levelup') {
          screens++; opened = true;
          if (Game.choices.every(c => c.type === 'heal')) allHeal++;
        }
        Game.applyChoice(Game.choices[0]);
        inner++;
      }
      streak = opened ? streak + inner : 0;
      if (streak > maxStreak) maxStreak = streak;
      if (Game.state === 'dead' || Game.state === 'won') break;
    }
    botRestore();
    return { screens, allHeal, maxStreak, lvl: player.level, t: Math.round(Game.time), state: Game.state };
  }, BOT);

  console.log(JSON.stringify(out));
  const fail = [];
  if (out.allHeal > 0) fail.push(`고를 게 없는(회복 3장) 레벨업 창이 ${out.allHeal}번 떴다`);
  if (out.state === 'won' && out.screens > 55) fail.push(`15분 완주에 레벨업 창이 ${out.screens}번 — 너무 잦다 (20초에 한 번 이하가 목표)`);
  if (errs.length) fail.push('page error: ' + errs.join(' / '));
  console.log(fail.length ? 'FAIL\n  ' + fail.join('\n  ') : 'PASS');
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();

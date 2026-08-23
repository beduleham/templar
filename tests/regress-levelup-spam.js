/* 회귀: 전직 이후 레벨업 창이 끝없이 이어지지 않는가.
   후반에 무기·패시브가 모두 최대치가 되면 rollChoices 가 회복 카드 3장만 돌려주는데,
   그걸 그대로 띄우면 "확인만 계속 누르는" 상태가 되어 게임을 진행할 수 없다.
   levelUp() 은 그런 레벨을 화면 없이 넘겨야 한다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(300);

  const out = await pg.evaluate(() => {
    selectedClass = 3; Game.reset();
    let screens = 0, allHeal = 0, maxStreak = 0, streak = 0;
    window.inputVector = () => ({ x: 0, y: 0 });
    for (let i = 0; i < 60 * 60 * 15; i++) {
      update(1 / 60);
      if (Game.state === 'playing' && player.cls && player.res >= player.cls.skill.cost) useSkill();
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
    return { screens, allHeal, maxStreak, lvl: player.level, t: Math.round(Game.time), state: Game.state };
  });

  console.log(JSON.stringify(out));
  const fail = [];
  if (out.allHeal > 0) fail.push(`고를 게 없는(회복 3장) 레벨업 창이 ${out.allHeal}번 떴다`);
  if (out.screens > 140) fail.push(`15분에 레벨업 창이 ${out.screens}번 — 너무 잦다`);
  if (errs.length) fail.push('page error: ' + errs.join(' / '));
  console.log(fail.length ? 'FAIL\n  ' + fail.join('\n  ') : 'PASS');
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();

/* 밸런스 전후 비교 계측 — 통과/실패가 없는 도구라 tests/ 가 아니라 tests/tools/ 에 둔다.

   직업 4종 × 3판을 15분까지 시뮬한다. 봇은 tests/bot.js(자세 켬), 카드는 캐주얼
   규칙(체력 40% 밑이면 회복, 아니면 능력 > 무기 > 특성). 찍는 것:
   생존 시각 · 레벨 · 처치 · 5/30/60초 동시 적 · 최대 동시 적 · 560~640초 체력 궤적.

   ■ 봇이 근접(전사)을 못 재는 한계는 bot.js 머리말과 같다. 절대값이 아니라
     **같은 봇에서 빌드 간 차이**를 본다. 3판은 편차가 커서 한 판 차이는 잡음이다 —
     세 판이 같은 방향으로 움직일 때만 믿는다.

   실행:  node tests/tools/measure-balance.js before   (고치기 전)
          node tests/tools/measure-balance.js after    (고친 뒤)
   결과는 표준 출력과 ab_<tag>.json 으로 남는다. */
const { chromium } = require('playwright');
const { BOT } = require('../bot.js');
const tag = process.argv[2] || 'run';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await pg.goto('file://' + require('path').resolve(__dirname, '../../game/index.html') + '');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  await pg.evaluate((BOT_SRC) => { (0, eval)(BOT_SRC); }, BOT);
  const all = {};
  for (const cls of [0, 1, 2, 3]) {
    const rs = [];
    for (let run = 0; run < 3; run++) {
      const r = await pg.evaluate((cls) => {
        selectedClass = cls; Game.reset(); botInstall();
        const early = {}, win = [];
        let maxAlive = 0;
        for (let i = 0; i < 60 * 60 * 15 + 5; i++) {
          if (Game.state === 'playing') botTick(1 / 60, true);
          update(1 / 60);
          let g = 0;
          while ((Game.state === 'levelup' || Game.state === 'advance') && g++ < 50) {
            const C = Game.choices, hpF = player.hp / player.stats.maxHp;
            Game.applyChoice((hpF < .4 && C.find(c => c.type === 'heal')) || C.find(c => c.type === 'passive') || C.find(c => c.type !== 'heal') || C[0]);
          }
          if (i % 60 === 0) {
            let n = 0; for (const e of enemies) if (e.active) n++;
            if (n > maxAlive) maxAlive = n;
            const s = i / 60;
            if (s === 5 || s === 30 || s === 60) early[s] = n;
            if (s >= 560 && s <= 640 && s % 10 === 0) win.push(`${s}s:hp${Math.round(player.hp / player.stats.maxHp * 100)}%/적${n}${enemies.some(e => e.active && e.boss) ? '/보스' : ''}`);
          }
          if (Game.state === 'dead' || Game.state === 'won') break;
        }
        botRestore();
        return { cls: player.cls.key, st: Game.state, t: Math.round(Game.time), lv: player.level, kills: Game.kills,
          hp: player.stats.maxHp, early, maxAlive, win };
      }, cls);
      rs.push(r);
    }
    all[rs[0].cls] = rs;
    console.log(`${rs[0].cls.padEnd(8)} 체력 ${rs[0].hp}  ` + rs.map(r => `${r.st === 'won' ? '완주' : r.t + 's'}/lv${r.lv}/${r.kills}킬`).join('  ') + `   초반 적 ${JSON.stringify(rs[0].early)}  최대동시 ${Math.max(...rs.map(r => r.maxAlive))}`);
    for (const r of rs) if (r.win.length) console.log('    10분 구간: ' + r.win.join(' '));
  }
  require('fs').writeFileSync(`ab_${tag}.json`, JSON.stringify(all));
  await b.close();
})();

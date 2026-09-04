/* 실수 한 번은 얼마짜리인가.

   봇은 완벽하게 카이팅한다. 그래서 봇이 완주해도 사람이 5분 30초에 죽는 구간을
   못 잡는다(실제로 네 직업 전부 그 시각에 둘러싸여 죽었다). 봇이 재는 것은
   난이도의 하한선이고, 사람이 죽는 자리는 **잠깐 멈췄을 때** 생긴다.

   그래서 이 도구는 다른 것을 잰다 — 매 30초마다 봇을 잠깐 세워 두고
   **가만히 있으면 몇 초 만에 죽는가**를 잰다. 그게 실수 한 번의 값이다.

     버티는 시간   가만히 서서 최대 체력에서 0 까지 걸리는 시간
     초당 피해     그 구간에 실제로 들어온 피해 / 초
     포위          곁의 적 수와 포위 배수
     동시 적       화면 안팎 전체

   실행: node tests/tools/measure-mistake.js [직업]
         node tests/tools/measure-mistake.js all */
const { chromium } = require('playwright');
const { BOT } = require('../../tests/bot.js');

const CLASSES = ['성기사', '전사', '추적자', '마법사'];
const MARKS = [60, 120, 180, 240, 300, 330, 360, 420, 480, 540, 600];

(async () => {
  const which = process.argv[2] || '0';
  const idxs = which === 'all' ? [0, 1, 2, 3] : [Number(which) || 0];
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  await pg.evaluate((S) => { (0, eval)(S); }, BOT);

  for (const ci of idxs) {
    const rows = await pg.evaluate(async ([ci, MARKS]) => {
      selectedClass = ci; Game.reset(); botInstall();
      const out = [];
      let mi = 0;
      const pick = () => {
        let g = 0;
        while ((Game.state === 'levelup' || Game.state === 'advance') && g++ < 50)
          Game.applyChoice(Game.choices.find(c => c.type === 'passive') || Game.choices.find(c => c.type !== 'heal') || Game.choices[0]);
      };
      for (let i = 0; i < 60 * 700; i++) {
        if (Game.state === 'playing') { botTick(1 / 60, true); player.hp = player.stats.maxHp; }
        update(1 / 60); pick();
        if (mi < MARKS.length && Game.time >= MARKS[mi]) {
          /* 여기서만 손을 뗀다 — 봇을 세우고 체력 보충도 끊는다.
             무적·회복을 그대로 두면 '실수' 가 아니라 '불사' 를 재게 된다. */
          const t0 = Game.time, hp0 = player.stats.maxHp;
          player.hp = hp0;
          const BT = botTick; botTick = () => {};
          let dead = 0, press = 0, nearMax = 0, n = 0;
          for (let k = 0; k < 60 * 12 && !dead; k++) {
            update(1 / 60); pick();
            if (Game.state !== 'playing') { dead = Game.time - t0; break; }
            press = Math.max(press, player.press || 0);
            nearMax = Math.max(nearMax, nearestEnemies(player.x, player.y, 90, 40).length);
            n++;
            if (player.hp <= 0) { dead = Game.time - t0; break; }
          }
          botTick = BT;
          const lived = dead || 12;
          out.push({ t: MARKS[mi], lived: +lived.toFixed(1),
            dps: Math.round((hp0 - Math.max(0, player.hp)) / lived),
            maxHp: Math.round(hp0), press: +press.toFixed(2), near: nearMax,
            alive: Game.alive, lv: player.level });
          /* 죽었으면 되살려 계속 잰다 — 이 도구는 한 판의 결과가 아니라
             **시각별 압력 곡선**을 재는 것이라, 한 번 죽었다고 멈추면
             정작 보고 싶은 뒤 구간이 통째로 빈다. */
          if (Game.state !== 'playing') { Game.state = 'playing'; player.iframe = 0; }
          player.hp = hp0;
          mi++;
        }
        if (Game.state === 'won') break;
        if (Game.state === 'dead') { Game.state = 'playing'; player.hp = player.stats.maxHp; }
      }
      botRestore();
      return out;
    }, [ci, MARKS]);
    console.log(`\n── ${CLASSES[ci]}`);
    console.log('  시각   버팀    초당피해  최대체력  포위   곁의적  동시적  레벨');
    for (const r of rows) {
      const m = String(Math.floor(r.t / 60)) + ':' + String(r.t % 60).padStart(2, '0');
      const warn = r.lived < 3 ? '  ← 2초 안에 죽는다' : r.lived < 5 ? '  ← 빠듯' : '';
      console.log(`  ${m.padStart(5)}  ${String(r.lived).padStart(4)}초  ${String(r.dps).padStart(7)}  ${String(r.maxHp).padStart(7)}  ${String(r.press).padStart(5)}  ${String(r.near).padStart(5)}  ${String(r.alive).padStart(5)}  ${String(r.lv).padStart(4)}${warn}`);
    }
  }
  await b.close();
})();

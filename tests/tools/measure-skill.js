/* 스킬 한 방은 얼마짜리인가.

   사람이 성전사로 15분을 클리어했는데 「성스러운 돌격은 이동은 되는데 공격력이 거의
   없다. 15분동안 도망다녔다」였다(2026-09-04). 눈으로는 「약한 것 같다」까지밖에 못 가서
   같은 표적 앞에서 스킬들을 나란히 세우는 자를 만들었다.

   레벨 25 로 맞추고, 앞쪽 부채꼴에 적을 촘촘히 깔고, 스킬 한 번의 총 피해를 잰다.
   체력을 10억으로 두는 이유는 **죽어서 빠지면 뒤에 오는 판정이 표적을 잃기** 때문이다.

   처음 잰 값 — 돌격이 다섯 중 꼴찌였고 참수의 3분의 1 이었다.

     참수         160,047
     화형 선고     103,883
     부동의 맹세    83,286
     성역 봉인      66,902
     성스러운 돌격  51,178   ← 여기

   원인은 피해가 아니라 **폭**이었다. 돌진은 지나가는 복도만 때리는데 반경 34 면 폭이
   94px 이라, 반지름 380 짜리 파동(넓이 45만)의 10분의 1도 안 된다. 반경을 54 로 넓히고
   피해를 올려 92k 로 맞췄다 — 겨누기 어렵고 이동이 딸려 오므로 가운데가 맞다.

   실행: node tests/tools/measure-skill.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  const r = await pg.evaluate(() => {
    const out = [];
    const keys = ['everwall', 'crusader', 'executioner', 'inquisitor', 'guardian'];
    for (const k of keys) {
      const a = ADVANCES.find(x => x.key === k);
      if (!a || !a.skill) { out.push({ k, skip: true }); continue; }
      selectedClass = 0; Game.reset();
      player.level = 25; recomputeStats();
      player.advance.length = 0; player.advance.push(a);
      player.faceX = 1; player.faceY = 0; player.res = 100;
      // 앞쪽 부채꼴에 적을 촘촘히 깐다 — 어느 스킬이든 같은 표적을 본다
      for (const e of enemies) e.active = false;
      let n = 0;
      for (let ring = 60; ring <= 420; ring += 45)
        for (let i = 0; i < 12; i++) {
          const ang = -0.9 + i / 11 * 1.8;
          const e = Game.spawnEnemy('zombie', player.x + Math.cos(ang) * ring, player.y + Math.sin(ang) * ring);
          if (e) { e.maxHp = e.hp = 1e9; n++; }
        }
      const d0 = Game.dmgDealt;
      useSkill();
      for (let i = 0; i < 90; i++) update(1 / 60);      // 1.5초 — 돌진과 파동이 끝날 시간
      out.push({ k, name: a.skill.name, n, dmg: Math.round(Game.dmgDealt - d0) });
    }
    return out;
  });
  const max = Math.max(...r.filter(x => !x.skip).map(x => x.dmg));
  for (const x of r) {
    if (x.skip) { console.log(`  ${x.k} — 스킬 없음`); continue; }
    const bar = '█'.repeat(Math.round(x.dmg / max * 34));
    console.log(`  ${x.name.padEnd(10)} ${String(x.dmg).padStart(8)}  ${bar}`);
  }
  await b.close();
})();

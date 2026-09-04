/* 회귀: 가만히 서서 스킬만 눌러서는 못 이긴다.

   사람이 성기사(불멸의 성벽)로 15분을 클리어했는데 「움직일 필요도 없이 그냥 가만히
   있어도 되었다」고 했다(2026-09-04). 재 보니 3:00~9:00 내내 체력이 100% 였다.

   범인은 둘이었고, 처음에 지목한 쪽은 틀렸다.

     방벽(자세)   방어 -52~93% · 회복 · 쿨다운 -28% · 접전 피해 +119% 를 한꺼번에 준다.
                  손봤지만 이것만으로는 3판 중 2판이 여전히 서서 이겼다.
     부동의 맹세   최대 체력의 45% 를 채우고 3초 무적인데 **재사용 대기가 없었다.**
                  성기사의 자원은 맞으면 차므로 둘러싸일수록 빨리 회복한다 —
                  맞는 것이 회복의 연료인 고리라 끊기지 않았다. 이쪽이 진짜였다.

   이 자는 「서서 이기는가」 하나만 본다. 숫자를 어떻게 조정하든 그 답은 아니오여야 한다.

   ■ 느리다 (15분 판 × 3)

   판마다 흔들리므로 한 판으로는 못 잡는다 — 고치기 전에도 3판 중 1판은 죽었다.
   세 판을 돌려 **한 판도 못 이기는지**를 본다.

   실행: node tests/no-afk-clear.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const runs = await pg.evaluate(async () => {
    const out = [];
    for (let n = 0; n < 3; n++) {
      /* 손을 아예 안 댄다 — 이동 0. 스킬만 매 프레임 누른다(대기가 있으면 알아서 막힌다).
         징표는 준다: 여기서 재려는 것은 「탐험 없이 이기는가」가 아니라
         「서 있는 것만으로 이기는가」이므로, 각성을 막아 이기게 하면 자가 물러진다. */
      selectedClass = 0; Game.reset();
      for (let i = 0; i < 60 * 905; i++) {
        if (i % 120 === 0) player.sigils = 9;
        useSkill();
        update(1 / 60);
        let g = 0;
        while ((Game.state === 'levelup' || Game.state === 'advance') && g++ < 60) {
          const C = Game.choices, hpF = player.hp / player.stats.maxHp;
          Game.applyChoice(C.find(c => c.tier) || (hpF < .4 && C.find(c => c.type === 'heal'))
            || C.find(c => c.type === 'passive') || C.find(c => c.type !== 'heal') || C[0]);
        }
        if (Game.state === 'dead' || Game.state === 'won') break;
      }
      out.push({ end: Game.state, t: Math.round(Game.time), lv: player.level,
        adv: player.advance.map(a => a.name).join('>') || '각성 없음' });
    }
    return out;
  });

  const fail = [];
  for (const r of runs)
    console.log(`  ${r.end === 'won' ? '★ 클리어' : '  죽음  '} ${Math.floor(r.t / 60)}:${String(r.t % 60).padStart(2, '0')} · Lv${r.lv} · ${r.adv}`);
  const won = runs.filter(r => r.end === 'won');
  if (won.length)
    fail.push(`가만히 서서 ${won.length}/3 판을 클리어했다 (${won.map(r => r.adv).join(', ')}) — 움직일 이유가 사라진다`);
  /* 반대쪽도 본다. 서 있는 것이 **자살**이 되어도 안 된다 — 성기사는 파고들어 버티는
     직업이라 그 정체성까지 지우면 고친 게 아니라 부순 것이다. */
  const early = runs.filter(r => r.t < 120);
  if (early.length >= 2)
    fail.push(`3판 중 ${early.length}판이 2분 안에 죽었다 — 서 있는 것이 자살이 됐다. 성기사의 정체성이 사라진다`);

  fail.push(...errs);
  await b.close();
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  process.exit(fail.length ? 1 : 0);
})();

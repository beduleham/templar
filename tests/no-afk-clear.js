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
   그리고 서 있는 값을 매기는 **기전**을 함께 잰다 — 생존 시간은 잡음이 효과보다 커서
   그것만으로는 고쳤는지 못 가른다(아래 주석).

   ■ 느리다 (15분 판 × 3)

   판마다 흔들리므로 한 판으로는 못 잡는다 — 고치기 전에도 3판 중 1판은 죽었다.
   세 판을 돌려 **한 판도 못 이기는지**를 본다.

   ■ 아래쪽 조건(2분 안 죽음)은 흔들린다

   게임의 난수에 씨앗이 없어서 같은 코드로 돌려도 결과가 크게 다르다. 실제로
   2026-09-04 에 같은 코드가 두 번 연속 「3판 중 2판이 2분 안에 죽었다」로 떨어지고
   이어서 세 번 연속 통과했다(죽음 3:41~6:37). **여기가 떨어지면 코드를 고치기 전에
   두어 번 더 돌린다.** 위쪽 조건(서서 클리어)은 흔들려도 한 번이라도 이기면 진짜다.

   ■ 판마다 다른 계보를 태운다

   성기사 하나로만 재면 다음에 다른 갈래가 뚫려도 모른다. 실제로 방벽과 부동의 맹세를
   막고 나니 **성전사 + 흡혈 전환**으로 다시 뚫렸다 — 온 맵에 폭발이 깔리면 흡혈의
   리필 속도(당시 초당 5%)가 그대로 무한 회복이 됐다. 불멸의 성벽 · 성전사 · 처형자
   셋을 돌아가며 태운다.

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
      /* 판마다 다른 계보를 태운다. 성기사 하나로만 재면 다음에 다른 갈래가 뚫려도
         모른다 — 실제로 방벽을 막고 나니 성전사 + 흡혈 전환으로 다시 뚫렸다. */
      const LINE = [['guardian', 'everwall'], ['guardian', 'crusader'], ['inquisitor', 'executioner']][n];
      selectedClass = 0; Game.reset();
      for (let i = 0; i < 60 * 905; i++) {
        if (i % 120 === 0) player.sigils = 9;
        useSkill();
        update(1 / 60);
        let g = 0;
        while ((Game.state === 'levelup' || Game.state === 'advance') && g++ < 60) {
          const C = Game.choices, hpF = player.hp / player.stats.maxHp;
          Game.applyChoice(C.find(c => c.tier && LINE.includes(c.key)) || C.find(c => c.tier)
            || (hpF < .4 && C.find(c => c.type === 'heal'))
            || C.find(c => c.type === 'passive') || C.find(c => c.type !== 'heal') || C[0]);
        }
        if (Game.state === 'dead' || Game.state === 'won') break;
      }
      out.push({ end: Game.state, t: Math.round(Game.time), lv: player.level,
        adv: player.advance.map(a => a.name).join('>') || '각성 없음' });
    }
    return out;
  });

  /* ■ 서 있는 값은 **연출이 아니라 기전**으로 잰다

     서 있는 판과 움직이는 판의 생존 시간을 견주려 했는데 잡음이 효과보다 컸다 —
     같은 코드로 여덟 판씩 돌린 중앙값이 서 있음 2:16~6:19, 움직임 6:38~12:12 로
     흔들렸다. 그래서 「고친 뒤 오래 못 산다」를 여기서 주장하지 않는다.
     대신 **손댄 그 값**을 직접 잰다 — 잡음이 없다.

     재는 것: 오래 서 있으면 스킬 회복이 절반이 되고, 한 걸음이면 돌아오고,
     다른 직업(멈춰야 강한 마법사)은 안 건드린다. */
  const mech = await pg.evaluate(() => {
    const o = {};
    selectedClass = 0; Game.reset();
    const at = (t) => { player.stillTime = t; return +skillHealScale(player).toFixed(3); };
    o.pal = { s0: at(0), s20: at(20), s32: at(32), s45: at(45), s90: at(90) };
    // 한 걸음이면 돌아온다 — update 한 번에 stillTime 이 0 이 된다
    player.stillTime = 90; keys.add("d"); update(1 / 60); keys.delete("d");
    o.afterStep = +skillHealScale(player).toFixed(3);
    /* 실제로 덜 낫는가. 성기사의 기본 스킬(심판의 빛)은 회복이 없다 —
       회복은 2차 부동의 맹세(45%)부터다. 그 계보를 태우고 잰다. */
    for (const k of ['guardian', 'everwall']) {
      const a = ADVANCES.find(x => x.key === k);
      player.level = Math.max(player.level, a.tier * 12); player.sigils = 9;
      Game.applyChoice(a);
    }
    const heal = (t) => {
      player.stillTime = t; player.skillCd = 0; player.res = 100;
      player.hp = player.stats.maxHp * .3;
      const h0 = player.hp; useSkill();
      return Math.round(player.hp - h0);
    };
    o.healFresh = heal(0); o.healWorn = heal(90);
    // 마법사는 멈춰야 강한 직업이다 — 여기에 값을 물리면 안 된다
    selectedClass = 3; Game.reset();
    player.stillTime = 200;
    o.mage = +skillHealScale(player).toFixed(3);
    return o;
  });
  console.log(`  회복 배수  성기사 0초 ${mech.pal.s0} · 20초 ${mech.pal.s20} · 32초 ${mech.pal.s32} · 45초 ${mech.pal.s45}`
    + ` · 한 걸음 뒤 ${mech.afterStep} | 실제 회복 ${mech.healFresh} → ${mech.healWorn} | 마법사 ${mech.mage}`);

  const fail = [];
  if (mech.pal.s0 !== 1 || mech.pal.s20 !== 1)
    fail.push(`20초까지는 온전해야 한다 (0초 ${mech.pal.s0} · 20초 ${mech.pal.s20}) — 잠깐 버티는 것은 공짜다`);
  if (!(mech.pal.s32 < .95 && mech.pal.s32 > mech.pal.s45))
    fail.push(`32초에 ${mech.pal.s32} · 45초에 ${mech.pal.s45} — 시간에 따라 줄어야 한다`);
  if (Math.abs(mech.pal.s90 - .5) > .01)
    fail.push(`끝까지 서 있으면 ${mech.pal.s90} — 절반에서 멈춰야 한다`);
  if (mech.afterStep !== 1)
    fail.push(`한 걸음 옮겨도 ${mech.afterStep} — 되돌릴 길이 없으면 벌이지 리듬이 아니다`);
  if (!(mech.healWorn > 0 && mech.healWorn < mech.healFresh * .6))
    fail.push(`실제 회복이 ${mech.healFresh} → ${mech.healWorn} — 배수가 회복에 안 걸린다`);
  if (mech.mage !== 1)
    fail.push(`마법사도 값을 문다 (${mech.mage}) — 멈춰야 강한 직업이다`);

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

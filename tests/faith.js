/* 회귀: 신앙 ↔ 타락 저울이 약속대로 움직이고, 은혜와 저주가 함께 오는가.

   "매 판 내가 성인이 되느냐 괴물이 되느냐를 고른다"(docs/hook-spec.md A2).

   이 훅이 조용히 망가지는 자리는 셋이다.
     · 화면에 보여준 값과 실제로 미는 값이 갈리면 저울이 아니라 거짓말이 된다.
       그래서 카드와 적용이 **같은 함수(faithOf)** 를 본다 — 그 약속을 여기서 잰다.
     · 은혜만 걸리고 저주가 안 걸리면 그냥 더 좋은 선택지가 된다.
     · 타락의 저주는 시간에 비례해야 한다. 고정 감소면 「지금 세지고 나중에 죽는다」가
       아니라 그냥 싼 값이 된다.

   재는 것:
     1. 저울이 -100~100 을 안 벗어난다
     2. 미는 값이 무기의 속성을 따른다 — 신성·냉기 +, 피·화염 −, 물리·뇌전 0
        능력과 특성은 v1 에서 안 민다 (속성이 없다)
     3. applyChoice 가 정확히 faithOf 만큼 민다 (화면과 실제가 같다)
     4. 문턱을 넘으면 은혜와 저주가 **함께** 걸린다
     5. 타락 2단의 체력 감소가 30초마다 2% 씩, 40% 에서 멈춘다
     6. 판을 다시 시작하면 저울과 마름이 0 으로 돌아온다

   실행: node tests/faith.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const r = await pg.evaluate(() => {
    const o = {};
    selectedClass = 0; Game.reset();

    // 2. 무기의 속성이 방향을 정한다
    o.tilt = {};
    for (const k in WEAPONS) o.tilt[k] = [WEAPONS[k].element, faithOf({ type: 'weapon', key: k, isNew: true })];
    o.upgrade = faithOf({ type: 'weapon', key: 'aura', level: 2 });
    o.passive = faithOf({ type: 'passive', key: 'power', isNew: true });
    o.trait = faithOf({ type: 'trait', key: 'bulwark', level: 1 });

    // 3. 보여주는 값과 실제로 미는 값이 같다
    Game.faith = 0;
    const picks = [{ type: 'weapon', key: 'aura', isNew: true }, { type: 'weapon', key: 'scythe', isNew: true },
                   { type: 'weapon', key: 'orb', level: 2 }, { type: 'passive', key: 'power', isNew: true }];
    let want = 0;
    for (const c of picks) { want += faithOf(c); Game.applyChoice(c); }
    o.sync = [want, Game.faith];

    // 1. 상한
    for (let i = 0; i < 40; i++) Game.applyChoice({ type: 'weapon', key: 'aura', isNew: true });
    o.hi = Game.faith;
    for (let i = 0; i < 80; i++) Game.applyChoice({ type: 'weapon', key: 'scythe', isNew: true });
    o.lo = Game.faith;

    // 4. 은혜와 저주가 함께 — 네 계단을 다 본다
    o.steps = {};
    for (const f of [90, 50, 0, -50, -90]) {
      Game.faith = f; Game.faithDrain = 0; Game.faithDrainT = 0;
      player.dynDmg = 1; player.dynArmor = 1; player.dynSpeed = 1;
      applyFaithEffects(player, 1 / 60);
      o.steps[f] = { step: faithStep(), name: faithName(),
        dmg: +player.dynDmg.toFixed(3), armor: +player.dynArmor.toFixed(3), spd: +player.dynSpeed.toFixed(3) };
    }

    // 5. 타락 2단의 마름 — 30초마다, 40% 에서 멈춘다
    Game.faith = -90; Game.faithDrain = 0; Game.faithDrainT = 0;
    recomputeStats();
    const hp0 = player.stats.maxHp;
    const at = {};
    for (let i = 0; i < 60 * 700; i++) {
      applyFaithEffects(player, 1 / 60);
      const t = Math.round(i / 60);
      if (t === 31 && !at.t31) at.t31 = +Game.faithDrain.toFixed(3);
      if (t === 91 && !at.t91) at.t91 = +Game.faithDrain.toFixed(3);
    }
    o.drain = { t31: at.t31, t91: at.t91, end: +Game.faithDrain.toFixed(3),
      hp: [Math.round(hp0), Math.round(player.stats.maxHp)] };
    // 신앙 쪽에서는 안 마른다
    Game.faith = 90; Game.faithDrain = 0; Game.faithDrainT = 0;
    for (let i = 0; i < 60 * 90; i++) applyFaithEffects(player, 1 / 60);
    o.holyDrain = Game.faithDrain;

    // 6. 되돌아온다
    Game.faith = -80; Game.faithDrain = .1;
    selectedClass = 0; Game.reset();
    o.afterReset = [Game.faith, Game.faithDrain];
    return o;
  });

  const fail = [], out = [];
  const EXPECT = { holy: 10, frost: 10, blood: -10, fire: -10, physical: 0, storm: 0 };
  for (const [k, [el, v]] of Object.entries(r.tilt))
    if (v !== EXPECT[el]) fail.push(`${k}(${el})가 ${v} — ${EXPECT[el]} 이어야 한다`);
  out.push('무기   ' + Object.entries(r.tilt).map(([k, [el, v]]) => `${k} ${v > 0 ? '+' + v : v}`).join(' · '));
  if (r.upgrade !== 4) fail.push(`무기 강화가 ${r.upgrade} — 4 여야 한다 (새로 얻기의 절반 아래)`);
  if (r.passive !== 0 || r.trait !== 0) fail.push(`능력·특성이 저울을 민다 (${r.passive}, ${r.trait}) — v1 에서는 안 민다`);
  if (r.sync[0] !== r.sync[1]) fail.push(`보여준 값 ${r.sync[0]} 과 실제 ${r.sync[1]} 이 다르다 — 카드가 거짓말을 한다`);
  out.push(`동기화 카드가 말한 합 ${r.sync[0]} = 실제 ${r.sync[1]}`);
  if (r.hi !== 100 || r.lo !== -100) fail.push(`저울이 ${r.lo}~${r.hi} — -100~100 을 벗어났다`);

  out.push('계단   ' + Object.entries(r.steps).map(([f, v]) =>
    `${f}:${v.name || '가운데'}(피해 ${v.dmg} 방어 ${v.armor} 이동 ${v.spd})`).join(' · '));
  for (const [f, v] of Object.entries(r.steps)) {
    const n = Number(f);
    if (n > 0 && v.step > 0 && !(v.armor < 1 && v.spd < 1))
      fail.push(`신앙 ${n}단에서 은혜(방어 ${v.armor})와 저주(이동 ${v.spd})가 함께 안 걸린다`);
    if (n < 0 && v.step < 0 && !(v.dmg > 1))
      fail.push(`타락 ${n} 에서 은혜가 없다 (피해 ${v.dmg})`);
    if (n === 0 && (v.dmg !== 1 || v.armor !== 1 || v.spd !== 1))
      fail.push('가운데인데 배수가 걸려 있다');
  }
  // 타락의 저주는 시간에 비례한다 — 즉시 효과가 아니다
  if (r.steps[-90].armor !== 1 || r.steps[-90].spd !== 1)
    fail.push('타락에 즉시 방어/이동 저주가 걸렸다 — 타락의 대가는 시간이어야 한다');

  out.push(`마름   30초 ${r.drain.t31} · 90초 ${r.drain.t91} · 끝 ${r.drain.end} · 체력 ${r.drain.hp[0]}→${r.drain.hp[1]}`);
  if (r.drain.t31 !== .02) fail.push(`30초에 ${r.drain.t31} — 0.02 여야 한다`);
  if (r.drain.t91 !== .06) fail.push(`90초에 ${r.drain.t91} — 0.06 이어야 한다 (시간에 비례)`);
  if (r.drain.end !== .40) fail.push(`상한이 ${r.drain.end} — 0.40 에서 멈춰야 한다`);
  if (!(r.drain.hp[1] < r.drain.hp[0] * .65)) fail.push(`체력이 ${r.drain.hp[0]}→${r.drain.hp[1]} — 40% 가 안 깎였다`);
  if (r.holyDrain) fail.push(`신앙 쪽인데 몸이 말랐다 (${r.holyDrain})`);
  if (r.afterReset[0] || r.afterReset[1]) fail.push(`판을 다시 시작해도 저울이 남았다 (${r.afterReset})`);

  fail.push(...errs);
  await b.close();
  console.log(out.join('\n'));
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  process.exit(fail.length ? 1 : 0);
})();

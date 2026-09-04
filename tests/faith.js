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
        능력은 「지키는 것은 신앙, 죽이고 빼앗는 것은 타락」을 따른다
     2-b. 문턱이 **닿는 거리**에 있다. 1차에서 값이 ±18 까지밖에 안 가는데 문턱이
        ±40 이라 계단이 한 번도 안 바뀌었다 — 켜진 적 없는 훅은 안 보이는 훅이다
     2-c. 계단마다 은혜와 저주가 **글로** 있다. 숫자만으로는 여파를 못 말한다
     2-d. 각성 68갈래가 전부 저울을 말한다. v1 은 「주는 무기」만 읽어서 68 중 6만
        말했다 — 한 판의 가장 큰 선택 넷이 침묵했다. 그리고 **모든 각성 화면이
        갈림길**이어야 한다: 형제 중 하나는 신앙 쪽, 하나는 타락 쪽
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
    o.trait = faithOf({ type: 'trait', key: 'bulwark', level: 1 });
    o.pass = {};
    for (const k in PASSIVES) o.pass[k] = [faithOf({ type: 'passive', key: k, isNew: true }),
                                          faithOf({ type: 'passive', key: k, level: 2 })];
    o.gate = [FAITH_T1, FAITH_T2, FAITH_MAX];

    // 2-d. 각성 68갈래
    const M = advFaithMap();
    o.adv = { n: ADVANCES.length, miss: [], groups: [], grantBad: [] };
    const g = {};
    for (const a of ADVANCES) {
      if (M[a.key] === undefined) o.adv.miss.push(a.name);
      (g[a.tier + '/' + a.from] = g[a.tier + '/' + a.from] || []).push(a);
      if (a.grant && WEAPONS[a.grant]) {
        const e = FAITH_ELEM[WEAPONS[a.grant].element] || 0;
        if (e && Math.sign(e) !== Math.sign(M[a.key] || 0))
          o.adv.grantBad.push(`${a.name}(${WEAPONS[a.grant].element} 지급인데 ${M[a.key]})`);
      }
    }
    for (const k in g)
      o.adv.groups.push([k, g[k].map(a => M[a.key]), g[k].map(a => a.name).join('/')]);
    // 각성만으로 어디까지 갈 수 있나 — 어느 직업으로도 양 끝에 닿아야 한다
    o.reach = {};
    for (const cls of ['warrior', 'rogue', 'mage', 'paladin']) {
      const walk = (from, tier, acc) => {
        if (tier > 3) return [acc];
        let out = [];
        for (const a of ADVANCES.filter(x => x.tier === tier && x.from === from))
          out = out.concat(walk(a.key, tier + 1, acc + M[a.key]));
        return out;
      };
      const t4 = ADVANCES.filter(a => a.tier === 4 && a.from === cls).map(a => M[a.key]);
      const all = [];
      for (const p of walk(cls, 1, 0)) for (const q of t4) all.push(p + q);
      o.reach[cls] = [Math.min(...all), Math.max(...all)];
    }
    o.words = {};
    for (const st of [-2, -1, 0, 1, 2]) o.words[st] = [faithBoon(st), faithCurse(st), FAITH_NAME[st + 2]];
    o.next = {}; for (const f of [0, 20, 40, 70, -20]) { Game.faith = f; o.next[f] = faithNext(); }

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
  const EXPECT = { holy: 12, frost: 12, blood: -12, fire: -12, physical: 0, storm: 0 };
  // 「지키는 것은 신앙, 죽이고 빼앗는 것은 타락」 — 규칙이 한 줄로 말해지는 것만 붙인다
  const PEXP = { armor: 8, regen: 8, vitality: 8, power: -8, haste: -8, greed: -8,
                 area: 0, boots: 0, magnet: 0 };
  for (const [k, [el, v]] of Object.entries(r.tilt))
    if (v !== EXPECT[el]) fail.push(`${k}(${el})가 ${v} — ${EXPECT[el]} 이어야 한다`);
  out.push('무기   ' + Object.entries(r.tilt).map(([k, [el, v]]) => `${k} ${v > 0 ? '+' + v : v}`).join(' · '));
  if (r.upgrade !== 6) fail.push(`무기 강화가 ${r.upgrade} — 6 이어야 한다 (새로 얻기의 절반)`);
  if (r.trait !== 0) fail.push(`직업 특성이 저울을 민다 (${r.trait}) — 특성은 각성(grant)으로만 민다`);
  for (const [k, [n, up]] of Object.entries(r.pass)) {
    if (PEXP[k] === undefined) { fail.push(`능력 ${k} 에 성향이 안 정해져 있다`); continue; }
    if (n !== PEXP[k]) fail.push(`능력 ${k} 가 ${n} — ${PEXP[k]} 여야 한다`);
    if (up !== PEXP[k] / 2) fail.push(`능력 ${k} 강화가 ${up} — ${PEXP[k] / 2} 여야 한다`);
  }
  out.push('능력   ' + Object.entries(r.pass).map(([k, [n]]) => `${k} ${n > 0 ? '+' + n : n}`).join(' · '));

  /* 문턱이 닿는 거리에 있는가. 1차 실패의 진짜 원인이 여기였다 — 저울은 보였는데
     한 번도 안 움직여서 은혜·저주·배너·물들임이 통째로 죽은 코드였다.
     새 무기 셋이면 1단, 일곱이면 2단. 그보다 멀면 20분 안에 안 닿는다. */
  out.push(`문턱   ${r.gate[0]} / ${r.gate[1]} (한계 ${r.gate[2]}) — 새 무기 ${Math.ceil(r.gate[0] / 12)}장이면 1단`);
  if (r.gate[0] > 12 * 3) fail.push(`1단 문턱 ${r.gate[0]} 이 멀다 — 새 무기 셋(36) 안에 닿아야 한다`);
  if (r.gate[1] > 12 * 7) fail.push(`2단 문턱 ${r.gate[1]} 이 멀다 — 한 판 안에 안 닿는다`);

  /* 각성은 이 훅의 척추다. v1 은 68 중 6만 말했고 4차 12종은 전부 0이었다 —
     한 판에서 가장 무거운 선택 넷이 저울에 대해 침묵하면 저울은 곁가지가 된다. */
  if (r.adv.miss.length) fail.push('성향이 없는 각성: ' + r.adv.miss.join(', '));
  let forkless = 0;
  for (const [k, vs, names] of r.adv.groups) {
    if (!vs.some(v => v > 0) || !vs.some(v => v < 0)) { forkless++; fail.push(`${k} (${names}) 이 갈림길이 아니다 — ${vs.join(',')}`); }
  }
  out.push(`각성   ${r.adv.n}종 · 갈림길 ${r.adv.groups.length}곳 중 ${r.adv.groups.length - forkless}곳`);
  if (r.adv.grantBad.length) fail.push('지급 무기와 성향이 어긋난다: ' + r.adv.grantBad.join(', '));
  out.push('닿는 곳 ' + Object.entries(r.reach).map(([c, v]) => `${c} ${v[0]}~${v[1]}`).join(' · '));
  for (const [c, [lo, hi]] of Object.entries(r.reach)) {
    if (hi < r.gate[1]) fail.push(`${c} 는 각성만으로 성인 문턱(${r.gate[1]})에 못 닿는다 (최대 ${hi})`);
    if (lo > -r.gate[1]) fail.push(`${c} 는 각성만으로 괴물 문턱에 못 닿는다 (최소 ${lo})`);
  }

  /* 「신앙 +12」는 방향만 말하고 결과를 안 말한다. 사람이 정확히 그 말을 했다 —
     「어떤 여파를 가져오게 될지 알려줘야 하는데」. 계단마다 글이 있어야 한다. */
  for (const [st, [bo, cu, nm]] of Object.entries(r.words)) {
    if (Number(st) === 0) continue;
    if (!bo) fail.push(`${nm} 계단에 은혜 문구가 없다`);
    if (!cu) fail.push(`${nm} 계단에 저주 문구가 없다`);
    if (nm.length > 3) fail.push(`계단 이름 「${nm}」 이 길다 — 240px HUD 줄에서 막대를 덮는다`);
  }
  out.push('문구   ' + [1, 2, -1, -2].map(st => `${r.words[st][2]}: ${r.words[st][0]} / 대가 ${r.words[st][1]}`).join(' · '));
  for (const [f, [left, to]] of Object.entries(r.next)) {
    const a = Math.abs(Number(f));
    const want = a < r.gate[0] ? r.gate[0] - a : a < r.gate[1] ? r.gate[1] - a : 0;
    if (left !== want) fail.push(`저울 ${f} 에서 다음 문턱까지 ${left} — ${want} 여야 한다`);
    if (Number(f) < 0 && to > 0) fail.push(`저울 ${f}(타락 쪽)인데 다음 문턱을 신앙 쪽으로 센다`);
  }
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

/* 대형 구조물 4종이 실제로 작동하는가.

   구조물은 '켜고 그 자리를 지키는' 물건이라, 확인할 것이 넷이다.
     1. 격자에서 4종이 전부 나오는가 (한 종류만 나오면 시스템이 아니라 장식이다)
     2. 다가가면 켜지는가
     3. 켜진 동안 제 효과가 실제로 붙는가 (빔 · 자원 · 피해 · 방어)
     4. 시간이 다하거나 적에게 부서져 사라지는가

   실행: node tests/structures.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 15000 });
  await pg.waitForTimeout(250);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
  await pg.keyboard.press('4'); await pg.waitForTimeout(300);

  const res = await pg.evaluate(() => {
    const out = { spread: {}, runs: [], cells: 0 };

    // 1. 격자를 넓게 훑어 4종이 고르게 나오는지 본다
    for (let cx = -30; cx <= 30; cx++) for (let cy = -30; cy <= 30; cy++) {
      if (hash2(cx * 17 + 401, cy * 23 + 197) < .58) continue;
      out.cells++;
      const k = ST_LIST[Math.floor(hash2(cx * 5 + 71, cy * 9 + 13) * ST_LIST.length) % ST_LIST.length];
      out.spread[k] = (out.spread[k] || 0) + 1;
    }

    // 2~4. 종류마다 실제로 찾아가 켜고 끝까지 굴린다
    for (const want of ST_LIST) {
      // 그 종류가 나오는 칸을 찾아 그 앞으로 간다
      let px = 0, py = 0, ok = false;
      for (let cx = -30; cx <= 30 && !ok; cx++) for (let cy = -30; cy <= 30 && !ok; cy++) {
        if (hash2(cx * 17 + 401, cy * 23 + 197) < .58) continue;
        const k = ST_LIST[Math.floor(hash2(cx * 5 + 71, cy * 9 + 13) * ST_LIST.length) % ST_LIST.length];
        if (k !== want) continue;
        const x = cx * ST_CELL + ST_CELL * (.22 + hash2(cx + 61, cy) * .56);
        const y = cy * ST_CELL + ST_CELL * (.22 + hash2(cx, cy + 61) * .56);
        if (Math.abs(x) < 620 && Math.abs(y) < 620) continue;
        px = x; py = y; ok = true;
      }
      if (!ok) { out.runs.push({ kind: want, err: '격자에서 못 찾음' }); continue; }

      selectedClass = 3; Game.reset();          // 마법사 — 자원이 시간으로 차서 배수를 보기 쉽다
      Game.time = 120; Game.state = 'playing';
      player.base.maxHp = 1e7; recomputeStats(); player.hp = 1e7;
      player.x = px; player.y = py;
      updateLandmarks(); updateStructures();
      const s = structures.find(v => Math.abs(v.x - px) < 1 && Math.abs(v.y - py) < 1);
      if (!s) { out.runs.push({ kind: want, err: '실체화 실패' }); continue; }

      const r = { kind: want, name: s.K.name, r: Math.round(s.r), lit: false,
                  beams: 0, resMul: 1, dmgMul: 1, armorMul: 1, shotsBlocked: 0,
                  hp0: 0, endedAt: null, ended: '' };
      let shotsBefore = 0;
      for (let f = 0; f < 60 * 40; f++) {
        // 꾸준히 몰려들게 한다 — 구조물은 '지키는' 물건이라 압박이 있어야 시험이 된다
        if (f % 9 === 0) {
          const a = Math.random() * 6.28, d = 170 + Math.random() * 280;
          Game.spawnEnemy('zombie', player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
        }
        // 수호 성채는 적 탄을 막는지 봐야 한다
        if (want === 'bastion' && f % 20 === 0) {
          const a = Math.random() * 6.28;
          spawnEShot(player.x + Math.cos(a) * 120, player.y + Math.sin(a) * 120, 0, 0, 1, '#ff7a7a');
          shotsBefore++;
        }
        if (Game.state !== 'playing') Game.state = 'playing';   // 레벨업 화면에서 멈추지 않게
        update(1 / 60);
        const cur = structures.find(v => v.key === s.key);
        if (cur && cur.st) {
          if (!r.lit) { r.lit = true; r.hp0 = cur.st.max; }
          r.beams = Math.max(r.beams, beams.filter(x => x.active).length);
          r.resMul = Math.max(r.resMul, player.stRes);
          r.dmgMul = Math.max(r.dmgMul, player.dynDmg);
          r.armorMul = Math.min(r.armorMul, player.dynArmor);
        } else if (r.lit && r.endedAt === null) {
          r.endedAt = +(f / 60).toFixed(1);
          r.ended = structState.get(s.key) === 'gone' ? '사라짐' : '?';
          break;
        }
      }
      if (want === 'bastion') r.shotsBlocked = shotsBefore - eshots.filter(x => x.active).length;
      out.runs.push(r);
    }
    return out;
  });

  console.log('격자 표본 ' + res.cells + '칸 — 종류 분포:',
    Object.entries(res.spread).map(([k, v]) => k + ' ' + v).join(' · '));
  console.log('');
  for (const r of res.runs) {
    if (r.err) { console.log(`  ${r.kind.padEnd(8)} 실패: ${r.err}`); continue; }
    const eff = r.kind === 'spire' ? `빔 동시 ${r.beams}`
      : r.kind === 'font' ? `자원 ×${r.resMul}`
      : r.kind === 'bastion' ? `방어 ×${r.armorMul.toFixed(2)} · 적 탄 차단 ${r.shotsBlocked}`
      : `피해 ×${r.dmgMul.toFixed(2)}`;
    console.log(`  ${r.name.padEnd(7)} r=${String(r.r).padStart(3)} 가동 ${r.lit ? 'O' : 'X'}` +
                ` · 체력 ${r.hp0} · ${eff} · ${r.endedAt}초에 ${r.ended}`);
  }

  const kinds = Object.keys(res.spread).length;
  const runs = res.runs;
  const lit = runs.every(r => r.lit);
  const gone = runs.every(r => r.endedAt !== null);
  const eff = runs.every(r =>
    r.kind === 'spire' ? r.beams > 0 :
    r.kind === 'font' ? r.resMul >= 2 :
    r.kind === 'bastion' ? (r.armorMul <= .5 && r.shotsBlocked > 0) :
    r.dmgMul >= 1.5);
  console.log('');
  console.log(`4종 생성 ${kinds === 4 ? 'O' : 'X'} · 전부 가동 ${lit ? 'O' : 'X'} · 전부 효과 ${eff ? 'O' : 'X'} · 전부 소멸 ${gone ? 'O' : 'X'}`);
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no errors');
  const pass = kinds === 4 && lit && gone && eff && !errs.length;
  console.log(pass ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();

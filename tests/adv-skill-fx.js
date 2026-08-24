/* 각성 스킬이 실제로 '그려지는가'를 확인한다.

   tests/adv-paths.js 는 각성이 열리고 수치가 붙는지만 본다(update 만 돌린다).
   이 테스트는 96개 경로를 전부 끝까지 밀어 최종 스킬을 발사하고,
   frame() 까지 돌려 픽셀 렌더 경로가 실제로 실행되는지 센다.

   잡으려는 것:
     · 발사했는데 아무것도 안 그려지는 스킬 (풀이 비어 있음)
     · 그리는 도중의 런타임 예외
     · 베기가 호(pxArc)로 가는지 창(pxLance)으로 가는지 — 사거리로 갈리므로
       실제로 어느 쪽이 쓰이는지는 굴려 봐야 안다

   실행: node tests/adv-skill-fx.js */
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

  const res = await pg.evaluate(() => {
    // 픽셀 렌더 함수가 실제로 불렸는지 센다. 풀에 들어간 것과 화면에 그려진 것은 다르다.
    const hit = { arc: 0, lance: 0, ring: 0, fx: 0 };
    const lens = [];
    const _arc = pxArc, _lance = pxLance, _ring = pxRing, _fx = spawnFx;
    pxArc = function (cx, cy, R) { hit.arc++; lens.push(['arc', Math.round(R)]); return _arc.apply(null, arguments); };
    pxLance = function (cx, cy, a, len) { hit.lance++; lens.push(['lance', Math.round(len)]); return _lance.apply(null, arguments); };
    pxRing = function () { hit.ring++; return _ring.apply(null, arguments); };
    spawnFx = function () { hit.fx++; return _fx.apply(null, arguments); };

    const out = [];
    for (let cls = 0; cls < 4; cls++) {
      for (const p1 of [0, 1]) for (const p2 of [0, 1]) for (const p3 of [0, 1]) for (const p4 of [0, 1, 2]) {
        selectedClass = cls; Game.reset();
        const picks = [p1, p2, p3, p4];
        for (let lv = 1; lv < 60; lv++) {
          player.sigils = 9; Game.time = RUN_TIME;
          player.xp = player.xpNext; Game.levelUp();
          let g = 0;
          while ((Game.state === 'levelup' || Game.state === 'advance') && g++ < 6) {
            if (Game.state === 'advance') {
              const t = player.advance.length;
              Game.applyChoice(Game.choices[Math.min(picks[t] ?? 0, Game.choices.length - 1)]);
            } else Game.applyChoice(Game.choices[0]);
          }
        }
        Game.state = 'playing';
        player.hp = player.stats.maxHp = 1e7;
        for (let i = 0; i < 70; i++)
          Game.spawnEnemy('zombie', player.x + rnd(-320, 320), player.y + rnd(-320, 320));

        // 스킬만의 효과를 보려면 무기가 만든 것을 먼저 치운다
        for (const pool of [slashes, waves, bolts, projectiles, fxs]) for (const o of pool) o.active = false;
        hit.arc = hit.lance = hit.ring = hit.fx = 0; lens.length = 0;
        const dashBefore = player.dash;

        player.faceX = 1; player.faceY = 0; player.res = 100;
        const before = { s: 0, w: 0, b: 0, p: 0 };
        useSkill();
        before.s = slashes.filter(o => o.active).length;
        before.w = waves.filter(o => o.active).length;
        before.b = bolts.filter(o => o.active).length;
        before.p = projectiles.filter(o => o.active).length;
        const dashed = player.dash > dashBefore;

        // 그리기까지 돌린다 — 여기서 픽셀 렌더가 실행된다
        for (let f = 0; f < 24; f++) { if (Game.state !== 'playing') Game.state = 'playing'; update(1 / 60); frame(performance.now()); }

        out.push({
          cls: player.cls.name, skill: curSkill().name, tiers: player.advance.length,
          spawn: before, dashed,
          drew: { arc: hit.arc, lance: hit.lance, ring: hit.ring, fx: hit.fx },
          lens: lens.slice(0, 60),
        });
      }
    }
    pxArc = _arc; pxLance = _lance; pxRing = _ring; spawnFx = _fx;
    return out;
  });

  // ── 스킬별로 접는다 ──
  const bySkill = new Map();
  for (const r of res) {
    let e = bySkill.get(r.skill);
    if (!e) bySkill.set(r.skill, e = { cls: r.cls, n: 0, arc: 0, lance: 0, ring: 0, fx: 0, dash: 0, proj: 0, lens: new Set() });
    e.n++;
    e.arc += r.drew.arc; e.lance += r.drew.lance; e.ring += r.drew.ring; e.fx += r.drew.fx;
    if (r.dashed) e.dash++;
    e.proj += r.spawn.p;
    for (const [k, v] of r.lens) e.lens.add(k[0] + v);
  }

  const kindOf = e =>
    [e.lance && '창', e.arc && '호', e.ring && '고리', e.proj && '탄', e.dash && '돌진', e.fx && '섬광']
      .filter(Boolean).join('+') || '—';

  console.log(`경로 ${res.length}개 · 고유 최종 스킬 ${bySkill.size}종`);
  console.log(`4차까지 도달: ${res.filter(r => r.tiers === 4).length}/${res.length}`);
  console.log('');
  const rows = [...bySkill.entries()].sort((a, b) => a[1].cls.localeCompare(b[1].cls));
  for (const [name, e] of rows)
    console.log(`  ${e.cls.padEnd(4)} ${name.padEnd(10)} ${kindOf(e).padEnd(14)} 경로 ${String(e.n).padStart(2)}`);

  // ── 판정 ── 발사했는데 아무것도 안 그리는 스킬이 있으면 실패
  const silent = rows.filter(([, e]) => kindOf(e) === '—');
  console.log('');
  console.log('그리는 것이 없는 스킬:', silent.length ? silent.map(r => r[0]).join(', ') : '없음');
  console.log('베기 종류별 사거리:',
    [...new Set(rows.flatMap(([, e]) => [...e.lens]))].sort().join(' ').slice(0, 300) || '없음');
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no errors');

  const ok = !errs.length && !silent.length && res.every(r => r.tiers === 4);
  console.log(ok ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(ok ? 0 : 1);
})();

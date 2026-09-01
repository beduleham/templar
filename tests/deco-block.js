/* 회귀: 서 있어 보이는 장식을 몸으로 통과하지 않는가.

   장식 겹(부서진 기둥·항아리·잔해·깃대·아치)은 그림만 깔고 충돌을 안 줬다.
   화면에 51개가 서 있는데 전부 통과되니, 한 번 겪고 나면 나머지 50개도
   '무늬'로 내려앉는다 — 배경을 채우려고 만든 것이 오히려 배경을 납작하게 했다.

   충돌은 지형과 같은 길(obstacles)로 처리하되 stop·reflect·breakable 이 전부
   거짓이라 발사체는 그냥 지나가야 한다. 장식이 탄을 먹으면 '왜 안 맞지'가 된다.
   그것까지 여기서 본다.

   잔해 더미(flat)만 통과해야 한다 — 납작하게 깔린 것을 타고 넘는 것은 자연스럽다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(600);

  const r = await pg.evaluate(async () => {
    Game.reset(); Game.state = 'playing';
    const step = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const log = [], out = { log, deco: {}, proj: null, blocked: null, minimap: null };
    await step();

    // 장식을 종류별로 모은다 — 가장 큰 개체로 시험한다
    const seen = new Map();
    for (let gx = -6; gx <= 6; gx += 2) for (let gy = -6; gy <= 6; gy += 2) {
      player.x = gx * 354; player.y = gy * 354;
      updateObstacles(); updateDecos();
      for (const d of decos) seen.set(d.kind + ':' + d.x.toFixed(1), d);
    }
    const byKind = {};
    for (const d of seen.values()) (byKind[d.kind] = byKind[d.kind] || []).push(d);
    log.push('장식 종류: ' + Object.keys(byKind).length + '종, 표본 ' + seen.size + '개');

    for (const kind of Object.keys(DECO_KINDS)) {
      const list = byKind[kind];
      if (!list) { log.push('!! 표본 없음 ' + kind); continue; }
      const d = list.sort((a, b) => b.r - a.r)[0];
      const col = d.K.col || 0;
      // 충돌 원 밖에서 출발해 정면으로 밀고 들어간다
      player.x = d.x - d.r * (col || 1) - player.r - 40; player.y = d.y;
      let minD = 1e9;
      for (let i = 0; i < 70; i++) {
        keys.add('d');
        if (Game.state !== 'playing') Game.state = 'playing';
        await step();
        minD = Math.min(minD, Math.hypot(player.x - d.x, player.y - d.y));
      }
      keys.clear();
      out.deco[kind] = { name: d.K.name, r: +d.r.toFixed(1), col,
                         need: +(d.r * col + player.r).toFixed(1),
                         minD: +minD.toFixed(1), through: player.x > d.x };
    }

    // 발사체는 장식을 그냥 지나가야 한다
    player.x = 40000; player.y = 40000;
    updateObstacles(); updateDecos();
    const dc = obstacles.filter(o => o.deco);
    out.proj = { count: dc.length,
                 stop: dc.filter(o => o.K.stop).length,
                 reflect: dc.filter(o => o.K.reflect).length,
                 breakable: dc.filter(o => o.K.breakable).length,
                 block: dc.filter(o => o.K.block).length,
                 drawnAsObstacle: dc.filter(o => !o.deco).length };

    // 땅이 얼마나 막혔나 — 미로가 되면 안 된다
    let hit = 0, tot = 0;
    for (let gx = -8; gx <= 8; gx++) for (let gy = -8; gy <= 8; gy++) {
      player.x = gx * 400; player.y = gy * 400;
      updateObstacles(); updateDecos();
      for (let sx = -180; sx <= 180; sx += 20) for (let sy = -180; sy <= 180; sy += 20) {
        const px = player.x + sx, py = player.y + sy; tot++;
        for (const o of obstacles) {
          if (!o.K.block) continue;
          const mn = o.r + player.r;
          if ((px - o.x) ** 2 + (py - o.y) ** 2 < mn * mn) { hit++; break; }
        }
      }
    }
    out.blocked = +(hit / tot * 100).toFixed(2);
    return out;
  });

  for (const l of r.log) console.log(l);
  let bad = 0;
  console.log('\n종류        반지름  충돌비  멈춰야 할 거리  실제 최소거리  통과?');
  for (const [k, v] of Object.entries(r.deco)) {
    const wantBlock = v.col > 0;
    const ok = wantBlock ? (!v.through && v.minD >= v.need - 1.5) : v.through;
    if (!ok) bad++;
    console.log(`${(v.name + '        ').slice(0, 9)}  ${String(v.r).padStart(5)}  ${String(v.col).padStart(5)}  ${String(v.need).padStart(13)}  ${String(v.minD).padStart(12)}  ${v.through ? '통과' : '막힘'}  ${ok ? 'OK' : '!! 실패'}`);
  }
  const p = r.proj;
  console.log(`\n장식 충돌 원 ${p.count}개 — block ${p.block} / stop ${p.stop} / reflect ${p.reflect} / breakable ${p.breakable}`);
  if (p.block !== p.count) { console.log('!! 막지 않는 충돌 원이 있다'); bad++; }
  if (p.stop || p.reflect || p.breakable) { console.log('!! 장식이 발사체에 관여한다'); bad++; }
  console.log(`땅이 막힌 비율: ${r.blocked}%`);
  if (r.blocked > 12) { console.log('!! 너무 많이 막혔다 — 걷는 맛이 사라진다'); bad++; }
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

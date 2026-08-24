/* 화면에 '그려져야 하는 것'이 실제로 그려지는가.

   왜 필요한가: 지형 렌더를 픽셀로 갈아엎다가 교체 범위를 잘못 잡아
   지형지물 · 적 그림자 · drawEnemy · drawEnemyNames · drawPlayer 를 통째로
   지웠다. 문법도 통과하고 테스트 7종도 전부 통과했다 — 아무도 '보이는가'를
   확인하지 않았기 때문이다. 주인공과 적이 안 보이는 빌드가 나갈 뻔했다.

   방식: 대상 하나만 놓고 한 프레임 그린 뒤, 그 자리의 픽셀이
   빈 바닥과 다른지 센다. 색을 검사하지 않으므로 아트를 바꿔도 안 깨진다.

   실행: node tests/regress-draw.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 15000 });
  await pg.waitForTimeout(250);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
  await pg.keyboard.press('1'); await pg.waitForTimeout(300);

  const res = await pg.evaluate(() => {
    const out = [];
    // 한 프레임 그린 뒤 지정한 사각형 안에서 '바닥이 아닌' 픽셀을 센다
    const countAt = (cx, cy, half) => {
      const d = ctx.getImageData(cx - half, cy - half, half * 2, half * 2).data;
      // 바닥 타일의 밝기 범위를 넘어서는 픽셀만 센다
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const lum = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
        if (lum > 70) n++;
      }
      return n;
    };
    /* frame() 은 안에서 update() 를 돌려 지형·구조물 배열을 격자로 다시 채운다.
       그래서 프레임을 한 번 굴려 카메라를 잡은 뒤에는, 바닥만 다시 깔고
       배열을 갈아끼운 다음 drawWorld() 만 부른다. */
    const shot = setup => {
      clean();
      drawBackground();
      setup();
      drawWorld();
    };
    const clean = () => {
      for (const pool of [enemies, projectiles, slashes, waves, gems, pickups,
                          particles, numbers, bolts, beams, eshots, hazards, fxs])
        for (const o of pool) o.active = false;
      obstacles.length = 0; landmarks.length = 0; structures.length = 0;
    };

    Game.time = 100; Game.state = 'playing';
    player.base.maxHp = 1e7; recomputeStats(); player.hp = 1e7;

    // 0. 바닥 — 아무것도 없어도 타일이 깔려야 한다
    frame(performance.now());
    shot(() => {});
    {
      const d = ctx.getImageData(200, 600, 80, 60).data;
      let varied = 0, first = d[0] * 1 + d[1] * 2 + d[2] * 3;
      for (let i = 0; i < d.length; i += 4)
        if (Math.abs((d[i] + d[i + 1] * 2 + d[i + 2] * 3) - first) > 3) varied++;
      out.push({ what: '바닥 타일', n: varied, min: 40 });
    }

    // 1. 적 — 화면 한쪽에 한 마리만
    let e = null;
    shot(() => { e = Game.spawnEnemy('zombie', player.x + 260, player.y - 120); });
    out.push({ what: '적', n: countAt(Math.round(e.x - cam.x), Math.round(e.y - cam.y), 26), min: 40 });

    // 2. 주인공 — 화면 한가운데
    shot(() => {});
    out.push({ what: '주인공', n: countAt(Math.round(player.sx), Math.round(player.sy - 4), 20), min: 40 });

    // 3. 지형 — 바위 하나
    shot(() => {
      obstacles.push({ key: 'd', kind: 'rock', K: OBS_KINDS.rock, wall: false,
                       x: player.x - 300, y: player.y + 60, r: 40, st: { hp: 100, max: 100 }, seed: .4 });
    });
    out.push({ what: '지형(바위)', n: countAt(Math.round(player.x - 300 - cam.x), Math.round(player.y + 60 - cam.y), 34), min: 40 });

    // 4. 지형지물 — 상자
    shot(() => {
      landmarks.push({ key: 'l', type: 'chest', T: LM_TYPES.chest,
                       x: player.x + 300, y: player.y + 80, r: 20, fighting: false });
    });
    out.push({ what: '지형지물(상자)', n: countAt(Math.round(player.x + 300 - cam.x), Math.round(player.y + 80 - cam.y), 26), min: 30 });

    // 5. 대형 구조물
    shot(() => {
      structures.push({ key: 's', kind: 'spire', K: ST_KINDS.spire,
                        x: player.x - 260, y: player.y - 40, r: 120, st: null, seed: .5 });
    });
    out.push({ what: '구조물(첨탑)', n: countAt(Math.round(player.x - 260 - cam.x), Math.round(player.y - 40 - cam.y - 90), 60), min: 60 });

    // 6. 보석
    shot(() => { spawnGem(player.x + 150, player.y + 150, 50); });
    out.push({ what: '보석', n: countAt(Math.round(player.x + 150 - cam.x), Math.round(player.y + 150 - cam.y), 18), min: 4 });

    // 7. 획득물
    shot(() => { spawnPickup(player.x - 150, player.y + 150, 'sigil'); });
    out.push({ what: '획득물(징표)', n: countAt(Math.round(player.x - 150 - cam.x), Math.round(player.y + 150 - cam.y), 22), min: 10 });

    return out;
  });

  let ok = true;
  for (const r of res) {
    const pass = r.n >= r.min;
    if (!pass) ok = false;
    console.log(`  ${r.what.padEnd(14)} 픽셀 ${String(r.n).padStart(5)} (최소 ${r.min})  ${pass ? 'OK' : '보이지 않음'}`);
  }
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no errors');
  const pass = ok && !errs.length;
  console.log(pass ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();

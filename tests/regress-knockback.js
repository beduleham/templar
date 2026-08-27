/* 회귀: 넉백이 '맞은 쪽'으로, 그리고 '보이게' 밀어내는가.

   제보는 "전부 같은 방향으로 밀려난다" 였다. 재 보니 방향은 맞았고 세기가 문제였다 —
   성역(40)은 한 대에 5px, 픽셀아트로 두 칸이 안 돼서 화면에서 사라졌다.
   그래서 눈에 띄는 넉백이 참격(±35도 부채꼴)뿐이었고, 그게 '전부 같은 방향'으로 보였다.

   이 테스트는 두 가지를 지킨다.
   1) 방향 — 한 점에서 때리면 적은 그 점의 반대쪽으로 간다 (오차 15도 이내).
   2) 세기 — 게임에서 가장 약한 넉백도 열 프레임 안에 6px(픽셀 두 칸) 이상 움직인다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(300);

  const out = await pg.evaluate(() => {
    selectedClass = 0; Game.reset(); Game.state = 'playing';
    Game.updateSpawning = () => {};                  // 난입 금지 — 재는 열여섯 마리만 둔다
    updateObstacles = () => { obstacles.length = 0; };
    inputVector = () => ({ x: 0, y: 0 });            // 주인공은 가만히
    player.weapons.length = 0;                       // 무기가 끼어들면 두 번 맞는다
    for (const e of enemies) { e.active = false; e.dying = false; }

    const N = 16, R = 70, hx = player.x, hy = player.y;
    const mark = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU;
      const e = Game.spawnEnemy('slime', hx + Math.cos(a) * R, hy + Math.sin(a) * R);
      if (!e) continue;
      e.hp = e.maxHp = 1e9;
      /* 걸음을 멈춰 세운다. 여기서 재려는 것은 '한 대가 얼마나 미는가' 하나다 —
         추격까지 켜 두면 밀린 거리와 걸어 돌아온 거리가 섞여 무엇이 변했는지 알 수 없다.
         추격을 이겨 내는지는 따로 잰다(성역 한 대 = 8프레임에 8.3px). */
      e.spd = 0;
      mark.push({ e, want: a, x0: e.x, y0: e.y });
    }
    // 게임에서 가장 약한 넉백(불타는 통 20)으로 때린다 — 이게 보이면 나머지는 다 보인다
    for (const m of mark) damageEnemy(m.e, 0, hx, hy, 20, 'fire');
    for (let f = 0; f < 10; f++) update(1 / 60);

    let worstDeg = 0, minMove = 1e9;
    for (const m of mark) {
      const dx = m.e.x - m.x0, dy = m.e.y - m.y0;
      const move = Math.hypot(dx, dy);
      if (move < minMove) minMove = move;
      if (move < .01) { worstDeg = 999; continue; }
      const off = Math.abs(((Math.atan2(dy, dx) - m.want + Math.PI * 3) % TAU) - Math.PI);
      if (off > worstDeg) worstDeg = off;
    }
    return { n: mark.length, worstDeg: +(worstDeg * 180 / Math.PI).toFixed(1),
             minMove: +minMove.toFixed(1) };
  });

  console.log(JSON.stringify(out));
  const fail = [];
  if (out.n < 16) fail.push(`적을 ${out.n} 마리밖에 못 세웠다 — 계측이 성립하지 않는다`);
  if (out.worstDeg > 15) fail.push(`맞은 쪽에서 ${out.worstDeg}도 어긋나 밀렸다 (15도 이내여야 한다)`);
  if (out.minMove < 6) fail.push(`가장 약한 넉백이 10프레임에 ${out.minMove}px 밖에 못 밀었다 — 화면에서 안 보인다 (6px 이상)`);
  if (errs.length) fail.push('page error: ' + errs.join(' / '));
  console.log(fail.length ? 'FAIL\n  ' + fail.join('\n  ') : 'PASS');
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();

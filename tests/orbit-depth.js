/* 회귀: 수호 성서가 등 뒤를 지날 때 주인공에게 가려지는가. 그리고 유령 크기.

   궤도 무기는 무기 그리기 패스에서 그렸는데 그 패스는 drawDepth 다음이라,
   성서 여덟 장이 늘 주인공 위에 얹혔다. 궤도는 한 바퀴를 도는 것이라 절반은
   등 뒤를 지나는데, 그 절반이 앞으로 나와 있으면 '도는' 것으로 안 보이고
   얼굴 앞에서 왔다 갔다 하는 것으로 보인다.

   고친 방법은 성서를 낱장으로 depthList 에 넣는 것이다. 월드 y 를 가진
   '서 있는 것'이 되므로 몹·지형과도 같이 정렬된다.

   ── 무엇으로 재는가

   진짜 검사는 '깊이 목록의 순서'다. 뒤쪽 성서는 주인공보다 먼저, 앞쪽 성서는
   나중에 그려져야 한다. 이건 정확하고 흔들리지 않는다.

   픽셀은 보조로만 쓴다. 쿼터뷰라 화면 y = (월드 y - cam.y) × TILT 이고,
   1레벨 궤도 반지름 56 은 화면에서 37px 뜬다 — 주인공 키와 비슷해서 겹치는 곳이
   투구뿐이다. 그래서 다 가려져도 숫자는 20% 남짓만 준다. 이 값을 '작다'고 읽고
   기준을 높게 잡으면 멀쩡한 고침을 되돌리게 된다.

   기준선은 앞쪽 성서로 삼는다. 두 장은 각도가 정확히 π 차이인데 그리기 회전이
   `nd.a * 2` 라 2π 차이 — 즉 **같은 그림**이다. 크기도 같다. 가려지지 않았다면
   두 숫자가 같아야 한다.

   (처음에 TILT 를 빼먹고 상자를 앉혔더니 앞뒤 둘 다 0개가 나와 '고쳐도 안
   그려진다'로 읽을 뻔했다.) */
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
    addWeapon('orbit');
    player.x = 40000; player.y = 40000;            // 지형·장식이 끼어들지 않는 자리
    const w = player.weapons.find(x => x.key === 'orbit');
    for (let i = 0; i < 40; i++) {
      if (Game.state !== 'playing') Game.state = 'playing';
      for (const e of enemies) e.active = false;
      w.angle = -Math.PI / 2;                      // 0번은 바로 위(뒤), 1번은 바로 아래(앞)
      await step();
    }
    const c = document.querySelector('canvas');
    const dpr = c.width / W;
    const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
    const gc = g.getContext('2d');
    gc.drawImage(c, 0, 0);
    // 성서 표지색 #f4efe0 을 센다. 화면 y 는 TILT 로 눌린다.
    const cream = (n) => {
      const sx = (n.x - cam.x) * dpr, sy = (n.y - cam.y) * TILT * dpr, s = Math.round(22 * dpr);
      const d = gc.getImageData(Math.round(sx) - s, Math.round(sy) - s, s * 2, s * 2).data;
      let k = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i] > 215 && d[i + 1] > 208 && d[i + 2] > 185 && d[i + 2] < 240 && d[i] - d[i + 2] < 40) k++;
      return k;
    };
    const order = depthList.map(x => x[1]);
    const gf = Sprites.frames.ghost, GT = ENEMY_TYPES.ghost;
    return {
      behind: cream(w.nodes[0]), front: cream(w.nodes[1]),
      behindY: +(w.nodes[0].y - player.y).toFixed(1), frontY: +(w.nodes[1].y - player.y).toFixed(1),
      nodes: w.nodes.length,
      playerIdx: order.indexOf(3),
      orbitIdx: order.map((v, i) => v === 5 ? i : -1).filter(i => i >= 0),
      weaponDraw: !!WEAPONS.orbit.draw,
      ghost: { r: GT.r, w: +(gf.w * (GT.r / 14 * CHAR_SCALE) * gf.s).toFixed(1) },
    };
  });

  let bad = 0;
  console.log(`깊이 목록 — 주인공 ${r.playerIdx}, 성서 ${r.orbitIdx.join(' · ')} (성서 ${r.nodes}장)`);
  if (r.orbitIdx.length !== r.nodes) { console.log('!! 성서가 깊이 목록에 다 들어가지 않았다'); bad++; }
  if (!(r.orbitIdx[0] < r.playerIdx)) { console.log('!! 뒤쪽 성서가 주인공보다 나중에 그려진다'); bad++; }
  if (!(r.orbitIdx[r.orbitIdx.length - 1] > r.playerIdx)) { console.log('!! 앞쪽 성서가 주인공보다 먼저 그려진다'); bad++; }
  if (r.weaponDraw) { console.log('!! 무기 패스에도 draw 가 남아 있다 — 두 번 그려진다'); bad++; }

  console.log(`뒤쪽 성서(Δy ${r.behindY}) ${r.behind}px · 앞쪽 성서(Δy ${r.frontY}) ${r.front}px`);
  if (r.front < 120) { console.log('!! 앞쪽 성서가 안 보인다 — 측정 상자가 빗나갔다'); bad++; }
  const hid = 1 - r.behind / Math.max(1, r.front);
  console.log(`뒤쪽이 가려진 정도: ${(hid * 100).toFixed(0)}% (투구에 걸리는 만큼)`);
  if (hid < .10) { console.log('!! 뒤쪽 성서가 주인공에게 가려지지 않는다'); bad++; }

  // 유령 크기 — r 13 시절의 정확히 2배
  console.log(`\n유령 r=${r.ghost.r}, 화면 폭 ${r.ghost.w}px`);
  if (r.ghost.r !== 26) { console.log('!! 유령 반지름이 26이 아니다'); bad++; }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

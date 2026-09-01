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
   그려진다'로 읽을 뻔했다.)

   ── 왜 화면을 붙들어 매는가

   붙들지 않으면 **같은 코드가 4%~13% 를 오갔다.** 기준이 10% 였으니 고쳐 놓은
   것이 무작위로 빨개졌다. 재는 자를 먼저 고쳐야 했다.

   범인은 **직업 기본 무기의 베기**였다. 성기사의 베기는 크림색 부채꼴이라
   측정 상자를 들락거리며 크림 칸을 보탠다. 앞쪽 성서(가려질 일이 없는 기준선)가
   153 에서 195 까지 뛴 것이 증거다 — 기준선이 흔들리면 비율은 뜻이 없다.
   쿨다운은 실시간이라 게임 시각을 눌러도 멈추지 않는다. 그래서 궤도만 남기고,
   매 프레임 이펙트 풀을 비운다.

   함께 눌러 두는 것이 둘 더 있다.

   하나는 성서의 회전이다. 각도를 눌러 놓고 한 프레임 돌리면 그 안에서 고정
   타임스텝이 **한 번 돌 수도, 두 번 돌 수도** 있다(acc 가 STEP 을 넘는 횟수).
   성서는 `nd.a * 2` 로 도는 네모라 회전이 달라지면 크림 칸 수가 같이 바뀐다.

   하나는 대기 동작이다. 주인공은 6fps 4장이라 장마다 투구 자리가 다를 수 있다.
   (실측해 보니 이 그림에서는 네 장이 투구 언저리에서 같아 125/154 로 똑같이
   나온다. 그래도 눌러 둔다 — 그림을 갈면 달라질 값이다.)

   그래서 update 를 감싸 **매 프레임 끝에** 각도·시각·이펙트를 도로 눌러 놓고,
   한 장이 아니라 **대기 동작 네 장 모두**에서 잰다. 한 장만 재면 운 좋은 순간을
   찍고 통과할 수 있다 — 등 뒤는 언제나 가려져야 한다.

   기준 12% 는 붙들고 난 실측(네 장 × 네 번 모두 18~19%)에서 잡았다. 되돌리면
   0% 가 나오므로 사이가 넓다. 앞의 10% 는 흔들리는 값에서 잡은 것이라 잘못이었다.
   (피격 섬광 회귀에서 똑같은 실수를 했다. 거기서도 움직임을 재고 있었다.) */
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
    /* 직업 기본 무기는 빼 둔다. 성기사의 베기는 크림색 부채꼴이라 측정 상자 안에
       들락거리며 크림 칸을 보태 준다 — 쿨다운은 실시간이라 눌러도 안 멈춘다.
       (이것 때문에 각도와 대기 동작을 붙들고도 앞쪽 성서가 155~195 로 흔들렸다.) */
    player.weapons.length = 0; player.weapons.push(w);

    /* 매 프레임 끝에 장면을 도로 눌러 놓는다 — 그려지는 순간의 상태를 한 값으로
       못 박는다. 각도를 눌렀으면 성서 자리도 다시 잡아야 한다(dt 0 으로 돌린다). */
    let PIN = 0;
    const realUpdate = update;
    window.update = (dt) => {
      realUpdate(dt);
      for (const e of enemies) e.active = false;
      for (const pool of [slashes, projectiles, waves, beams, bolts, particles, numbers, fxs])
        for (const o of pool) o.active = false;
      w.angle = -Math.PI / 2;                      // 0번은 바로 위(뒤), 1번은 바로 아래(앞)
      WEAPONS.orbit.passiveUpdate(player, w, 0);
      Game.time = PIN;
    };

    // 성서 표지색 #f4efe0 을 센다. 화면 y 는 TILT 로 눌린다.
    const cream = (n, gc, dpr) => {
      const sx = (n.x - cam.x) * dpr, sy = (n.y - cam.y) * TILT * dpr, s = Math.round(22 * dpr);
      const d = gc.getImageData(Math.round(sx) - s, Math.round(sy) - s, s * 2, s * 2).data;
      let k = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i] > 215 && d[i + 1] > 208 && d[i + 2] > 185 && d[i + 2] < 240 && d[i] - d[i + 2] < 40) k++;
      return k;
    };
    const shot = async (t, frames) => {
      PIN = t;
      for (let i = 0; i < frames; i++) {
        if (Game.state !== 'playing') Game.state = 'playing';
        await step();
      }
      const c = document.querySelector('canvas'), dpr = c.width / W;
      const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
      const gc = g.getContext('2d'); gc.drawImage(c, 0, 0);
      return { behind: cream(w.nodes[0], gc, dpr), front: cream(w.nodes[1], gc, dpr) };
    };

    /* 대기 동작은 6fps 4장이라 한 바퀴가 4/6초다. 각 장의 한가운데를 찍는다 —
       경계에 걸치면 어느 장이 나올지 다시 rAF 가 정하게 된다. */
    const frames = [];
    for (let i = 0; i < 4; i++) frames.push(await shot((i + .5) / 6, i ? 4 : 30));

    const order = depthList.map(x => x[1]);
    const gf = Sprites.frames.ghost, GT = ENEMY_TYPES.ghost;
    return {
      frames,
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

  console.log(`뒤쪽 성서 Δy ${r.behindY} · 앞쪽 성서 Δy ${r.frontY}`);
  r.frames.forEach((f, i) => {
    const hid = 1 - f.behind / Math.max(1, f.front);
    console.log(`  대기 ${i + 1}장 — 뒤 ${String(f.behind).padStart(3)}px · 앞 ${String(f.front).padStart(3)}px`
      + `  가려진 정도 ${(hid * 100).toFixed(0)}% (투구에 걸리는 만큼)`);
    if (f.front < 120) { console.log(`  !! ${i + 1}장 — 앞쪽 성서가 안 보인다, 측정 상자가 빗나갔다`); bad++; }
    if (hid < .12) { console.log(`  !! ${i + 1}장 — 뒤쪽 성서가 주인공에게 가려지지 않는다`); bad++; }
  });

  // 유령 크기 — r 13 시절의 정확히 2배
  console.log(`\n유령 r=${r.ghost.r}, 화면 폭 ${r.ghost.w}px`);
  if (r.ghost.r !== 26) { console.log('!! 유령 반지름이 26이 아니다'); bad++; }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

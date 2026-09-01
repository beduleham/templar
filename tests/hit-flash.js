/* 회귀: 맞은 적이 하얗게 번쩍이는가.

   손그림 스프라이트로 갈아 끼우면서 조용히 죽었던 기능이다. 도형 렌더링에는
   `e.flash > 0 ? "#ffffff" : T.color` 가 있는데, 스프라이트 경로는 그보다
   앞에서 `return` 하므로 그 줄에 아예 도달하지 않았다. 14종 전부 맞아도
   번쩍이지 않았고, 그걸 잡는 테스트가 없어서 여러 판을 그대로 넘어갔다.
   특히 강철 처형자는 예비동작 1초 내내 `e.flash = .1` 로 '지금 온다'를
   알리는데, 그 예고가 통째로 없었다.

   고친 방법은 로드 때 흰 실루엣 판을 한 장 구워 두고 flash 동안 겹쳐 그리는
   것이다(Sprites.bakeFlash).

   측정은 '화면 전체를 두 번 찍어 뺀다'. 처음에는 몹 자리만 잘라내려 했는데
   두 번 다 틀렸다 — 캔버스가 dpr 배로 떠 있는 것과 쿼터뷰의 세로 늘림 때문에
   상자가 엉뚱한 데 앉아, 한 번은 몹을 반만 담고 한 번은 아예 빗나갔다.
   바뀐 것이 몹뿐이므로 전체를 빼면 좌표 계산이 아예 필요 없다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);

  const r = await pg.evaluate(async () => {
    Game.reset(); Game.state = 'playing';
    const out = {};
    const step = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const shot = () => {
      const c = document.querySelector('canvas');
      const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
      t.getContext('2d').drawImage(c, 0, 0);
      return t.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    for (const kind of ['zombie', 'brute', 'shield', 'hound', 'guardian', 'boss1', 'boss2']) {
      for (const e of enemies) e.active = false;
      const z = Game.spawnEnemy(kind, player.x + 170, player.y - 170, RANKS.common);
      z.think = () => {}; z.spd = 0; z.hp = 1e7; z.maxHp = 1e7; z.boss = false; z.sigilKey = null;
      player.base.maxHp = 1e9; recomputeStats(); player.hp = 1e9;
      /* 두 장 사이에 몹이 조금도 움직이면 안 된다.

         처음엔 안 묶어 뒀더니 사냥개의 '최대'가 같은 코드로 98~202 사이를
         오갔다(기준은 100). 까닭은 둘이다 — 걷기 장이 넘어가고(anim 은 spd 가
         0 이어도 최소 0.35 배로 나아간다), 떠 있는 높이가 wob 을 따라 흔들린다.
         화면 전체를 빼는 방식이라 그 움직임이 '밝아진 픽셀'로 그대로 들어오고,
         가장 작은 그림에서는 그 잡음이 신호를 덮는다.

         두 값을 찍기 직전마다 0 으로 눌러 같은 장을 같은 자리에 세운다. */
      const pin = () => { z.anim = 0; z.wob = 0; z.flash = z.flash; };
      z.flash = 0; pin(); await step(); pin(); const a = shot();
      z.flash = .12; pin(); await step(); pin(); const c = shot();   // 실제 피격이 넣는 값
      let n = 0, sum = 0, mx = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = (c[i] - a[i]) + (c[i + 1] - a[i + 1]) + (c[i + 2] - a[i + 2]);
        if (d > 60) { n++; sum += d / 3; if (d / 3 > mx) mx = d / 3; }
      }
      out[kind] = { n, avg: n ? +(sum / n).toFixed(0) : 0, max: +mx.toFixed(0) };
    }
    return out;
  });
  await b.close();

  const bad = [];
  if (errs.length) bad.push("예외: " + errs.join(" / "));
  console.log("피격 순간 밝아진 픽셀 (flash = .12)");
  for (const [k, v] of Object.entries(r)) {
    console.log(`  ${k.padEnd(9)} ${String(v.n).padStart(6)}px   평균 +${v.avg}   최대 +${v.max}`);
    /* 문턱은 넉넉하게 잡는다. 이 테스트가 잡아야 하는 것은 '섬광이 아예 없다'
       (고치기 전 실측 0px)이지 세기가 아니다. 몹마다 그림 크기와 원래 밝기가
       다르다 — 사냥개는 36x19 로 가장 작아 밝아지는 픽셀 수가 적고, 파수꾼은
       원래 밝은 보랏빛이라 희게 만들어도 덜 오른다. 그걸 결함으로 잡으면
       테스트가 그림마다 거짓말을 한다.

       '최대'의 문턱을 100 으로 두었다가 사냥개(97)에 걸렸다. **그 100 은 장면을
       묶기 전의 흔들리는 값에서 나온 숫자였다** — 두 장 사이에 몹이 움직이던
       때는 같은 코드로 98~202 가 나왔고, 통과하던 판들은 섬광이 아니라 움직임이
       부풀린 값이었다. 장면을 묶고 다시 재니 일곱 종이

         사냥개 97 · 파수꾼 106 · 방패병 112 · 괴수 115
         좀비 147 · 역병 군주 166 · 강철 처형자 211

       가장 낮은 것이 97 이므로 80 으로 내린다. 0 과 97 사이 어디든 '섬광이 없다'는
       잡고 멀쩡한 그림은 안 잡는다. 계측을 고치면 기준도 다시 잡아야 한다 —
       옛 기준은 옛 잡음 위에서 정해진 것이다. */
    if (v.n < 150) bad.push(`${k} 이 피격에 거의 밝아지지 않는다 (${v.n}px)`);
    if (v.avg < 30) bad.push(`${k} 의 섬광이 너무 옅다 (평균 +${v.avg})`);
    if (v.max < 80) bad.push(`${k} 에 밝게 튀는 자리가 없다 (최대 +${v.max})`);
  }

  if (bad.length) { console.error("\n실패:\n  " + bad.join("\n  ")); process.exit(1); }
  console.log("\n통과");
})();

/* 직업 카드의 무기 무대가 실제로 '무기를 보여주는가'.

   카드는 고르기 전에 「무엇을 들고 어떻게 싸우는가」를 보여주려고 만든 것이다.
   그런데 무대가 조용히 죽어도 — 위상 계산이 어긋나 이펙트 구간을 영영 못 만나거나,
   스프라이트 키가 바뀌어 적이 안 나오거나 — 화면은 멀쩡한 바닥 타일을 보여준다.
   눈으로는 '좀 심심하네' 정도로만 보이고 아무도 버그라고 부르지 않는다.

   확인하는 것:
     1. 네 직업이 저마다 제 무기를 그리는가 (성역 고리 · 참격 호 · 단검 · 마력탄)
     2. 한 주기 안에 적이 맞는 순간이 있는가 (타격 이펙트가 뜨는가)
     3. 적과 주인공이 실제로 그려지는가
     4. 무대가 캔버스 상태를 흘리지 않는가 (알파 · 합성 모드)
     5. 견줌 막대가 직업마다 다른가 — 네 개가 같으면 고르는 데 아무 도움이 안 된다

   실행: node tests/class-cards.js */
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

  const res = await pg.evaluate(() => {
    // 무엇이 실제로 불렸는지 센다. 풀에 넣은 것과 화면에 그린 것은 다르다.
    const hit = { ring: 0, arc: 0, edge: 0, disc: 0, fx: 0, mob: 0, hero: 0 };
    const _ring = pxRing, _arc = pxArc, _edge = pxEdge, _disc = pxDisc;
    const _draw = Sprites.draw.bind(Sprites);
    pxRing = function () { hit.ring++; return _ring.apply(null, arguments); };
    pxArc = function () { hit.arc++; return _arc.apply(null, arguments); };
    pxEdge = function () { hit.edge++; return _edge.apply(null, arguments); };
    pxDisc = function () { hit.disc++; return _disc.apply(null, arguments); };
    Sprites.draw = function (key) {
      if (key && key.indexOf('fx_hit_') === 0) hit.fx++;
      else if (key && key.indexOf('hero_') === 0) hit.hero++;
      else if (key) hit.mob++;
      return _draw.apply(null, arguments);
    };

    Game.state = 'title';
    const out = [];
    const N = 240;                       // 한 주기를 촘촘히 훑는다
    for (let i = 0; i < CLASSES.length; i++) {
      for (const k of Object.keys(hit)) hit[k] = 0;
      let lit = 0;                       // 무대에 '바닥보다 밝은' 픽셀이 있는 프레임 수
      for (let s = 0; s < N; s++) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 260, 130);
        drawWeaponStage(CLASSES[i], 10, 10, 236, 104, s * (STAGE_CYCLE / N));
        if (s % 24 === 0) {
          const d = ctx.getImageData(10, 10, 236, 104).data;
          let n = 0;
          for (let j = 0; j < d.length; j += 4)
            if (d[j] * .299 + d[j + 1] * .587 + d[j + 2] * .114 > 90) n++;
          if (n > 60) lit++;
        }
      }
      out.push({
        cls: CLASSES[i].name, weapon: WEAPONS[CLASSES[i].start].name,
        ring: hit.ring, arc: hit.arc, edge: hit.edge, disc: hit.disc,
        fx: hit.fx, mob: hit.mob, hero: hit.hero, lit,
      });
    }

    pxRing = _ring; pxArc = _arc; pxEdge = _edge; pxDisc = _disc; Sprites.draw = _draw;

    // 무대가 캔버스 상태를 흘리는지
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    drawWeaponStage(CLASSES[0], 10, 10, 236, 104, .3);
    const leak = { alpha: ctx.globalAlpha, comp: ctx.globalCompositeOperation };

    if (!classBars) computeClassBars();
    const bars = CLASS_AXES.map(a => ({
      name: a.name, v: classBars.map(b => +b[a.key].toFixed(2)),
    }));
    return { out, leak, bars };
  });

  // 직업마다 '이건 반드시 나와야 한다'는 것이 다르다
  const WANT = { 성기사: 'ring', 전사: 'arc', 추적자: 'edge', 마법사: 'disc' };
  let ok = true;
  for (const r of res.out) {
    const want = WANT[r.cls];
    const drew = r[want] > 0, struck = r.fx > 0, alive = r.mob > 0 && r.hero > 0, seen = r.lit >= 8;
    if (!drew || !struck || !alive || !seen) ok = false;
    console.log(`  ${r.cls.padEnd(4)} ${r.weapon.padEnd(9)}`
      + ` 무기 ${drew ? 'O' : 'X'}(${want} ${r[want]})`
      + ` · 타격 ${struck ? 'O' : 'X'}(${r.fx})`
      + ` · 적/주인공 ${alive ? 'O' : 'X'}(${r.mob}/${r.hero})`
      + ` · 보임 ${r.lit}/10`);
  }

  const leakOk = res.leak.alpha === 1 && res.leak.comp === 'source-over';
  console.log('');
  console.log(`캔버스 상태 안 흘림 ${leakOk ? 'O' : 'X'} (알파 ${res.leak.alpha} · 합성 ${res.leak.comp})`);

  // 막대가 직업마다 갈리는가 — 한 축이라도 네 값이 같으면 그 축은 그림일 뿐이다
  let barsOk = true;
  for (const a of res.bars) {
    const spread = Math.max(...a.v) - Math.min(...a.v);
    if (spread < .3) barsOk = false;
    console.log(`  ${a.name.padEnd(4)} ${a.v.join(' · ')}   폭 ${spread.toFixed(2)}`);
  }
  console.log(`막대가 직업마다 갈림 ${barsOk ? 'O' : 'X'}`);

  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no errors');
  const pass = ok && leakOk && barsOk && !errs.length;
  console.log(pass ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();

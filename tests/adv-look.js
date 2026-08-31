/* 회귀: 전직 계급이 화면에서 실제로 달라 보이는가, 그리고 난전을 가리지 않는가.

   전직 마디가 68개라 68벌을 그릴 수는 없다. 그래서 스프라이트는 그대로 두고
   네 겹(망토·후광·궤도·발밑 문양)을 런타임으로 겹친다. 이 테스트가 지키는 것:

   1) 계급마다 픽셀이 실제로 바뀐다 — 0→1→2→3→4 가 전부 서로 다른 그림이다.
   2) 4차 발밑 문양이 적보다 아래에 깔린다. 이 게임의 피해는 '몇 마리에게
      둘러싸였나'(포위 배수 최대 4.2배)를 눈으로 세는 데 걸려 있어서,
      문양이 적 위에 그려지면 그 읽기가 통째로 막힌다.
   3) 겹을 네 장 다 두른 상태로도 프레임이 무너지지 않는다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);

  // 갈래 68개가 전부 결을 갖고 있는가, 그리고 한 화면에서 견주는 것들이 서로 다른가
  const motif = await pg.evaluate(() => {
    const miss = ADVANCES.filter(a => !ADV_MOTIF[a.key]).map(a => a.key);
    /* 실제로 나란히 놓고 고르는 묶음은 '부모 + 차수' 다.
       1차와 4차는 부모가 같아도(직업) 서로 다른 겹을 그리므로 겹쳐도 된다. */
    const by = {}, clash = [];
    for (const a of ADVANCES) (by[a.from + '/' + a.tier] ||= []).push(a);
    for (const [g, kids] of Object.entries(by)) {
      const seen = {};
      for (const k of kids) {
        const m = ADV_MOTIF[k.key];
        if (seen[m]) clash.push(`${g}: ${seen[m]} 와 ${k.key} 가 둘 다 ${m}`);
        seen[m] = k.key;
      }
    }
    return { n: ADVANCES.length, miss, clash };
  });
  console.log(JSON.stringify(motif));

  const out = await pg.evaluate(() => {
    selectedClass = CLASSES.findIndex(c => c.key === 'mage');
    Game.reset(); Game.state = 'playing';
    Game.updateSpawning = () => {};
    inputVector = () => ({ x: 0, y: 0 });
    player.weapons.length = 0;
    drawStanceWorld = () => {};                 // 자세 표시가 계급 표시를 덮으면 잰 값이 흐려진다
    for (const e of enemies) { e.active = false; e.dying = false; }

    /* 실제 놀이에서 열리는 사슬만 쓴다 — 1~3차는 앞 마디를 부모로 삼고,
       4차만 직업을 부모로 삼는다(3차 최종형이 32종이라 직업당 3종으로 묶여 있다). */
    const chain = []; let from = 'mage';
    for (let t = 1; t <= 4; t++) {
      const c = ADVANCES.filter(a => a.tier === t && a.from === (t === 4 ? 'mage' : from));
      if (!c.length) return { err: `${t}차에서 사슬이 끊겼다 (from=${from})` };
      chain.push(c[0]); from = c[0].key;
    }

    /* 상자는 주인공을 다 담아야 한다. 주인공을 두 배로 키웠더니(HERO_GROW)
       2차 계급의 후광이 sy-34 에서 sy-88 로 올라가 상자(sy±46) 밖으로 나갔고,
       '형제 둘이 똑같이 그려진다'는 오탐이 났다. 재려는 것은 겹의 차이지
       상자 크기가 아니다.

       그래서 화면 중심이 아니라 몸이 커지는 축(발밑 = sy + HERO_FOOT)을 기준으로
       예전 반경 46 을 그대로 HERO_GROW 배 늘린다. 앞으로 주인공 크기를 또 바꿔도
       상자가 따라온다. */
    const cx = 640, cy = 380, y0 = cy + HERO_FOOT, R = 46 * HERO_GROW;
    const top = Math.round(y0 + (cy - 46 - y0) * HERO_GROW);
    const bot = Math.round(y0 + (cy + 46 - y0) * HERO_GROW);
    const box = { x: cx - R, y: top, w: R * 2, h: bot - top };
    const shot = () => {
      Game.time = 3.0;                          // 흔들림·회전을 같은 위상에 세운다
      drawScene();
      const d = ctx.getImageData(box.x, box.y, box.w, box.h).data;
      let sum = 0, on = 0;
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i] * 65536 + d[i + 1] * 256 + d[i + 2];
        sum = (sum * 31 + v) >>> 0;
        if (d[i] + d[i + 1] + d[i + 2] > 90) on++;
      }
      return { h: sum, on };
    };

    const seen = [];
    for (let t = 0; t <= 4; t++) {
      player.advance.length = 0;
      for (let i = 0; i < t; i++) player.advance.push(chain[i]);
      seen.push(shot());
    }

    // 4차를 두른 채로 적 마흔에 둘러싸인다 — 문양이 적을 덮는지 본다
    const clear = seen[4].on;
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TAU * 3.7, r = 34 + (i % 6) * 10;
      const e = Game.spawnEnemy('slime', player.x + Math.cos(a) * r, player.y + Math.sin(a) * r);
      if (e) { e.spd = 0; e.hp = e.maxHp = 1e9; }
    }
    /* 적이 몇 칸이나 보이는지. 예전에는 '밝은 초록'을 셌는데, 슬라임 그림을
       어두운 늪색 손그림으로 갈아 끼우자 한 칸도 안 잡혀서 테스트가 깨졌다 —
       계측기가 그림 색에 묶여 있었다.
       색에 기대지 말고 '적을 지웠을 때 달라지는 칸'을 센다. 어떤 그림으로
       바뀌어도 성립하고, 재려던 것(문양이 적을 가리는가)에 정확히 답한다. */
    drawScene();
    const withMobs = ctx.getImageData(box.x, box.y, box.w, box.h).data;
    const keep = [];
    for (const e of enemies) if (e.active) { keep.push(e); e.active = false; }
    drawScene();
    const without = ctx.getImageData(box.x, box.y, box.w, box.h).data;
    for (const e of keep) e.active = true;
    let green = 0;
    for (let i = 0; i < withMobs.length; i += 4)
      if (Math.abs(withMobs[i] - without[i]) + Math.abs(withMobs[i + 1] - without[i + 1])
        + Math.abs(withMobs[i + 2] - without[i + 2]) > 24) green++;

    /* 계급뿐 아니라 갈래도 화면에서 달라야 한다. 같은 부모의 형제 둘을
       같은 자리에 세워 놓고 픽셀을 견준다 — 색만 같아도 결이 다르면 그림이 달라야 한다.

       적은 반드시 치워야 한다. 앞 단계에서 마흔 마리를 불러 뒀는데, 슬라임 그림이
       넓어지자 주인공 위를 덮어서 형제 둘이 '똑같이 그려진다'고 나왔다. 재려는 것은
       겹의 차이지 몹에 가려지는지가 아니다. */
    const hidden = [];
    for (const e of enemies) if (e.active) { hidden.push(e); e.active = false; }
    const sib = [];
    for (const t of [1, 2, 3]) {
      const par = t === 1 ? 'mage' : chain[t - 2].key;
      const kids = ADVANCES.filter(a => a.tier === t && a.from === par);
      const shots = kids.map(k => {
        player.advance.length = 0;
        for (let i = 0; i < t - 1; i++) player.advance.push(chain[i]);
        player.advance.push({ key: k.key, color: '#ffd36e' });   // 색을 묶어 결만 남긴다
        return shot();
      });
      sib.push({ t, same: shots[0].h === shots[1].h, keys: kids.map(k => k.key) });
    }

    for (const e of hidden) e.active = true;

    player.advance.length = 0;
    for (let i = 0; i < 4; i++) player.advance.push(chain[i]);
    const t0 = performance.now();
    for (let f = 0; f < 60; f++) drawScene();
    const ms = (performance.now() - t0) / 60;

    return { hashes: seen.map(s => s.h), lit: seen.map(s => s.on), clear, green, sib,
             ms: +ms.toFixed(2), total: box.w * box.h };
  });

  console.log(JSON.stringify(out));

  /* 전직 화면의 미리보기. 카드 석 장이 같은 아이콘을 달고 있으면 고르는 데
     아무 도움이 안 된다 — 갈래마다 다른 그림이 나와야 하고, 미리보기를 그리려고
     갈아 끼운 겹 목록이 실제 전직 상태를 건드리면 안 된다. */
  const prev = await pg.evaluate(() => {
    selectedClass = CLASSES.findIndex(c => c.key === 'mage');
    Game.reset(); Game.state = 'playing';
    let from = 'mage';
    for (let t = 1; t <= 2; t++) {
      const c = ADVANCES.filter(a => a.tier === t && a.from === from);
      player.advance.push(c[0]); from = c[0].key;
    }
    const before = player.advance.length;
    Game.choices = ADVANCES.filter(a => a.tier === 3 && a.from === from);
    Game.state = 'advance';
    Game.time = 3.0;
    // 마우스를 화면 밖으로 뺀다. 한 장만 강조되면 그 밝기 차이로 통과해 버려서
    // 미리보기가 실제로 다른지를 못 잰다.
    mouse.x = -999; mouse.y = -999; mouse.clicked = false;
    drawAdvance();

    // 카드 좌표는 drawAdvance 와 같은 식으로 잡는다
    const n = Game.choices.length, cw = 400, gap = 30;
    const x0 = (W - (n * cw + (n - 1) * gap)) / 2, yTop = 150;
    const hash = i => {
      const d = ctx.getImageData(x0 + i * (cw + gap) + 34, yTop + 14, 332, 172).data;
      let h = 0, on = 0;
      for (let j = 0; j < d.length; j += 4) {
        h = (h * 31 + d[j] * 65536 + d[j + 1] * 256 + d[j + 2]) >>> 0;
        if (d[j] + d[j + 1] + d[j + 2] > 150) on++;
      }
      return { h, on };
    };
    const cards = Game.choices.map((_, i) => hash(i));
    return { n, cards, leak: advView !== null, kept: player.advance.length === before };
  });
  console.log(JSON.stringify(prev));
  const fail = [];
  if (prev.n < 2) fail.push(`전직 카드가 ${prev.n} 장뿐이라 미리보기를 견줄 수 없다`);
  if (prev.leak) fail.push('미리보기용 겹 목록(advView)이 화면을 그린 뒤에도 남아 있다');
  if (!prev.kept) fail.push('미리보기가 실제 전직 상태를 건드렸다');
  if (new Set(prev.cards.map(c => c.h)).size !== prev.n)
    fail.push('전직 카드들의 미리보기가 서로 똑같이 그려진다');
  for (const c of prev.cards)
    if (c.on < 400) fail.push(`미리보기가 거의 비어 있다 (밝은 칸 ${c.on}개)`);
  if (motif.miss.length) fail.push(`결이 없는 마디: ${motif.miss.join(', ')}`);
  for (const c of motif.clash) fail.push(`같은 화면에서 고르는 둘이 같은 결이다 — ${c}`);
  if (out.err) fail.push(out.err);
  else {
    const uniq = new Set(out.hashes);
    if (uniq.size !== 5) fail.push(`계급 다섯 단계 중 ${uniq.size} 가지만 서로 달랐다 — 겹이 안 보인다`);
    for (let t = 1; t <= 4; t++)
      if (out.lit[t] <= out.lit[t - 1])
        fail.push(`${t}차가 ${t - 1}차보다 밝은 칸이 늘지 않았다 (${out.lit[t - 1]} → ${out.lit[t]})`);
    for (const s of out.sib || [])
      if (s.same) fail.push(`${s.t}차 형제 ${s.keys.join(' / ')} 가 화면에서 똑같이 그려진다`);
    if (out.green < out.total * .08)
      fail.push(`적에 둘러싸였는데 적이 보이는 칸이 ${out.green}개뿐이다 — 문양이 난전을 덮고 있다`);
    if (out.ms > 22) fail.push(`네 겹을 두르면 한 프레임이 ${out.ms}ms 다`);
  }
  if (errs.length) fail.push('페이지 오류: ' + errs[0]);
  console.log(fail.length ? 'FAIL\n' + fail.join('\n') : 'PASS');
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();

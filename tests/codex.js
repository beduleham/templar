/* 회귀: 성전 기록이 남고, 68칸이 다 화면 안에 들어오는가.

   초상 51장을 이미 그려 놓고도 한 판에 최대 네 번, 그것도 한 직업일 때만 보이고
   사라지고 있었다(hook-spec C2). 기록은 그 그림을 모을 것으로 바꾼다.

   조용히 깨질 수 있는 자리:
     · 전직의 from 이 어긋나면 그 갈래가 계보 나무에서 통째로 사라진다 — 68칸이
       69칸도 67칸도 아니고 정확히 68이어야 한다
     · localStorage 가 막힌 환경(사생활 모드)에서 저장이 던지면 판이 멈춘다
     · 좁은 화면에서 나무가 화면 밖으로 나가면 못 보는 칸이 생긴다
     · 「기록 지우기」가 코덱스를 안 지우면 지웠다는 말이 거짓이 된다

   재는 것:
     1. ADVANCES 68개가 계보 나무에 빠짐없이 한 번씩 들어간다 (2·4·8·3 x 4직업)
     2. 전직을 얻으면 기록되고, 판을 다시 시작해도 남는다
     3. 두 번째 도달은 횟수만 늘고 최초 시각은 안 바뀐다
     4. 칸이 전부 화면 안에 있고 **이름이 사람 눈에 9.5px 이상으로 보인다**
        (논리 px 가 아니라 css px — 가로 폰은 논리 폭 1410 을 844 로 줄여 그린다)
     5. C 로 열리고 ESC 로 돌아온다. 판 안에서는 안 열린다
     6. 기록 지우기가 코덱스도 지운다
     7. localStorage 가 막혀도 게임이 돈다
     8. 개전 무기(수평 보상) — 완주해야 열리고, 더함이 아니라 바꿈이고,
        고름은 직업마다 따로 남는다
     9. 다음 판 길잡이가 거짓말을 안 한다 — 따라가면 실제로 열리고, 계속
        따라가면 17칸이 다 찬다 (막다른 길잡이는 거짓말이다)

   실행: node tests/codex.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const fail = [], out = [];

  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  // 1. 계보 나무가 68개를 빠짐없이 담는다
  const tree = await pg.evaluate(() => {
    const seen = new Set(), shape = {};
    for (const c of CLASSES) {
      const rows = codexTree(c.key);
      shape[c.key] = rows.map(r => r.length);
      for (const r of rows) for (const a of r) seen.add(a.key);
    }
    return { shape, n: seen.size, total: ADVANCES.length,
      missing: ADVANCES.filter(a => !seen.has(a.key)).map(a => a.key) };
  });
  out.push(`계보   ${Object.values(tree.shape).map(v => v.join('·')).join(' / ')}  → ${tree.n}/${tree.total}`);
  if (tree.n !== tree.total) fail.push(`계보 나무에 ${tree.n}개만 들어간다 — ${tree.total} 이어야 한다. 빠진 것: ${tree.missing.join(', ')}`);
  for (const [k, v] of Object.entries(tree.shape))
    if (v.join() !== '2,4,8,3') fail.push(`${k} 계보가 ${v.join('·')} — 2·4·8·3 이어야 한다`);

  // 2~3. 기록되고 남는다
  const rec = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    localStorage.removeItem('ts_codex'); Meta.codex = {};
    selectedClass = 0; Game.reset(); await wait(60);
    Game.time = 190;
    const a = ADVANCES.find(x => x.tier === 1 && x.from === 'paladin');
    applyAdvance(a);
    const first = JSON.parse(JSON.stringify(Meta.codex[a.key]));
    Game.time = 400;
    applyAdvance(a);                                  // 두 번째 도달
    const second = JSON.parse(JSON.stringify(Meta.codex[a.key]));
    Game.reset(); await wait(60);
    Meta.load();                                       // 저장소에서 다시 읽는다
    return { key: a.key, first, second, afterReload: Meta.codex[a.key], found: Meta.found() };
  });
  out.push(`기록   ${rec.key} — 최초 ${rec.first && rec.first.t}초 · 2회차 뒤 n=${rec.second && rec.second.n} t=${rec.second && rec.second.t} · 다시 읽어 ${rec.found}개`);
  if (!rec.first) fail.push('전직을 얻어도 기록되지 않는다');
  else {
    if (rec.first.t !== 190) fail.push(`최초 시각이 ${rec.first.t} — 190 이어야 한다`);
    if (rec.second.n !== 2) fail.push(`두 번 도달했는데 횟수가 ${rec.second.n}`);
    if (rec.second.t !== 190) fail.push(`두 번째 도달이 최초 시각을 ${rec.second.t} 로 덮었다`);
    if (!rec.afterReload) fail.push('판을 다시 시작하고 저장소에서 읽으면 기록이 사라진다');
  }

  // 5. 여닫기
  const nav = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    Game.state = 'intro'; Game.onKey('c'); o.fromIntro = Game.state;
    Game.onKey('escape'); o.back = Game.state;
    Game.state = 'altar'; Game.onKey('c'); o.fromAltar = Game.state;
    Game.onKey('2'); o.cls = Game.codexCls;
    Game.onKey('arrowright'); o.cls2 = Game.codexCls;
    Game.onKey('tab'); o.backToAltar = Game.state;
    selectedClass = 0; Game.reset(); await wait(60);
    Game.state = 'playing'; Game.onKey('c'); o.inRun = Game.state;
    Game.state = 'intro';
    return o;
  });
  out.push(`여닫기 인트로→${nav.fromIntro}→${nav.back} · 제단→${nav.fromAltar}→${nav.backToAltar} · 판 안 ${nav.inRun}`);
  if (nav.fromIntro !== 'codex') fail.push('첫 화면에서 C 로 안 열린다');
  if (nav.back !== 'intro') fail.push('ESC 로 첫 화면으로 안 돌아온다');
  if (nav.fromAltar !== 'codex' || nav.backToAltar !== 'altar') fail.push('제단에서 열고 닫으면 제단으로 안 돌아온다');
  if (nav.cls !== 1 || nav.cls2 !== 2) fail.push(`직업 전환이 안 된다 (${nav.cls} → ${nav.cls2})`);
  if (nav.inRun === 'codex') fail.push('판 안에서 기록이 열린다 — 판이 멈춘다');

  // 6. 기록 지우기
  const wiped = await pg.evaluate(() => {
    Meta.codex = { guardian: { n: 1, t: 10, d: 'x' } }; Meta.save();
    Game.wipeAsk(); Game.wipeAsk();                    // 물어보고, 확인
    return { mem: Meta.found(), store: localStorage.getItem('ts_codex') };
  });
  if (wiped.mem !== 0 || (wiped.store && wiped.store !== '{}'))
    fail.push(`기록 지우기가 코덱스를 안 지운다 (남은 ${wiped.mem}개, 저장소 ${wiped.store})`);

  // 7. 저장이 막혀도 돈다
  const blocked = await pg.evaluate(() => {
    const S = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceeded'); };
    let ok = true;
    try { Meta.record(ADVANCES[0]); } catch (e) { ok = false; }
    Storage.prototype.setItem = S;
    return ok;
  });
  if (!blocked) fail.push('localStorage 가 막히면 기록이 예외를 던진다 — 사생활 모드에서 판이 멈춘다');

  fail.push(...errs);
  await pg.close();

  /* 4. 칸이 화면 안에 있고, **이름이 글자로 읽히는가**

     사람이 「기록 화면이 별로다. 가독성이 떨어진다」고 했다. 재 보니 세로 폰에서
     3차 여덟 칸을 가로에 다 넣느라 배율이 0.58 이 되고 이름이 6px 이 됐다 —
     글자가 아니라 무늬였다. 그래서 「화면 안에 있다」만으로는 모자란다.
     **사람 눈에 몇 px 로 보이는가**를 잰다(논리 px 가 아니라 css px).

     좁으면 차수 하나씩 보여주므로 한 판의 칸 수는 그 차수의 수다 — 넷을 돌면
     17이 다 나와야 한다. */
  /* 5. 길잡이가 거짓말을 안 하는가

     「동기부여가 되지 않는다」에 대한 답이 이 줄이다 — 68칸을 늘어놓는 대신
     **다음 한 판에 무엇이 열리는지**를 말한다. 그러니 그 말이 맞아야 한다:
     따라가면 실제로 그만큼 열리고, 계속 따라가면 언젠가 다 채워져야 한다.
     막다른 곳이 있으면 길잡이가 아니라 거짓말이다. */
  {
    const p3 = await b.newPage({ viewport: { width: 1280, height: 720 } });
    const e3 = []; p3.on('pageerror', e => e3.push('PAGEERROR(길잡이): ' + e.message));
    await p3.goto('file:///home/user/templar/game/index.html');
    await p3.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
    const g = await p3.evaluate(() => {
      const o = {};
      Meta.codex = {};
      const first = codexNext('paladin');
      o.first = { gain: first.gain, path: first.path.map(a => a.name), t4: first.t4 && first.t4.name };
      // 길잡이만 따라간다 — 몇 판이면 17칸이 다 차는가
      o.runs = {};
      for (const cls of ['paladin', 'warrior', 'rogue', 'mage']) {
        Meta.codex = {};
        const total = codexTree(cls).reduce((n, r) => n + r.length, 0);
        let runs = 0, stuck = false;
        while (Object.keys(Meta.codex).length < total && runs < 40) {
          const nx = codexNext(cls);
          const before = Object.keys(Meta.codex).length;
          for (const a of nx.path) Meta.codex[a.key] = { n: 1, t: 1, d: "x" };
          if (nx.t4) Meta.codex[nx.t4.key] = { n: 1, t: 1, d: "x" };
          runs++;
          if (Object.keys(Meta.codex).length === before) { stuck = true; break; }
        }
        o.runs[cls] = { runs, got: Object.keys(Meta.codex).length, total, stuck };
      }
      // 다 걸으면 길잡이가 「다 걸었다」라고 말한다
      Meta.codex = {};
      for (const a of codexTree('paladin').flat()) Meta.codex[a.key] = { n: 1, t: 1, d: "x" };
      const donE = codexNext('paladin');
      o.done = donE.gain === 0 && !donE.t4;
      return o;
    });
    out.push(`길잡이 빈 기록에서 ${g.first.gain}칸 — ${g.first.path.join(' → ')} · ${g.first.t4}`);
    out.push('      ' + Object.entries(g.runs).map(([c, v]) => `${c} ${v.runs}판에 ${v.got}/${v.total}`).join(' · '));
    if (g.first.gain !== 3) fail.push(`빈 기록인데 길잡이가 ${g.first.gain}칸만 연다 — 한 판은 1·2·3차 한 줄이라 3이어야 한다`);
    if (!g.first.t4) fail.push('길잡이가 4차를 안 짚는다 — 한 판에 4차도 하나 걷는다');
    for (const [c, v] of Object.entries(g.runs)) {
      if (v.stuck) fail.push(`${c}: 길잡이를 따라가다 막혔다 (${v.got}/${v.total}) — 막다른 길잡이는 거짓말이다`);
      if (v.got !== v.total) fail.push(`${c}: 길잡이만 따라가면 ${v.got}/${v.total} 에서 멈춘다`);
      if (v.runs > 10) fail.push(`${c}: 다 채우는 데 ${v.runs}판 — 길잡이가 먼 길로 돌린다`);
    }
    if (!g.done) fail.push('다 걸었는데도 길잡이가 갈 곳을 말한다');
    fail.push(...e3);
    await p3.close();
  }

  /* 6. 수평 보상 — 개전 무기

     기록에 능력치를 붙이면 안 모은 사람이 불리해진다(README 의 약속). 대신 **바꿔
     준다**: 한 직업의 17칸을 다 걸으면 그 직업의 개전 무기를 다른 직업도 들고 시작한다.
     더 얹는 게 아니라 자기 것을 내주고 바꾸는 것이라 천장이 안 올라간다.

     이 성질이 조용히 깨질 수 있는 자리가 셋이다.
       · 「바꿈」이 「더함」이 되면(무기를 둘 들고 시작하면) 수평이 아니라 수직이 된다
       · 안 연 무기를 저장소에 손으로 써 넣으면 잠금이 뚫린다
       · 고름이 직업마다 따로 안 남으면 네 장이 전부 같은 무기를 든 화면이 된다 */
  {
    const p4 = await b.newPage({ viewport: { width: 1280, height: 720 } });
    const e4 = []; p4.on('pageerror', e => e4.push('PAGEERROR(개전): ' + e.message));
    await p4.goto('file:///home/user/templar/game/index.html');
    await p4.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
    const w = await p4.evaluate(() => {
      const o = {};
      Meta.codex = {}; Meta.opens = {};
      o.lockedN = CLASSES.map(c => openChoices(c).length);
      o.lockedStart = CLASSES.every(c => openStart(c) === c.start);
      for (const a of codexTree('paladin').flat()) Meta.codex[a.key] = { n: 1, t: 1, d: "x" };
      o.doneP = Meta.classDone('paladin');
      o.doneW = Meta.classDone('warrior');
      o.afterN = CLASSES.map(c => openChoices(c).length);
      // 바꿈이지 더함이 아니다
      Meta.opens = { mage: 'aura' };
      selectedClass = 3; Game.reset();
      o.mage = player.weapons.map(x => x.key);
      // 안 고른 직업은 그대로다
      selectedClass = 1; Game.reset();
      o.warrior = player.weapons.map(x => x.key);
      // 안 연 무기는 무시한다
      Meta.opens = { mage: 'scythe' };
      selectedClass = 3; Game.reset();
      o.bogus = player.weapons.map(x => x.key);
      // 기록을 지우면 고름도 지워진다
      o.starts = CLASSES.map(c => c.start);
      return o;
    });
    out.push(`개전   잠김 ${w.lockedN.join('/')}칸 → 성기사 완주 뒤 ${w.afterN.join('/')}칸 · 마법사 개전 ${w.mage.join(',')}`);
    if (w.lockedN.some(n => n !== 1)) fail.push(`아무것도 안 걸었는데 고를 무기가 ${w.lockedN.join('/')} 개다`);
    if (!w.lockedStart) fail.push('안 열었는데 개전 무기가 제 직업 것이 아니다');
    if (!w.doneP || w.doneW) fail.push(`완주 판정이 틀렸다 (성기사 ${w.doneP} · 전사 ${w.doneW})`);
    if (w.afterN.join() !== '1,2,2,2')
      fail.push(`성기사 완주 뒤 고를 수 ${w.afterN.join('/')} — 자기 직업 1, 나머지 2 여야 한다`);
    if (w.mage.length !== 1 || w.mage[0] !== 'aura')
      fail.push(`마법사가 ${w.mage.join(',')} 로 시작한다 — 성역 하나(바꿈)여야 한다. 둘이면 수평이 아니라 수직이다`);
    if (w.warrior.length !== 1 || w.warrior[0] !== w.starts[1])
      fail.push(`안 고른 직업(전사)의 개전이 ${w.warrior.join(',')} 로 바뀌었다 — 고름은 직업마다 따로다`);
    if (w.bogus.length !== 1 || w.bogus[0] !== w.starts[3])
      fail.push(`안 연 무기(${w.bogus.join(',')})로 시작된다 — 저장소를 고치면 잠금이 뚫린다`);
    /* 화살표는 카드 **안**에 있고 카드는 아무 데나 누르면 판이 시작된다.
       누른 것을 안 먹어 치우면 무기를 바꾸는 순간 판이 시작된다 — 실제로 눌러 본다. */
    await p4.evaluate(() => {
      Meta.codex = {}; Meta.opens = {};
      for (const a of codexTree('paladin').flat()) Meta.codex[a.key] = { n: 1, t: 1, d: "x" };
      Game.state = 'title'; selectedClass = 3;
    });
    await new Promise(r => setTimeout(r, 250));
    const pt = await p4.evaluate(() => {
      const cols = W >= 1180 ? 4 : 2, gap = 16;
      const cw = Math.min(268, Math.floor((W - (cols + 1) * gap) / cols));
      const rows = Math.ceil(CLASSES.length / cols), tall = rows === 1;
      const ch = tall ? 406 : 392, total = cols * cw + (cols - 1) * gap;
      const x0 = (W - total) / 2, y0 = tall ? 182 : 134;
      const stageH = tall ? 104 : 92;
      return { x: x0 + 3 * (cw + gap) + cw - 16 - 9, y: y0 + 62 + stageH + 16 - 6, W, H };
    });
    const bx = await (await p4.$('#game')).boundingBox();
    const sx = bx.x + pt.x * (bx.width / pt.W), sy = bx.y + pt.y * (bx.height / pt.H);
    await p4.mouse.move(sx, sy);
    await new Promise(r => setTimeout(r, 140));
    await p4.mouse.click(sx, sy);
    await new Promise(r => setTimeout(r, 250));
    const click = await p4.evaluate(() => ({ state: Game.state, open: Meta.opens.mage }));
    out.push(`       화살표를 누르면 ${click.open || "그대로"} · 화면 ${click.state}`);
    if (click.open !== 'aura') fail.push(`화살표를 눌러도 개전 무기가 안 바뀐다 (${click.open})`);
    if (click.state !== 'title')
      fail.push('무기를 바꾸는 순간 판이 시작된다 — 화살표가 카드 안에 있는데 누른 것을 안 먹었다');
    fail.push(...e4);
    await p4.close();
  }

  const NAME_MIN = 9.5;
  for (const [tag, w, h] of [['가로', 1280, 720], ['세로', 420, 860], ['가로 폰', 844, 390]]) {
    const p2 = await b.newPage({ viewport: { width: w, height: h } });
    const e2 = []; p2.on('pageerror', e => e2.push(`PAGEERROR(${tag}): ` + e.message));
    await p2.goto('file:///home/user/templar/game/index.html');
    await p2.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
    const r = await p2.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      Meta.codex = {}; Game.state = 'codex'; Game.codexCls = 0;
      const names = new Set(codexTree('paladin').flat().map(a => a.name));
      const seen = new Set();
      let outside = 0, cells = 0, minName = 1e9, frames = 0;
      const cv = document.getElementById('game');
      const dpr = cv.width / parseFloat(cv.style.width);
      const P = window.panel, F = ctx.fillText.bind(ctx);
      window.panel = function (x, y, ww, hh, ...rest) {
        const m = ctx.getTransform();                  // 나무가 줄어든 만큼을 반영한다
        const rx = m.a * x + m.e, ry = m.d * y + m.f;
        if (rx < -1 || ry < -1 || rx + ww * m.a > cv.width + 1 || ry + hh * m.d > cv.height + 1) outside++;
        cells++;
        return P.call(this, x, y, ww, hh, ...rest);
      };
      ctx.fillText = function (t, ...rest) {
        if (names.has(t)) {
          seen.add(t);
          const px = parseFloat((ctx.font.match(/(\d+(?:\.\d+)?)px/) || [0, 0])[1]);
          const m = ctx.getTransform();
          minName = Math.min(minName, px * m.d / dpr);   // 사람 눈에 보이는 css px
        }
        return F(t, ...rest);
      };
      // 차수를 넷 다 돌아야 좁은 화면에서도 17이 다 나온다
      for (let t = 0; t < 4; t++) { Game.codexTier = t; frames++; await wait(90); }
      window.panel = P; ctx.fillText = F;
      return { outside, cells: Math.round(cells / Math.max(1, frames * 3)), covered: seen.size,
               minName: +minName.toFixed(1), paged: seen.size > 0 };
    });
    out.push(`${tag} ${w}x${h}  칸 ${r.covered}/17 · 화면 밖 ${r.outside} · 가장 작은 이름 ${r.minName}px`);
    if (r.outside) fail.push(`${tag}: 칸 ${r.outside}개가 화면 밖이다 — 못 보는 갈래가 생긴다`);
    if (r.covered !== 17) fail.push(`${tag}: 차수를 다 돌아도 ${r.covered}칸만 나온다 — 17이어야 한다`);
    if (!(r.minName >= NAME_MIN))
      fail.push(`${tag}: 이름이 ${r.minName}px 로 보인다 — ${NAME_MIN}px 아래면 글자가 아니라 무늬다`);
    fail.push(...e2);
    await p2.close();
  }

  await b.close();
  console.log(out.join('\n'));
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  process.exit(fail.length ? 1 : 0);
})();

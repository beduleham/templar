/* 회귀: 메뉴 UI 손그림이 제 모습으로 붙어 있는가.

   이 묶음은 네 번 어긋났고 넷 다 눈으로만 잡혔다(§107).
     초록 판     — 로고 시트만 배경이 짙은 초록이라 마젠타·순초록 규칙에 안 걸렸다.
                   그대로 실려 제목 뒤에 초록 사각형이 떴다.
     초록 테     — 키를 뺀 자리에 초록기가 남아 문장 둘레에 테를 둘렀다.
     늘어난 장식 — 가름줄은 장식이 가운데 있는데 삼등분해 늘려 마름모가 뭉갰다.
     찌그러진 글자 — 로고를 칸 크기로 그냥 늘리면 비율이 틀어진다.

   재는 것:
     1. 부품 열셋이 다 아틀라스에 있다
     2. 부품 안에 초록이 남아 있지 않다 (알파 있는 픽셀 중 0.2% 미만)
     3. 첫 화면에도 초록이 없다 — 화면 픽셀의 0.05% 미만
     4. 로고는 비율을 지킨다 — 원본 2.06 과 3% 안
     5. 가름줄은 삼등분으로 그리지 않는다
     6. 직업 선택에서 문장 넷이 그려지고, 고른 카드에만 금 액자가 둘린다

   실행: node tests/ui-parts.js */
const { chromium } = require('playwright');

const PARTS = ['ui_btn', 'ui_btn_hover', 'ui_btn_sel', 'ui_btn_short', 'ui_panel', 'ui_inset',
  'ui_divider', 'ui_crest_paladin', 'ui_crest_warrior', 'ui_crest_rogue', 'ui_crest_mage',
  'ui_corner', 'ui_logo',
  'ui_bar', 'ui_slot', 'ui_skillframe', 'ui_rail',                // §115 — 게임 안 HUD 틀
  'ui_ribbon', 'ui_ribbon_faith', 'ui_ribbon_blood', 'ui_ribbon_thin',
  'ui_mapframe', 'ui_clock', 'ui_pointer', 'ui_bossbar',                // §117 — 지도와 상단
  'ui_card', 'ui_card_awaken', 'ui_cardhead', 'ui_portrait',            // §118 — 카드   // §116 — 배너 리본
  'ui_codex_cell', 'ui_codex_cell_locked', 'ui_codex_tab', 'ui_codex_mark',    // §120 — 도감
  'ui_chip', 'ui_scale', 'ui_pip_on', 'ui_pip_off',                           // §121 — HUD 작은 칩
  'ui_sk_wave', 'ui_sk_bolt', 'ui_sk_slash',                                  // §122 — 스킬 형태 여섯
  'ui_sk_burst', 'ui_sk_blink', 'ui_sk_dash',
  'ui_up_vigor', 'ui_up_edge', 'ui_up_swift', 'ui_up_avarice',                // §124 — 제단 강화 일곱
  'ui_up_zeal', 'ui_up_rebirth', 'ui_up_orb',
  'drop_meat', 'drop_magnet', 'drop_sigil', 'drop_bomb',                      // §125 — 바닥 획득물 여덟
  'drop_sand', 'drop_fury', 'drop_ward', 'drop_soul'];
/* 리본은 알림이 떠 있을 때만 그려진다. 채널을 하나씩 켜고 한 프레임씩 그려 넷이 다
   불리는지 본다. 판 이름의 ui_ 접두를 빼먹어 여섯 채널이 조용히 옛 칩으로 떨어진 적이
   있다(§116) — 그림이 없을 때와 같은 길이라 오류가 없다. 이 자가 그걸 잡는다. */
const RIBBON_ON = [
  ['ui_ribbon_blood', 'Game.sinFlash = 1.5'],
  ['ui_ribbon', 'Game.comboFlash = 2.4; player.combos.add(COMBOS[0].key)'],
  ['ui_ribbon_thin', 'Game.lmFlash = 2.5; Game.lmFlashText = "시험"'],
  ['ui_ribbon_faith', 'Game.faithBanner = 3; Game.faithBannerStep = 1'],
];
/* HUD 틀은 **속이 뚫려야** 한다 — 게임이 그 안에 체력·아이콘을 그린다. 초록 키가
   안쪽 창을 남기면 체력이 틀 뒤로 숨는다. 가운데 40% 의 알파를 재서 잡는다. */
const HOLLOW = ['ui_bar', 'ui_slot', 'ui_skillframe', 'ui_rail', 'ui_mapframe',
                'ui_card', 'ui_card_awaken', 'ui_portrait',
                'ui_codex_cell', 'ui_codex_cell_locked'];                 // §120 — 초상이 속으로 보여야 한다
/* 화살촉과 보스 체력바 틀은 가운데 40% 에 팔·테가 걸려 뚫림 검사에 못 넣는다(29%) — 판에서
   그려지는지만 본다. 둘은 보스나 화면 밖 표적이 있어야 나오므로 파수꾼 하나를 멀리 세운다. */
const ON_TARGET = ['ui_pointer', 'ui_bossbar'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const fail = [], out = [];

  // 1~2. 부품이 다 있고, 그 안에 초록이 안 남았다
  const r = await pg.evaluate((PARTS) => {
    const miss = PARTS.filter(k => !Sprites.frames[k]);
    if (miss.length) return { miss };
    const cv = document.createElement('canvas');
    const cx = cv.getContext('2d', { willReadFrequently: true });
    let ink = 0, green = 0, worst = { k: '', pct: 0 };
    const size = {};
    for (const k of PARTS) {
      const f = Sprites.frames[k];
      size[k] = [f.w, f.h];
      cv.width = f.w; cv.height = f.h;
      cx.clearRect(0, 0, f.w, f.h);
      cx.drawImage(Sprites.atlas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      const d = cx.getImageData(0, 0, f.w, f.h).data;
      let i0 = 0, g0 = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 40) continue;
        i0++;
        if (d[i + 1] - Math.max(d[i], d[i + 2]) > 60) g0++;
      }
      ink += i0; green += g0;
      const pct = i0 ? g0 / i0 * 100 : 0;
      if (pct > worst.pct) worst = { k, pct };
    }
    return { size, greenPct: green / Math.max(1, ink) * 100, worst };
  }, PARTS);
  if (r.miss) { fail.push(`아틀라스에 없는 부품: ${r.miss.join(', ')}`); }
  else {
    out.push(`부품   ${PARTS.length}개 · 남은 초록 ${r.greenPct.toFixed(3)}% (최악 ${r.worst.k} ${r.worst.pct.toFixed(2)}%)`);
    if (r.greenPct > .2) fail.push(`부품에 초록이 ${r.greenPct.toFixed(2)}% 남았다 — 배경이 안 빠졌다`);
    if (r.worst.pct > 1.5) fail.push(`${r.worst.k} 에 초록이 ${r.worst.pct.toFixed(2)}% 남았다`);
    // 4. 로고 비율
    const [lw, lh] = r.size.ui_logo;
    const ratio = lw / lh;
    out.push(`로고   ${lw}x${lh} · 가로세로 ${ratio.toFixed(3)}`);
    if (Math.abs(ratio / 2.061 - 1) > .03) fail.push(`로고 비율이 ${ratio.toFixed(3)} — 원본 2.061 에서 벗어났다`);
  }

  // 3. 첫 화면에 초록이 없다
  await pg.evaluate(() => { Game.state = 'intro'; });
  await pg.waitForTimeout(300);
  const scr = await pg.evaluate(() => {
    const cv = document.getElementById('game');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let g = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { n++; if (d[i + 1] - Math.max(d[i], d[i + 2]) > 40) g++; }
    return g / n * 100;
  });
  out.push(`첫화면 초록 ${scr.toFixed(4)}%`);
  if (scr > .05) fail.push(`첫 화면에 초록이 ${scr.toFixed(3)}% — 로고 뒤 판이 안 빠졌다`);

  // 5~6. 어떻게 그리는가 — 부르는 자리를 세어 본다
  const calls = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const S9 = drawSlice9, SH = drawSliceH, AR = uiArt;
    const s9 = [], sh = [], ar = [];
    window.drawSlice9 = (k, ...a) => { s9.push(k); return S9(k, ...a); };
    window.drawSliceH = (k, ...a) => { sh.push(k); return SH(k, ...a); };
    window.uiArt = (k, ...a) => { ar.push(k); return AR(k, ...a); };
    Game.state = 'title'; selectedClass = 1; await wait(200);
    const title = { s9: s9.slice(), sh: sh.slice(), ar: ar.slice() };
    s9.length = sh.length = ar.length = 0;
    Game.state = 'altar'; await wait(200);
    const altar = { s9: s9.slice(), sh: sh.slice(), ar: ar.slice() };
    window.drawSlice9 = S9; window.drawSliceH = SH; window.uiArt = AR;
    Game.state = 'intro';
    return { title, altar };
  });
  /* §120 도감 — 네 부품이 실제로 불리는가. 걸어 본 칸(금)·못 간 칸(철)·「다음」 봉인이 한 화면에
     나오게 성기사 갈래 둘을 걸어 본 것으로 둔다. 탭은 uiArtW 로 그리므로 uiArt 훅에 잡힌다. */
  const codex = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const S9 = drawSlice9, SH = drawSliceH, AR = uiArt, used = new Set();
    window.drawSlice9 = (k, ...a) => { used.add(k); return S9(k, ...a); };
    window.drawSliceH = (k, ...a) => { used.add(k); return SH(k, ...a); };
    window.uiArt = (k, ...a) => { used.add(k); return AR(k, ...a); };
    const saved = JSON.stringify(Meta.codex);
    Meta.codex.guardian = { n: 1 }; Meta.codex.everwall = { n: 1 };
    Game.state = 'codex'; Game.codexCls = 0; await wait(200);
    window.drawSlice9 = S9; window.drawSliceH = SH; window.uiArt = AR;
    Object.assign(Meta.codex, JSON.parse(saved)); delete Meta.codex.guardian; delete Meta.codex.everwall;
    Game.state = 'intro';
    return [...used];
  });
  for (const k of ['ui_codex_cell', 'ui_codex_cell_locked', 'ui_codex_tab', 'ui_codex_mark', 'ui_ribbon_thin'])
    if (!codex.includes(k)) fail.push(`도감 화면이 ${k} 를 안 그린다 — 접두(ui_)나 조건이 틀렸다`);
  out.push('도감 부품 ' + codex.filter(k => k.startsWith('ui_codex') || k === 'ui_ribbon_thin').length + '/5 불림');
  /* HUD 틀 — 가운데가 뚫렸는가, 그리고 판에서 실제로 쓰이는가 */
  const hud = await pg.evaluate(([HOLLOW, RIBBON_ON]) => {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    const holes = {};
    for (const k of HOLLOW) {
      const f = Sprites.frames[k];
      c.width = f.w; c.height = f.h; g.clearRect(0, 0, f.w, f.h);
      g.drawImage(Sprites.atlas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      const x0 = Math.floor(f.w * .3), x1 = Math.ceil(f.w * .7), y0 = Math.floor(f.h * .3), y1 = Math.ceil(f.h * .7);
      const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      let solid = 0, n = 0;
      for (let i = 3; i < d.length; i += 4) { n++; if (d[i] > 40) solid++; }
      holes[k] = solid / n * 100;
    }
    const S9 = drawSlice9, SH = drawSliceH, UA = uiArt, PT = pointer, used = new Set();
    window.drawSlice9 = (k, ...a) => { used.add(k); return S9(k, ...a); };
    window.drawSliceH = (k, ...a) => { used.add(k); return SH(k, ...a); };
    window.uiArt = (k, ...a) => { used.add(k); return UA(k, ...a); };
    window.pointer = (...a) => { const ok = PT(...a); if (ok) used.add('ui_pointer'); return ok; };
    const SA = drawScaleArt;                                  // §121 저울은 눈금 사이를 따로 늘려 직접 그린다
    window.drawScaleArt = (...a) => { const ok = SA(...a); if (ok) used.add('ui_scale'); return ok; };
    selectedClass = 1; Game.reset(); Game.state = 'playing'; player.items = ['bomb', null, null];
    let t = performance.now() + 5000;
    /* 판을 깐 직후엔 적이 없다 — 2.5초에도 0마리였다(재 봤다). 10초 돌린다(레벨업 창은
       닫아 둔다). 처음 세 프레임만 돌렸을 때 파수꾼을 세울 적이 없어 체력바 틀이 안 그려졌다. */
    for (let i = 0; i < 600; i++) { Game.state = 'playing'; frame(t += 16.7); }
    const far = enemies.find(e => e.active);
    if (far) { far.sigilKey = 'probe'; far.hp = far.maxHp * .5; far.x = player.x + 2500; far.y = player.y; }
    for (let i = 0; i < 3; i++) { Game.state = 'playing'; frame(t += 16.7); }
    for (const [, prep] of RIBBON_ON) {                       // 알림 채널을 하나씩
      Game.sinFlash = Game.lmFlash = Game.comboFlash = Game.faithBanner = 0;
      eval(prep); Game.state = 'playing'; frame(t += 16.7);
    }
    /* 카드 부품은 카드 화면에서만 나온다. 레벨업 창(가리키지 않은 카드 → 일반 액자·머리띠)과
       3차 전직 창(각성 액자·초상 창틀)을 한 프레임씩 그린다. */
    mouse.x = 0; mouse.y = 0;
    player.xp = player.xpNext; Game.levelUp(); frame(t += 16.7);
    player.advance = ADVANCES.filter(a => a.tier <= 2).slice(0, 2);
    Game.choices = ADVANCES.filter(a => a.tier === 3).slice(0, 3); Game.state = 'advance'; frame(t += 16.7);
    player.advance = [];
    /* §121 영창 보석은 마법사 자세 줄에만 나온다 — 켜진 것과 꺼진 것이 함께 보이게 2단으로 둔다 */
    selectedClass = 3; Game.reset(); Game.state = 'playing'; player.channel = 2.2; frame(t += 16.7);
    window.drawSlice9 = S9; window.drawSliceH = SH; window.uiArt = UA; window.pointer = PT; window.drawScaleArt = SA;
    Game.state = 'title';
    return { holes, used: [...used] };
  }, [HOLLOW, RIBBON_ON]);
  out.push('HUD 틀 가운데 막힘 ' + HOLLOW.map(k => `${k.slice(3)} ${hud.holes[k].toFixed(1)}%`).join(' · '));
  for (const k of HOLLOW) {
    if (k.startsWith('ui_codex')) continue;          // §120 — 도감 칸은 HUD 가 아니라 도감 화면이 그린다(위에서 따로 봤다)
    if (hud.holes[k] > 3) fail.push(`${k} 의 가운데가 ${hud.holes[k].toFixed(1)}% 막혀 있다 — 틀 안에 그리는 체력이 안 보인다`);
    if (!hud.used.includes(k)) fail.push(`${k} 이 판에서 안 그려진다 — HUD 가 예전 칩으로 떨어졌다`);
  }
  for (const k of [...ON_TARGET, 'ui_clock', 'ui_card', 'ui_cardhead', 'ui_card_awaken', 'ui_portrait',
                   'ui_chip', 'ui_scale', 'ui_pip_on', 'ui_pip_off'])                  // §121
    if (!hud.used.includes(k)) fail.push(`${k} 이 판에서 안 그려진다 — 이름 접두(ui_)나 부르는 자리를 보라`);
  out.push('작은 칩 ' + ['ui_chip', 'ui_scale', 'ui_pip_on', 'ui_pip_off'].map(k => k.slice(3) + (hud.used.includes(k) ? ' ○' : ' ×')).join(' · '));
  out.push('리본 그려짐 ' + RIBBON_ON.map(([k]) => k.slice(3) + (hud.used.includes(k) ? ' ○' : ' ×')).join(' · '));
  for (const [k] of RIBBON_ON)
    if (!hud.used.includes(k)) fail.push(`${k} 이 알림에서 안 그려진다 — 배너가 옛 칩(또는 글자만)으로 떨어졌다`);

  /* §122 스킬 형태 — 능동 스킬 일흔둘이 여섯 그림을 나눠 쓴다. 스킬 하나가 형태를 안 달고
     들어오면(새 각성을 추가할 때) 그 스킬만 조용히 옛 별로 떨어진다 — 화면이 안 죽으므로
     눈으로는 안 잡힌다. 스킬마다 형태가 있고 그 형태의 그림이 판에 있는지를 센다.
     그리고 여섯이 **실제로 그려지는지**는 형태를 하나씩 갈아 끼우며 HUD 를 한 프레임씩 본다. */
  const sk = await pg.evaluate(() => {
    const all = [...CLASSES.map(c => c.skill), ...ADVANCES.filter(a => a.skill).map(a => a.skill)];
    const noShape = all.filter(s => !s.shape).map(s => s.name);
    const noArt = [...new Set(all.map(s => s.shape))].filter(k => k && !Sprites.frames['ui_sk_' + k]);
    const cnt = {};
    for (const s of all) cnt[s.shape] = (cnt[s.shape] || 0) + 1;
    const UA = uiArt, drawn = new Set();
    window.uiArt = (k, ...a) => { const ok = UA(k, ...a); if (ok && k.startsWith('ui_sk_')) drawn.add(k); return ok; };
    selectedClass = 0; Game.reset(); Game.state = 'playing';
    let t = performance.now() + 5000;
    for (const shape of ['wave', 'bolt', 'slash', 'burst', 'blink', 'dash']) {
      player.cls.skill.shape = shape; Game.state = 'playing'; frame(t += 16.7);
    }
    player.cls.skill.shape = 'slash';
    window.uiArt = UA;
    Game.state = 'title';
    return { total: all.length, noShape, noArt, cnt, drawn: [...drawn] };
  });
  out.push(`스킬 형태 ${sk.total}개 스킬 → ` + Object.entries(sk.cnt).map(([k, v]) => k + ' ' + v).join(' · '));
  if (sk.noShape.length) fail.push(`형태가 없는 스킬 ${sk.noShape.length}개 — ${sk.noShape.slice(0, 3).join(', ')} (옛 별로 떨어진다)`);
  if (sk.noArt.length) fail.push(`그림이 없는 형태 ${sk.noArt.join(', ')} — 이름이나 아틀라스를 보라`);
  if (sk.drawn.length !== 6) fail.push(`HUD 가 그린 스킬 그림이 ${sk.drawn.length}/6 — 스킬 액자가 옛 별로 떨어졌다`);

  /* §124 제단 — 강화 여섯과 영혼 구슬은 한 화면에 다 나온다. 강화를 하나 더 넣으면 그림이
     없어 조용히 옛 표로 떨어지므로(화면은 안 죽는다) ALTAR 전부가 그려지는지를 센다. */
  const altar = await pg.evaluate(() => {
    const UA = uiArt, drawn = new Set();
    window.uiArt = (k, ...a) => { const ok = UA(k, ...a); if (ok && k.startsWith('ui_up_')) drawn.add(k); return ok; };
    const saved = Meta.souls, lv = JSON.stringify(Meta.levels);
    Meta.souls = 4000; Meta.levels.vigor = 5;            // 다 올린 칸도 한 장 섞는다
    Game.state = 'altar'; mouse.x = -9; mouse.y = -9;
    frame(performance.now() + 5000);
    window.uiArt = UA;
    Meta.souls = saved; Meta.levels = JSON.parse(lv);
    Game.state = 'title';
    return { drawn: [...drawn], want: ALTAR.map(u => 'ui_up_' + u.key).concat('ui_up_orb') };
  });
  for (const k of altar.want)
    if (!altar.drawn.includes(k)) fail.push(`${k} 이 제단에서 안 그려진다 — 옛 표로 떨어졌다`);
  out.push(`제단 강화 ${altar.drawn.length}/${altar.want.length} 그려짐`);

  /* §125 바닥 획득물 — 소모품을 하나 더 넣으면 그림이 없어 옛 약병으로 조용히 떨어진다
     (다섯이 색만 다른 같은 병이던 시절로 되돌아가는 셈이다). 여덟이 다 그려지는지 센다. */
  const drop = await pg.evaluate(() => {
    const UA = uiArt, drawn = new Set();
    window.uiArt = (k, ...a) => { const ok = UA(k, ...a); if (ok && k.startsWith('drop_')) drawn.add(k); return ok; };
    selectedClass = 0; Game.reset(); Game.state = 'playing';
    let t = performance.now() + 5000;
    for (let i = 0; i < 30; i++) { Game.state = 'playing'; update(1 / 60); }
    for (const e of enemies) e.active = false;
    for (const p of pickups) p.active = false;
    const KINDS = ['heart', 'vacuum', 'sigil', ...CONSUMABLE_KEYS.map(k => 'item:' + k)];
    KINDS.forEach((k, i) => spawnPickup(player.x - 300 + i * 70, player.y - 150, k));
    Game.state = 'playing'; frame(t += 16.7);
    window.uiArt = UA;
    Game.state = 'title';
    return { drawn: [...drawn], want: KINDS.length };
  });
  if (drop.drawn.length !== drop.want)
    fail.push(`바닥 획득물 ${drop.drawn.length}/${drop.want} 만 그려진다 — 옛 도형으로 떨어졌다`);
  out.push(`바닥 획득물 ${drop.drawn.length}/${drop.want} 그려짐`);

  const crests = calls.title.ar.filter(k => k.startsWith('ui_crest_'));
  const frames = calls.title.s9.filter(k => k === 'ui_panel');
  const insets = calls.title.s9.filter(k => k === 'ui_inset');
  /* 200ms 동안 여러 판이 그려지므로 낱개가 아니라 **한 판당 몇 장인가**로 잰다.
     카드 넷 중 하나만 금 액자, 넷 다 창틀이므로 창틀은 액자의 네 배여야 한다. */
  out.push(`직업선택 문장 ${new Set(crests).size}종 · 금액자 ${frames.length} · 창틀 ${insets.length}`);
  if (new Set(crests).size !== 4) fail.push(`직업 문장이 ${new Set(crests).size}종만 그려진다 — 넷이어야 한다`);
  if (!frames.length) fail.push('고른 카드에 금 액자가 안 둘린다');
  if (insets.length !== frames.length * 4) fail.push(`한 판에 금 액자 ${frames.length} · 창틀 ${insets.length} — 창틀은 카드 넷, 액자는 고른 하나여야 한다`);
  if (crests.length !== insets.length) fail.push(`문장 ${crests.length} · 창틀 ${insets.length} — 카드마다 하나씩이어야 한다`);
  const divSliced = [...calls.title.sh, ...calls.altar.sh].includes('ui_divider');
  if (divSliced) fail.push('가름줄을 삼등분해 늘렸다 — 가운데 마름모가 뭉갠다');
  if (!calls.altar.ar.includes('ui_divider')) fail.push('제단 머리에 가름줄이 없다');

  fail.push(...errs);
  await b.close();
  console.log(out.join('\n'));
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  process.exit(fail.length ? 1 : 0);
})();

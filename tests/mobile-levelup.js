/* 회귀: 세로 화면에서 레벨업 카드가 HUD 와 겹치지 않는가.

   세로(390×844 → 논리 520×1126)에서 카드 셋을 세로로 쌓는데, 제목 「레벨 업!」이 위쪽
   HUD 줄(방벽·조합 줄)과 겹치고 마지막 카드가 아래 무기 슬롯을 덮었다. 배율 k 가
   (H - 148 - 22) 만 보고 HUD 가 어디까지 내려왔는지는 안 봤기 때문이다.

   HUD 는 매 프레임 자기 판·칩의 사각형을 hudPrev 에 남긴다(§80). 그걸로 위 HUD 의
   아래 끝과 아래 HUD 의 위 끝을 재고, 그 사이에 제목·카드가 들어가는지 본다.

   실행: node tests/mobile-levelup.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let bad = 0;
  for (const [vw, vh] of [[390, 844], [360, 780], [430, 932]]) {
    const pg = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await pg.goto('file://' + require('path').resolve(__dirname, '../game/index.html'));
    await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
    const r = await pg.evaluate(() => {
      selectedClass = 0; Game.reset();
      touch.seen = true;                                   // 폰 — 터치 버튼이 있다
      for (let i = 0; i < 60; i++) update(1 / 60);
      player.xp = player.xpNext; Game.levelUp();           // 레벨업 창을 띄운다
      for (let i = 0; i < 3; i++) frame(performance.now() + i * 16);   // HUD 사각형이 hudPrev 에 남는다
      const top = [], botR = [];
      for (let i = 0; i < hudPrev.length; i += 4) {
        const y = hudPrev[i + 1], h = hudPrev[i + 3];
        (y < H / 2 ? top : botR).push([y, y + h]);
      }
      const hudTopEnd = Math.max(0, ...top.map(t => t[1]));
      const hudBotStart = Math.min(H, ...botR.map(t => t[0]));
      return { W, H, state: Game.state, hudTopEnd: Math.round(hudTopEnd), hudBotStart: Math.round(hudBotStart), L: Game._luLayout || null };
    });
    const L = r.L;
    console.log(`${vw}×${vh} → 논리 ${r.W}×${r.H} · 위 HUD 끝 ${r.hudTopEnd} · 아래 HUD 시작 ${r.hudBotStart}` +
      (L ? ` · 제목 y ${L.titleY} · 카드 ${L.cardTop}~${L.cardBot} (k ${L.k})` : ' · (배치 정보 없음 — Game._luLayout 이 없다)'));
    if (r.state !== 'levelup') { console.log('  !! 레벨업 창이 안 떴다'); bad++; continue; }
    if (!L) { bad++; continue; }
    if (L.titleY - 22 < r.hudTopEnd) { console.log(`  !! 제목(${L.titleY})이 위 HUD(${r.hudTopEnd}) 와 겹친다`); bad++; }
    if (L.cardTop < r.hudTopEnd + 8) { console.log(`  !! 첫 카드(${L.cardTop})가 위 HUD(${r.hudTopEnd}) 와 겹친다`); bad++; }
    if (L.cardBot > r.hudBotStart - 8) { console.log(`  !! 마지막 카드(${L.cardBot})가 아래 HUD(${r.hudBotStart}) 를 덮는다`); bad++; }
    if (L.k < .55) { console.log(`  !! 카드가 ${L.k} 배로 너무 작다`); bad++; }
    if (errs.length) { console.log(errs.join('\n')); bad++; }
    await pg.close();
  }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close(); process.exit(bad ? 1 : 0);
})();

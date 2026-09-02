/* 회귀: 상단 알림이 한 번에 하나만 보이고, 넷이 차례로 다 보이는가.

   7분 화면에 「속성 조합 발동!」「전직 가능」「사냥개 무리가 온다」가 세 겹으로 떠
   있었다. 알림 넷(조합·전직 연출·사냥개·토스트)이 각자 고정 y 에 그려졌기 때문이다.
   상태(보스·미션·전직 대기)는 그대로 두고 알림만 큐에 넣었다 — 지금 보이는 것만
   시간이 흐르고 나머지는 멈춰 기다린다. 기다리는 게 있으면 1.2초 안에 넘긴다.

   재는 것: 넷을 동시에 켜고 시간을 흘려 (1) 매 순간 current 가 하나인가,
   (2) 넷이 모두 한 번씩 current 가 되는가, (3) 우선순위 순서인가,
   (4) 전부 끝나는 데 걸리는 시간이 '각자 다 흘렀을 때'(3.6초)보다 길되
       1.2초×3 + 마지막 하나(≤3.6) 를 넘지 않는가.

   실행: node tests/notice-queue.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  const r = await pg.evaluate(() => {
    Game.comboFlash = 2.6; Game.advanceFlash = 3.6; Game.houndWarn = 2.4; Game.lmFlash = 3; Game.lmFlashText = "t";
    const seq = []; let t = 0, multi = 0;
    for (let i = 0; i < 60 * 20; i++) {
      Notice.tick(1 / 60); t += 1 / 60;
      const live = Notice.order.filter(k => Game[k] > 0);
      // 보이는 것은 current 하나 — 다른 타이머는 살아 있어도 멈춰 있어야 한다
      if (Notice.current && !seq.length || (Notice.current && seq[seq.length - 1].k !== Notice.current)) seq.push({ k: Notice.current, at: +t.toFixed(2) });
      if (!Notice.current) break;
    }
    // 멈춤 검사 — 첫 프레임 뒤에 current 가 아닌 것들의 값이 그대로인가
    Game.comboFlash = 2.6; Game.advanceFlash = 3.6; Game.houndWarn = 2.4; Game.lmFlash = 3;
    Notice.tick(1 / 60);
    const held = { hound: Game.houndWarn, combo: Game.comboFlash, lm: Game.lmFlash, adv: +Game.advanceFlash.toFixed(3) };
    return { seq, total: +t.toFixed(2), held };
  });
  let bad = 0;
  console.log('순서: ' + r.seq.map(s => `${s.k}@${s.at}s`).join(' → ') + `   전체 ${r.total}s`);
  console.log(`첫 프레임 뒤 — 보이는 전직 연출 ${r.held.adv} · 기다리는 사냥개 ${r.held.hound} 조합 ${r.held.combo} 토스트 ${r.held.lm}`);
  const kinds = r.seq.map(s => s.k);
  if (new Set(kinds).size !== 4) { console.log('!! 넷이 모두 보이지 않았다: ' + kinds.join(',')); bad++; }
  if (kinds.join(',') !== 'advanceFlash,houndWarn,comboFlash,lmFlash') { console.log('!! 우선순위 순서가 아니다'); bad++; }
  if (kinds.length !== 4) { console.log('!! 같은 알림이 두 번 나뉘어 보였다'); bad++; }
  if (r.held.hound !== 2.4 || r.held.combo !== 2.6 || r.held.lm !== 3) { console.log('!! 기다리는 알림의 시간이 흘렀다 — 큐가 아니라 가림막이다'); bad++; }
  if (!(r.held.adv <= 1.2)) { console.log(`!! 뒤에 기다리는 게 있는데 지금 것이 ${r.held.adv}s 나 남았다`); bad++; }
  // 1.2 × 3 + 마지막(토스트 3.0) = 6.6 을 넘으면 안 되고, 셋이 넘겨졌으니 3.6 보다는 길어야 한다
  if (!(r.total > 3.6 && r.total <= 6.7)) { console.log(`!! 전체 ${r.total}s — 기대 3.6 < t ≤ 6.7`); bad++; }
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close(); process.exit(bad ? 1 : 0);
})();

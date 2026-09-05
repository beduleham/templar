/* 회귀: 죄의 표식이 언제나 셋 있고, 찾아가야 잡히는가.

   이 훅은 구현 도중 한 번 통째로 헛돌았다(hook-spec A3). 표식만 칠하고 행동을 그대로
   뒀더니 8분 판에서 표식이 죽은 자리가 플레이어에게서 67 · 93 · 68px 이었다 —
   **찾아간 게 아니라 걸어온 것을 잡았다.** 이 게임의 적은 전부 플레이어에게 모이므로
   색만 입히면 어차피 다 죽는 무리 중 하나가 된다. 그래서 죄인은 다가오지 않는다.

   그 성질이 조용히 사라질 수 있는 자리가 셋이다.
     · 「그 자리에 선다」가 풀리면 다시 걸어온다 (추격 코드 한 줄이다)
     · 표식이 징표를 흘리면 3·6·9·12분 각성 리듬이 무너진다
     · mark 가 곱한 체력·속도를 unmark 가 안 나누면 풀에 단단해진 개체가 쌓인다

   재는 것:
     1. 언제나 정확히 셋이다 — 죽여도, 떼어내도, 판 내내
     2. 붙일 때와 뗄 때가 대칭이다 (체력·속도가 원래대로 돌아온다)
     3. 죄인은 다가오지 않는다 — 10초 뒤에도 거리가 안 줄어든다
     4. 표식은 징표를 주지 않는다
     5. 처치 보상이 실제로 나온다 — 경험치·소모품·영혼
     5-b. 그 보상이 **화면에 보인다.** 오래도록 값은 다 주면서 아무 말도 안 했다 —
        `Sin.flash` 를 켜 두기만 하고 읽는 데가 없었고, 보석은 다른 처치에서도
        쏟아지고 소모품은 42px 옆에 조용히 놓였다. 사람이 「죄인을 처형해도
        아무것도 안 보인다」고 했다. 처치 지점의 말 · 알림 큐의 띠 · HUD 의
        누적 수 셋이 다 살아 있어야 한다
     6. 화면 밖 표식도 방향과 거리가 보인다
     7. 판을 다시 시작하면 표식이 안 남는다 (풀을 돌려 쓴다)

   실행: node tests/sin-mark.js */
const { chromium } = require('playwright');
const { BOT } = require('../tests/bot.js');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  await pg.evaluate((S) => { (0, eval)(S); }, BOT);

  const r = await pg.evaluate(() => {
    const o = {};
    const marked = () => enemies.filter(e => e.active && e.sinMark);
    const step = (secs, hunt) => {
      for (let i = 0; i < 60 * secs; i++) {
        if (Game.state === 'playing') { botTick(1 / 60, true); player.hp = player.stats.maxHp; }
        update(1 / 60);
        let g = 0;
        while ((Game.state === 'levelup' || Game.state === 'advance') && g++ < 50)
          Game.applyChoice(Game.choices.find(c => c.type === 'passive') || Game.choices.find(c => c.type !== 'heal') || Game.choices[0]);
      }
    };
    selectedClass = 0; Game.reset(); botInstall(); player.godMode = true;

    // 1. 판 내내 셋
    const counts = [];
    for (const t of [20, 60, 180, 420]) { step(t - Math.round(Game.time)); counts.push(marked().length); }
    o.counts = counts;

    // 2. 붙일 때와 뗄 때가 대칭이다
    const free = enemies.find(e => e.active && !e.sinMark && !e.boss && !e.sigilKey);
    if (free) {
      const h0 = free.maxHp, p0 = free.hp, s0 = free.spd;
      Sin.mark(free);
      o.marked = { hp: +(free.maxHp / h0).toFixed(2), spd: +(free.spd / s0).toFixed(3) };
      Sin.unmark(free);
      o.sym = [+(free.maxHp - h0).toFixed(6), +(free.hp - p0).toFixed(6), +(free.spd - s0).toFixed(6)];
    }

    /* 3. 죄인은 다가오지 않는다 — 플레이어를 세워 두고 10초.
       먼저 표식을 새로 붙인다. 앞 단계에서 오래 산 표식은 30초 교체 시한에 걸려
       10초 안에 저절로 옮겨 가고, 그러면 「다가왔는가」가 아니라 「살아남았는가」를
       재게 된다.

       ■ 문턱은 60 이 아니라 150 이다 — 재서 정했다

       처음엔 60px 였는데 같은 코드가 이따금 떨어졌다. 죄인은 제자리를 돌 뿐이지만
       무리에 밀려 조금씩 안으로 들어온다. 두 상태를 각각 재 보니 이랬다.

           제자리를 돌 때(정상)   n=21, 가장 많이 가까워진 것이 59px
           쫓아올 때(고장)        n=12, 열둘 중 열이 270~433px

       60 은 잡음의 천장에 딱 붙어 있었다. 150 이면 두 무리가 안 겹친다 —
       느슨하게 만든 게 아니라 **잡음과 신호를 재서 가른 것**이다. */
    for (const e of marked()) Sin.unmark(e);
    Sin.fillT = 0; step(.5);
    const before = marked().map(e => [e.id, Math.hypot(e.x - player.x, e.y - player.y)]);
    const APPROACH = 150;                                      // 아래 주석의 실측으로 정한 값
    const BT = botTick; botTick = () => {};                    // 플레이어를 세운다
    step(10);
    botTick = BT;
    let closed = 0, kept = 0;
    for (const [id, d0] of before) {
      const e = enemies.find(x => x.active && x.id === id && x.sinMark);
      if (!e) continue;
      kept++;
      if (Math.hypot(e.x - player.x, e.y - player.y) < d0 - APPROACH) closed++;
    }
    o.approach = { kept, closed };

    // 4~5. 처치 보상 — 표식 하나를 직접 죽여 본다
    const victim = marked()[0];
    if (victim) {
      const sig0 = player.sigils, sou0 = Sin.souls, kil0 = Sin.killed;
      const gem0 = gems.filter(g => g.active).length;
      const item0 = pickups.filter(p => p.active).length;
      // 알림 큐를 비워 둔다 — 다른 알림이 서 있으면 처형 띠는 차례를 기다린다
      Game.advanceFlash = 0; Game.houndWarn = 0; Game.comboFlash = 0; Game.lmFlash = 0;
      Game.sinFlash = 0;
      const lbl0 = numbers.filter(n => n.active && n.label).length;
      damageEnemy(victim, victim.hp + 1e6, player.x, player.y, 0, 'holy');
      o.kill = { sigil: player.sigils - sig0, souls: Sin.souls - sou0, killed: Sin.killed - kil0,
        gem: gems.filter(g => g.active).length - gem0, drop: pickups.filter(p => p.active).length - item0 };
      // 5-b. 세 채널이 다 켜졌는가
      Notice.tick(1 / 60);
      o.say = {
        labels: numbers.filter(n => n.active && n.label).map(n => n.text),
        newLabels: numbers.filter(n => n.active && n.label).length - lbl0,
        banner: Notice.current,
        flash: +Game.sinFlash.toFixed(2),
        hud: "처형 " + Sin.killed + "  ·  영혼 +" + Sin.souls,
        counters: [Sin.killed, Sin.souls],
        inOrder: Notice.order.indexOf("sinFlash"),
      };
      step(1);
      o.refill = marked().length;
    }

    // 6. 화면 밖 표식이 있는지 — 화살표가 그려질 조건
    o.offscreen = marked().filter(e => {
      const sx = e.x - cam.x, sy = e.y - cam.y;
      return sx < 58 || sx > W - 58 || sy < 58 || sy > H - 58;
    }).length;

    // 7. 판을 다시 시작하면 표식이 안 남는다
    botRestore();
    Game.reset();
    o.afterReset = enemies.filter(e => e.sinMark).length;
    return o;
  });

  const fail = [];
  if (!r.counts.every(n => n === 3)) fail.push(`표식이 항상 셋이 아니다 (${r.counts.join(', ')})`);
  if (!r.marked || r.marked.hp !== 2.2) fail.push(`체력 배수가 ${r.marked && r.marked.hp} — 2.2 여야 한다`);
  if (!r.sym || r.sym.some(v => Math.abs(v) > 1e-4))
    fail.push(`붙였다 떼면 원래대로 안 온다 (체력 ${r.sym}) — 풀에 단단해진 개체가 쌓인다`);
  if (!(r.approach.kept >= 2)) fail.push(`10초 만에 표식이 ${r.approach.kept}개만 남았다 — 너무 빨리 사라진다`);
  if (r.approach.closed > 0)
    fail.push(`죄인 ${r.approach.closed}마리가 걸어왔다 — 「그 자리에 선다」가 풀렸다. 찾아갈 이유가 사라진다`);
  if (!r.kill) fail.push('표식을 죽여 볼 수 없었다');
  else {
    if (r.kill.sigil !== 0) fail.push(`표식이 징표를 ${r.kill.sigil}개 줬다 — 각성 리듬(3·6·9·12분)이 무너진다`);
    if (r.kill.killed !== 1) fail.push('처형이 안 세어진다');
    if (r.kill.souls !== 3) fail.push(`영혼이 ${r.kill.souls} — 3 이어야 한다`);
    if (r.kill.gem < 1) fail.push('처형에 경험치가 안 나온다');
    if (r.kill.drop < 1) fail.push('처형에 소모품이 안 나온다 (대기를 무시해야 한다)');
    if (r.refill !== 3) fail.push(`하나 죽인 뒤 ${r.refill}개로 안 채워진다`);
  }
  /* 값을 주는 것과 값을 **보여주는** 것은 다른 일이다. 아래 셋 중 하나라도 꺼지면
     쫓아간 값이 안 보이고, 안 보이는 보상은 다음에 안 쫓아가게 만든다. */
  if (!r.say) fail.push('처형 연출을 재지 못했다');
  else {
    console.log(`  말했나  지점 [${r.say.labels.join(' / ')}] · 띠 ${r.say.banner} (${r.say.flash}s) · HUD ${r.say.hud}`);
    if (r.say.newLabels < 2)
      fail.push(`처치 지점에 뜬 말이 ${r.say.newLabels}개 — 영혼과 경험치 둘 다 말해야 한다`);
    if (!r.say.labels.some(t => t.indexOf('영혼') >= 0))
      fail.push('처치 지점이 영혼을 말하지 않는다 — 판 밖으로 나가는 값이다');
    if (r.say.inOrder < 0)
      fail.push('처형 띠가 알림 큐에 없다 — 제 자리에 그리면 지형지물 토스트와 겹친다');
    if (r.say.banner !== 'sinFlash')
      fail.push(`알림 큐가 처형 대신 ${r.say.banner} 를 보여준다`);
    if (!(r.say.flash > 0))
      fail.push('처형 띠 타이머가 안 켜졌다 — 오래도록 켜기만 하고 아무도 안 읽던 값이다');
    const [kn, sn] = r.say.counters;
    if (!(kn > 0 && sn === kn * 3))
      fail.push(`HUD 가 읽는 값이 어긋난다 — 처형 ${kn} · 영혼 ${sn} (처형당 3이어야 한다)`);
    if (r.say.hud.indexOf(String(kn)) < 0 || r.say.hud.indexOf(String(sn)) < 0)
      fail.push(`HUD 가 「${r.say.hud}」 — 처형 수와 번 영혼이 자라는 게 보여야 한다`);
  }
  if (r.afterReset) fail.push(`판을 다시 시작해도 표식이 ${r.afterReset}개 남았다 — 풀을 돌려 쓴다`);

  console.log(`표식 수   20·60·180·420초에 ${r.counts.join(' / ')}`);
  console.log(`배수      체력 x${r.marked && r.marked.hp} · 속도 x${r.marked && r.marked.spd} · 되돌림 오차 ${r.sym}`);
  console.log(`거리      10초 세워 두었을 때 ${r.approach.kept}개 중 ${r.approach.closed}개가 접근`);
  if (r.kill) console.log(`처형      징표 ${r.kill.sigil} · 영혼 ${r.kill.souls} · 보석 ${r.kill.gem} · 소모품 ${r.kill.drop} · 보충 ${r.refill}`);
  console.log(`화면 밖   ${r.offscreen}/3 (화살표가 필요한 수)`);
  if (errs.length) fail.push(...errs);
  await b.close();
  console.log(fail.length ? 'FAIL\n - ' + fail.join('\n - ') : 'PASS');
  process.exit(fail.length ? 1 : 0);
})();

/* 회귀: 봇이 전직 관문까지 갈 수 있는가.

   ── 무엇이 문제였나

   68갈래 전직은 이 게임에서 가장 큰 시스템인데, 자동으로 노는 것이 그 문을 한 번도
   연 적이 없었다. 셋을 차례로 재서 원인을 갈랐다.

     1. 고르기 탓인가   — 카드를 제대로 고르게 했더니 조합은 열렸지만 전직은 그대로 0.
     2. 생존 탓인가     — **안 죽게 하고** 15분을 굴렸는데도 징표 0 · 전직 0/4 였다.
                          막는 것은 생존이 아니었다.
     3. 그럼 무엇인가   — 봇에게 **갈 곳이 없었다.** 가까운 적만 보고 걸으니 제단에
                          영영 안 간다. 제단을 찾아가게 하자 연 제단이 0.9 → 5.3 이 됐다.
                          그런데도 징표는 0 이었다 — 파수꾼을 잡아도 징표는 **땅에
                          떨어지는 물건**이라 주우러 가야 한다. **잡는 것과 줍는 것은
                          다른 일이다.** 떨어진 징표를 먼저 줍게 하자 8판 전부 열렸다.

   ── 왜 안 죽게 하고 재는가

   실제 판에서 봇은 평균 3:02 에 죽고 첫 관문은 3:00 이다 — 관문 앞에서 죽으므로
   실전으로 재면 「관문까지 가는 길」이 멀쩡한지 아닌지를 **생존 편차가 덮는다**
   (생존 시간의 표준편차는 54~89초다). 여기서 묻는 것은 난이도가 아니라
   **길이 이어져 있는가**이므로 죽음을 빼고 잰다.

   판마다 페이지를 새로 연다(§146) — 한 페이지에서 이어 굴리면 앞 판의 찌꺼기를
   매번 따져야 한다.

   실행: node tests/adv-gate.js */
const { chromium } = require('playwright');
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/bot.js', 'utf8');
const BOT = SRC.slice(SRC.indexOf('const BOT = `') + 13, SRC.lastIndexOf('`'));

/* 넷 다 한 씨앗씩. 여덟 판(두 씨앗)으로 재면 8/8 이 나왔지만 검사에 3분을 더 쓸
   값은 아니다 — 길이 끊기면 네 판에서도 0 이 된다(끊겨 있던 동안 실제로 그랬다). */
const CASES = [['paladin', 1000], ['warrior', 8919], ['rogue', 1000], ['mage', 8919]];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  const rows = [];

  for (const [cls, sd] of CASES) {
    const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
    pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await pg.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await pg.goto('file:///home/user/templar/game/index.html');
    await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
    rows.push(await pg.evaluate(([BOT, cls, sd]) => {
      eval(BOT);
      let seed = sd;
      Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      selectedClass = CLASSES.findIndex(c => c.key === cls);
      Game.reset(); Game.state = 'playing';
      botInstall();
      botCfg.seekSigil = true;      // 이 검사가 묻는 것이 바로 「갈 곳을 찾아가는가」다.
                                    // 공용 기본값은 꺼져 있다 — bot.js 의 이유 참고.
      /* 9분에서 끊는다. 15분 끝까지 굴리면 한 판이 1분 가까이 걸리는데(넷이면 4분),
         재는 신호는 전부 앞쪽에 있다 — 고친 뒤 열린 관문이 3:14~7:28 이었다.
         3차 관문(9:00)까지만 보면 값은 같고 시간은 절반이다. */
      const STOP = 9 * 60;
      let guard = 0; const gates = [];
      while (Game.state !== 'won' && Game.time < STOP && guard++ < STOP * 60 + 600) {
        if (Game.state === 'levelup' || Game.state === 'advance') {
          const wasAdv = Game.state === 'advance';
          botPick();
          if (wasAdv) gates.push(+Game.time.toFixed(0));
          continue;
        }
        botTick(1 / 60); update(1 / 60);
        player.hp = player.stats.maxHp;                 // 죽음을 뺀다 — 여기서 묻는 것은 길이다
        if (Game.state === 'dead') Game.state = 'playing';
      }
      return { cls, adv: player.advance.length, gates,
               sh: Game.shrinesOpened, lv: player.level, kills: Game.kills };
    }, [BOT, cls, sd]));
    await pg.close();
  }

  const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  for (const r of rows)
    console.log(`${r.cls.padEnd(8)} 전직 ${r.adv}/4 ${r.gates.length ? '(' + r.gates.map(fmt).join(' ') + ')' : ''}`
      + ` · 연 제단 ${r.sh} · 레벨 ${r.lv} · 처치 ${r.kills}`);

  const opened = rows.filter(r => r.adv >= 1).length;
  const total = rows.reduce((a, r) => a + r.adv, 0);
  const shrines = rows.reduce((a, r) => a + r.sh, 0) / rows.length;
  console.log(`1차 이상 ${opened}/${rows.length} · 합계 ${total}차 · 판당 연 제단 ${shrines.toFixed(1)}`);

  /* 자는 고친 뒤의 값에서 여유를 두고 잡는다. 고치기 전 2/8(합계 2차 · 제단 0.9),
     고친 뒤 8/8(합계 14차 · 제단 5.3). 길이 다시 끊기면 앞의 값으로 돌아간다. */
  if (opened < 3) { console.log(`!! 넷 중 ${opened} 판만 전직을 열었다 — 관문까지 가는 길이 끊겼다`); errs.push('gate'); }
  if (total < 4) { console.log(`!! 합계 ${total}차뿐이다 (고친 뒤 14차였다)`); errs.push('tiers'); }
  if (shrines < 2) { console.log(`!! 판당 제단을 ${shrines.toFixed(1)} 개만 연다 — 제단을 찾아가지 않는다`); errs.push('shrine'); }

  await b.close();
  if (errs.length) { console.log('\n실패 ' + errs.length + '건'); process.exit(1); }
  console.log('\n통과');
})();

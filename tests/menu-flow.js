/* 메뉴 사이를 오가는 길이 실제로 이어져 있는가.

   화면은 멀쩡한데 길이 끊겨 있는 종류의 버그는 눈으로 안 잡힌다.
   실제로 둘 있었다.

     · 어트랙트 데모가 전역 selectedClass 를 덮어썼다. 타이틀에서 성기사를 골라 놓아도
       데모가 새 판을 깔 때마다 고른 직업이 제멋대로 바뀌었다.
     · 판이 끝난 뒤 갈 곳이 '다시 시작' 하나뿐이었다. 죽어서 영혼이 들어왔는데
       제단으로 갈 길이 없어 새로고침 말고는 방법이 없었다.

   확인하는 것:
     1. 데모가 내 직업 선택을 건드리지 않는가 (그러면서 데모 자신은 여러 직업을 도는가)
     2. 끝 화면에서 R/SPACE·ESC·TAB 이 각각 제 곳으로 가는가
     3. R 재시작이 '같은 직업'인가
     4. 일시정지의 포기는 R 을 두 번 눌러야 하는가 (한 번에 판이 날아가면 안 된다)
     5. 제단 구입이 키와 클릭 어느 쪽이든 같은 길을 타는가
     6. 제단에서 나가면 들어온 곳으로 돌아가는가

   실행: node tests/menu-flow.js */
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

  const r = await pg.evaluate(() => {
    const out = {};
    Sfx.on = false;                         // 소리는 이 테스트의 관심사가 아니다

    // ── 1. 데모가 내 선택을 덮어쓰지 않는가 ──
    selectedClass = 2;
    const demoSaw = new Set();
    for (let i = 0; i < 40; i++) { Attract.start(); demoSaw.add(player.cls.key); }
    Attract.stop();
    out.keptOnStart = selectedClass;
    out.demoVaried = demoSaw.size;

    // 프레임을 실제로 굴려도 그대로인가 (마우스는 카드 밖으로 치운다)
    mouse.x = 4; mouse.y = 4;
    selectedClass = 2; Game.state = 'title';
    for (let f = 0; f < 400; f++) frame(performance.now() + f * 16.7);
    out.keptOnFrames = selectedClass;
    Attract.stop();

    // ── 2·3. 끝 화면에서 갈라지는 세 갈래 ──
    selectedClass = 3;
    Game.reset(); Game.state = 'dead';
    Game.onKey('r');
    out.rState = Game.state;
    out.rClass = player.cls.key;
    out.rClassWant = CLASSES[3].key;
    out.rTime = Math.round(Game.time);      // 새 판이면 0 이다

    Game.state = 'dead'; Game.onKey('escape');
    out.escFromDead = Game.state;

    Game.state = 'dead'; Game.onKey('tab');
    out.tabFromDead = Game.state;
    out.tabFrom = Game.introFrom;
    Game.onKey('escape');                   // 제단에서 나가면 들어온 곳으로
    out.backFromAltar = Game.state;
    Attract.stop();

    // ── 4. 일시정지의 포기는 두 번 눌러야 한다 ──
    selectedClass = 1; Game.reset();
    Game.time = 99; Game.state = 'paused'; Game.quitArm = 0;
    Game.onKey('r');
    out.pause1 = { state: Game.state, time: Math.round(Game.time), armed: Game.quitArm > 0 };
    Game.onKey('r');
    out.pause2 = { state: Game.state, time: Math.round(Game.time) };

    // 무장이 풀린 뒤의 R 은 다시 '한 번째'다 — 시간이 지나 잊었을 때 판이 날아가면 안 된다
    Game.time = 77; Game.state = 'paused'; Game.quitArm = 0;
    Game.onKey('r'); Game.quitArm = 0;      // 시간이 지나 풀린 셈
    Game.onKey('r');
    out.pauseExpired = { state: Game.state, time: Math.round(Game.time) };

    // ESC 로 나가면 무장도 풀린다
    Game.state = 'paused'; Game.onKey('r');
    Game.onKey('escape');
    out.armClearedOnResume = Game.quitArm;

    // ── 5. 제단 구입 — 키와 클릭이 같은 길을 타는가 ──
    const keep = { souls: Meta.souls, levels: JSON.parse(JSON.stringify(Meta.levels)) };
    Meta.souls = 5000; Meta.levels = {};
    Game.state = 'altar'; Game.altarFlash = 0;
    const cost1 = Meta.costOf(ALTAR[0]);
    Game.onKey('1');
    out.buyKey = { lv: Meta.lv(ALTAR[0].key), spent: 5000 - Meta.souls, want: cost1, flash: Game.altarFlash > 0 };

    Game.altarFlash = 0;
    const before = Meta.souls, cost2 = Meta.costOf(ALTAR[1]);
    Game.buyAltar(ALTAR[1].key);            // 클릭이 부르는 그 함수
    out.buyClick = { lv: Meta.lv(ALTAR[1].key), spent: before - Meta.souls, want: cost2 };

    // 못 사면 아무것도 안 변한다
    Meta.souls = 0; Game.altarFlash = 0;
    const lv0 = Meta.lv(ALTAR[5].key);
    const okBroke = Game.buyAltar(ALTAR[5].key);
    out.broke = { bought: okBroke, lv: Meta.lv(ALTAR[5].key), was: lv0, flash: Game.altarFlash > 0 };

    Meta.souls = keep.souls; Meta.levels = keep.levels; Meta.save();
    Attract.stop();
    return out;
  });

  const checks = [
    ['데모가 선택 안 덮어씀', r.keptOnStart === 2 && r.keptOnFrames === 2],
    ['데모는 여러 직업을 돔', r.demoVaried >= 3],
    ['R 즉시 재시작', r.rState === 'playing' && r.rTime === 0],
    ['R 은 같은 직업', r.rClass === r.rClassWant],
    ['ESC 로 직업 선택', r.escFromDead === 'title'],
    ['TAB 으로 제단', r.tabFromDead === 'altar'],
    ['제단에서 들어온 곳으로', r.backFromAltar === 'title'],
    ['R 한 번은 판 안 버림', r.pause1.state === 'paused' && r.pause1.time === 99 && r.pause1.armed],
    ['R 두 번이면 재시작', r.pause2.state === 'playing' && r.pause2.time === 0],
    ['무장 풀리면 다시 처음부터', r.pauseExpired.state === 'paused' && r.pauseExpired.time === 77],
    ['계속하면 무장 해제', r.armClearedOnResume === 0],
    ['키로 구입', r.buyKey.lv === 1 && r.buyKey.spent === r.buyKey.want && r.buyKey.flash],
    ['클릭으로 구입', r.buyClick.lv === 1 && r.buyClick.spent === r.buyClick.want],
    ['영혼 없으면 안 팔림', !r.broke.bought && r.broke.lv === r.broke.was && !r.broke.flash],
  ];
  for (const [what, ok] of checks) console.log(`  ${what.padEnd(20)} ${ok ? 'OK' : '실패'}`);
  console.log(`  (데모가 돈 직업 ${r.demoVaried}종 · 내 선택 ${r.keptOnStart}/${r.keptOnFrames})`);
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no errors');

  const pass = checks.every(c => c[1]) && !errs.length;
  console.log(pass ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();

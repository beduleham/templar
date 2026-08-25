/* 영혼 경제가 무너지지 않는가.

   왜 필요한가: 옛 정산식은 처치 수를 그대로 8로 나눴다. 이 게임의 처치 수는
   시간에 대해 폭발해서 — 봇으로 재 보니 7분에 75,098마리 — 한 판에 9,429영혼이
   들어왔다. 제단 전체가 6,240이었으니 **한 판만 잘 굴리면 제단을 통째로 샀다.**
   화면 어디에도 이상이 없어서 눈으로는 안 잡힌다. 숫자로만 잡힌다.

   확인하는 것:
     1. 처치가 두 배여도 영혼이 두 배가 되지 않는가 (제곱근으로 눌렸는가)
     2. 아주 잘한 판 하나로 제단을 다 살 수 없는가
     3. 그러면서 첫 칸은 첫 판 언저리에 닿는가 (너무 멀면 제단이 없는 것과 같다)
     4. 강화 값이 레벨마다 오르는가 · 총액이 제자리인가
     5. 구입이 표시된 값만큼만 깎는가
     6. 내역(버팀·처치·클리어)의 합이 실제 지급액과 같은가

   실행: node tests/souls.js */
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

  const r = await pg.evaluate(() => {
    Sfx.on = false;
    const keep = { souls: Meta.souls, levels: JSON.parse(JSON.stringify(Meta.levels)) };

    // 판 하나를 흉내 내어 정산만 돌린다
    const payout = (time, kills, won) => {
      Meta.souls = 0;
      Game.time = time; Game.kills = kills; Game.state = won ? 'won' : 'dead';
      Game.endRun();
      return { got: Game.soulsEarned, parts: Game.soulParts };
    };

    const runs = {
      hopeless: payout(25, 8, false),          // 25초에 죽음
      first:    payout(95, 320, false),        // 처음 잡아 보는 사람
      decent:   payout(310, 19000, false),     // 5분
      great:    payout(485, 94669, false),     // 봇이 낸 최고 기록
      huge:     payout(485, 189338, false),    // 처치만 두 배
      clear:    payout(900, 200000, true),     // 15분 클리어
    };

    // 제단 값
    const ladder = ALTAR.map(u => {
      const costs = [];
      for (let l = 0; l < u.max; l++) costs.push(u.cost(l));
      return { key: u.key, name: u.name, costs, sum: costs.reduce((a, c) => a + c, 0) };
    });
    const total = ladder.reduce((a, u) => a + u.sum, 0);
    const first = Math.min(...ALTAR.map(u => u.cost(0)));

    // 구입이 표시된 값만큼만 깎는가
    Meta.souls = 100000; Meta.levels = {};
    const before = Meta.souls, want = Meta.costOf(ALTAR[0]);
    Meta.buy(ALTAR[0].key);
    const charged = before - Meta.souls;
    const lvAfter = Meta.lv(ALTAR[0].key);
    const nextCost = Meta.costOf(ALTAR[0]);

    Meta.souls = keep.souls; Meta.levels = keep.levels; Meta.save();
    return { runs, ladder, total, first, charged, want, lvAfter, nextCost };
  });

  const R = r.runs;
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  console.log('  판                        영혼    제단 전체 대비');
  for (const [k, label, t, ki] of [
    ['hopeless', '25초에 죽음', 25, 8],
    ['first', '1분 35초 · 320마리', 95, 320],
    ['decent', '5분 10초 · 19,000마리', 310, 19000],
    ['great', '8분 05초 · 94,669마리', 485, 94669],
    ['huge', '8분 05초 · 189,338마리', 485, 189338],
    ['clear', '15분 클리어 · 200,000마리', 900, 200000],
  ]) {
    const g = R[k].got;
    console.log(`  ${label.padEnd(24)} ${String(g).padStart(5)}   ${(g / r.total * 100).toFixed(1)}%`);
  }
  console.log('');
  for (const u of r.ladder)
    console.log(`  ${u.name.padEnd(4)} ${u.costs.map(c => String(c).padStart(5)).join('')}   합 ${u.sum}`);
  console.log(`  제단 전체 ${r.total.toLocaleString('ko-KR')} · 첫 칸 ${r.first}`);
  console.log('');

  // 처치를 두 배로 해도 영혼이 두 배가 되면 안 된다 — 그게 옛 식의 문제였다
  const killPart = k => R[k].parts.kills;
  const doubling = killPart('huge') / killPart('great');
  const ladderUp = r.ladder.every(u => u.costs.every((c, i) => i === 0 || c > u.costs[i - 1]));

  const checks = [
    ['처치 두 배 ≠ 영혼 두 배', doubling < 1.6 && doubling > 1.2],
    ['최고의 판도 제단 절반 미만', R.great.got < r.total * .5],
    ['클리어도 제단을 다 못 삼', R.clear.got < r.total * .5],
    ['첫 칸은 두 판 안에 닿음', R.first.got * 2 >= r.first],
    ['가망 없는 판은 거의 안 줌', R.hopeless.got < r.first * .3],
    ['값이 레벨마다 오름', ladderUp],
    ['총액 제자리', r.total === 11570],
    ['표시된 값만큼만 깎음', r.charged === r.want && r.lvAfter === 1],
    ['다음 칸이 더 비쌈', r.nextCost > r.want],
    ['내역 합 = 지급액',
      Object.values(R).every(x => x.parts.time + x.parts.kills + x.parts.win === x.got)],
  ];
  for (const [what, ok] of checks) console.log(`  ${what.padEnd(22)} ${ok ? 'OK' : '실패'}`);
  console.log(`  (처치 2배일 때 처치분 배수 ${doubling.toFixed(2)})`);
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no errors');

  const pass = checks.every(c => c[1]) && !errs.length;
  console.log(pass ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();

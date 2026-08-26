/* 분열체가 무한히 불어나지 않는가.

   실제 플레이 보고: "분열체가 안 죽는데?" 그리고 "전사는 전직 1번만 해도
   분열체를 끝도없이 때릴 수 있어".

   원인은 밸런스가 아니라 객체 재사용이었다. killEnemy 는 e.active = false 로
   시작하는데, 그 안에서 onDeath 가 spawnEnemy 를 부르면 alloc() 이 방금 비운
   바로 그 칸을 돌려준다. 자식이 부모 객체를 덮어쓰고, onDeath 는 그 뒤로
   이미 덮인 e.gen(=0 으로 초기화됨)을 읽는다 —
   그래서 1세대의 자식이 다시 1세대가 되어 세대 제한이 영영 걸리지 않았다.

   계측(고치기 전): 한 마리에서 시작해 201번을 잡아도 201마리가 남아 있었다.
   계측(고친 뒤): 7마리를 잡으면 끝난다 (1 + 2 + 4).

   덤으로, 재사용된 칸 때문에 killEnemy 의 나머지(등급 보상 · 사망 폭발 ·
   역병 확산 · 조합 발동)가 전부 엉뚱한 적의 값으로 계산되고 있었다.

   실행: node tests/regress-splitter.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const r = await pg.evaluate(() => {
    selectedClass = 0; Game.reset(); Game.state = 'playing';
    const out = {};

    // ① 죽인 객체가 그 자리에서 되살아나지 않는가
    for (const e of enemies) e.active = false;
    const p = Game.spawnEnemy('splitter', player.x + 200, player.y);
    killEnemy(p, 'physical');
    out.parentReused = p.active;

    // ② 자식 둘이 같은 세대·같은 체력인가 (한쪽만 약해지면 부모를 덮어쓴 것이다)
    const kids = [];
    for (const e of enemies) if (e.active) kids.push({ gen: e.gen, hp: Math.round(e.maxHp) });
    out.kids = kids;
    out.symmetric = kids.length === 2 && kids[0].gen === kids[1].gen && kids[0].hp === kids[1].hp;

    // ③ 한 마리에서 시작해 전부 잡으면 끝나는가
    for (const e of enemies) e.active = false;
    Game.spawnEnemy('splitter', player.x + 200, player.y);
    let kills = 0;
    while (kills < 500) {
      let any = null;
      for (const e of enemies) if (e.active) { any = e; break; }
      if (!any) break;
      killEnemy(any, 'physical'); kills++;
    }
    out.kills = kills;
    let left = 0; for (const e of enemies) if (e.active) left++;
    out.left = left;

    // ④ 등급 보상이 죽은 적의 등급으로 판정되는가
    //    (칸이 재사용되면 자식(common)의 등급을 보고 희귀 보상이 사라진다)
    for (const e of enemies) e.active = false;
    const rare = Game.spawnEnemy('splitter', player.x + 200, player.y, RANKS.rare);
    const wantRank = rare.rank;
    killEnemy(rare, 'physical');
    out.rankKept = rare.rank === wantRank;
    return out;
  });

  const ok = !r.parentReused && r.symmetric && r.kills === 7 && r.left === 0 && r.rankKept
             && errs.length === 0;
  console.log(`  죽인 객체 재사용   ${r.parentReused ? '예 ← 문제' : '아니오'}`);
  console.log(`  자식 대칭          ${r.symmetric ? 'OK' : '깨짐 ' + JSON.stringify(r.kids)}`);
  console.log(`  한 마리 → 총 처치  ${r.kills} (기대 7 = 1+2+4) · 남은 ${r.left}`);
  console.log(`  등급 유지          ${r.rankKept ? 'OK' : '깨짐 ← 희귀 보상이 사라진다'}`);
  if (errs.length) console.log('  ' + errs[0].slice(0, 90));
  console.log(ok ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(ok ? 0 : 1);
})();

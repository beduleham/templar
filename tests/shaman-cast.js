/* 회귀: 주술사의 네 프레임이 시전 타이머를 따라가는가.

   주술사는 공격을 안 한다. 3.2초마다 반경 240px 안의 적을 25% 회복시키고
   가속시킬 뿐이다. 그래서 플레이어가 이 몹을 보고 내려야 하는 판단은
   "저놈부터 잡아야 하나" 하나뿐이고, 그 근거는 **다음 회복까지 얼마나 남았나** 다.

   네 장(대기·모음·충전·치켜듦)을 걸음 속도로 돌리면 3.2초 동안 구슬이 두 바퀴
   차올랐다 꺼진다. 그럼 그림이 알려주는 게 아무것도 없다. 그래서
   `e.anim = (3.2 - e.t1) / 3.2 * .5` 로 타이머에 묶었다.

   이 테스트가 지키는 것:
     1) 네 장이 고르게 나온다 — 한 장에 몰리면 램프가 깨진 것이다.
     2) 회복이 터지는 순간은 언제나 마지막 장(치켜듦)이 끝나는 지점이다.
     3) 시전 간격이 3.2초다.

   주의 — 이 테스트를 처음 쓸 때 두 번 헛짚었다.
     · 적이 죽으면 `dying` 이 되고 anim 이 얼어붙는다. hp 만 채워선 안 되고
       `dying` 을 같이 봐야 한다.
     · 레벨업 화면이 뜨면 `update()` 가 통째로 멈춘다. 20초를 돌리면 반드시
       걸리므로 매 프레임 state 를 'playing' 으로 되돌려야 한다.
   둘 다 게임이 아니라 테스트가 틀린 것이었다. */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForTimeout(400);

  const r = await pg.evaluate(() => {
    Game.reset(); Game.state = 'playing';
    for (const e of enemies) e.active = false;
    const sh = Game.spawnEnemy('shaman', player.x + 700, player.y, RANKS.common);
    player.base.maxHp = 1e7; recomputeStats(); player.hp = 1e7;
    const idx = e => Math.floor(e.anim * 8) % 4;
    const out = { count: [0, 0, 0, 0], atCast: {}, at: [], frames: 0, died: false };
    for (let i = 0; i < 60 * 20; i++) {
      if (Game.state !== 'playing') Game.state = 'playing';
      player.hp = 1e7; sh.hp = sh.maxHp;
      const t0 = sh.t1;
      update(1 / 60);
      if (!sh.active || sh.dying) { out.died = true; break; }
      out.frames++; out.count[idx(sh)]++;
      if (sh.t1 > t0) {
        const k = idx(sh); out.atCast[k] = (out.atCast[k] || 0) + 1;
        out.at.push(out.frames);            // 몇 번째 프레임에 터졌는지 그대로 담는다
      }
    }
    return out;
  });
  await b.close();

  const name = ["대기", "모음", "충전", "치켜듦"];
  const pct = r.count.map(n => n / r.frames * 100);
  console.log(`${r.frames}프레임(${(r.frames / 60).toFixed(1)}초) 관측, 도중사망=${r.died}`);
  console.log("프레임 노출  " + pct.map((p, i) => `${i} ${name[i]} ${p.toFixed(1)}%`).join(" · "));
  /* 간격은 '전체 시간 / 시전 횟수' 로 재면 안 된다. 첫 시전은 스폰 때
     t1 = rnd(.4, 1.6) 에서 출발하므로 3.2초를 안 기다린다. 20초에 6번 터질
     때와 7번 터질 때가 둘 다 정상인데, 그 나눗셈은 3.33초와 2.86초를 내놓는다
     (실제로 이 테스트가 그 이유로 한 번 거짓 실패했다). 연속한 두 시전
     사이만 재야 한다. */
  const gaps = r.at.slice(1).map((v, i) => (v - r.at[i]) / 60);
  const gLo = Math.min(...gaps), gHi = Math.max(...gaps);
  console.log(`시전 ${r.at.length}회, 연속 간격 ${gLo.toFixed(2)}~${gHi.toFixed(2)}초`);
  console.log("시전이 터진 순간의 프레임: " + JSON.stringify(r.atCast));

  const bad = [];
  if (errs.length) bad.push("예외: " + errs.join(" / "));
  if (r.died) bad.push("주술사가 도중에 죽어 관측이 끊겼다");
  pct.forEach((p, i) => { if (p < 18 || p > 32) bad.push(`${i}번(${name[i]}) 노출 ${p.toFixed(1)}% — 25% 에서 너무 벗어났다`); });
  if (gaps.length < 4) bad.push(`시전이 ${r.at.length}회뿐이라 간격을 못 잰다`);
  else if (gLo < 3.1 || gHi > 3.3) bad.push(`시전 간격 ${gLo.toFixed(2)}~${gHi.toFixed(2)}초 (3.2초여야 한다)`);
  /* 시전은 마지막 장이 끝나는 순간에 일어나므로, 그 프레임에 이미 anim 은 0 으로
     되돌아가 있다 — 즉 관측되는 인덱스는 0 이다. 다른 값이 섞이면 램프가 어긋난 것이다. */
  const keys = Object.keys(r.atCast);
  if (keys.length !== 1 || keys[0] !== "0") bad.push("시전 순간의 프레임이 일정하지 않다: " + JSON.stringify(r.atCast));

  if (bad.length) { console.error("\n실패:\n  " + bad.join("\n  ")); process.exit(1); }
  console.log("\n통과");
})();

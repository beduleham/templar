/* 계측용 봇 — 여러 테스트가 같이 쓴다.

   왜 저장소 안에 두는가: 예전에는 이 소스가 임시 폴더의 계측 스크립트 안에 있었고
   tests/regress-levelup-spam.js 가 그 파일을 읽어 썼다. 그 임시 파일을 덮어쓴 날
   게임은 멀쩡한데 테스트만 죽었다. 테스트가 저장소 밖을 읽으면 안 된다.

   봇의 성격이 결과를 완전히 바꾼다. 어트랙트 데모의 봇은 '보여주기'용이라 적을
   피하기만 해서 5분에 4마리를 잡고 1레벨로 죽는다 — 그 수치로 밸런스를 보면 전부 틀린다.
   여기 있는 봇은 '붙지는 않되 사거리 안에 둔다'. 사람만큼 잘하지는 않지만,
   싸우기는 한다.

   ■ 이 봇으로 재면 안 되는 것(kite 성격일 때): 근접 무기, 그리고 전사. 전사는 'melee' 성격이 따로 있다(botStyle).

   botSteer 는 반경 95 안에 적이 있는 방향에 -9 점을 준다. 즉 일부러 거리를 벌린다.
   그런데 쇠사슬 플레일은 1레벨 사거리가 92 이고 바라보는(=걷는) 방향으로만 나간다.
   봇이 도망치는 쪽으로 후려치니 허공만 친다.

   실제로 전사를 8판 돌리면 7판이 5분 내내 1레벨 · 3~13킬로 끝난다
   (나머지 한 판만 1241킬/10레벨). 코드가 아니라 봇을 재고 있는 것이다 —
   이 편차로 A/B 를 하면 어떤 결론이든 나온다. 실제로 같은 코드가
   '분당 피해 -24%' 와 '+170%' 를 둘 다 냈다.

   씨앗을 고정해도 해결되지 않는다. 두 빌드가 한 프레임이라도 달라지는 순간
   그 뒤가 통째로 다시 굴려지기 때문이다(같은 씨앗이 한쪽 4킬, 다른 쪽 1801킬).

   근접 무기나 전사의 밸런스를 재려면 붙어서 싸우는 봇이 따로 있어야 한다.

   쓰는 법 (페이지 안에서 eval 한 뒤):
     botInstall();            // inputVector 를 가로챈다
     매 프레임: botTick(dt);   // 방향을 다시 고르고 스킬을 쓴다
     botRestore();            // 원래대로 돌린다 */
const BOT = `
let __botX = 1, __botY = 0, __botT = 0, __botSkillT = 0, __botRealInput = null;

/* 두 성격. 'kite'(기본) 는 거리를 벌리고 사거리 안에 둔다. 'melee' 는 전사용 —
   쇠사슬 플레일은 바라보는(=걷는) 방향으로 92 만큼 나가므로 **적 쪽으로 걸어야 맞는다.**
   그래서 적이 60~140 에 있는 방향에 점수를 주고, 40 안(겹침)과 아무도 없는 쪽은 깎는다.
   체력이 35% 밑이면 kite 로 돈다 — 사람도 그때는 물러선다. 성격은 직업이 정한다. */
function botStyle() {
  if (typeof botStyleOverride === "string") return botStyleOverride;   // 진단용 — 성격을 고정한다
  /* 전사도 kite 다. 플레일이 1레벨부터 앞·뒤 두 부채꼴을 치게 된 뒤로는(§밸런스 2차) 물러서면서
     뒤를 치는 쪽이 붙는 쪽보다 오래 산다(실측 60초 생존·80킬 대 48초·75킬). 'melee' 는
     겨눔 성격으로 남겨 두고 botStyleOverride 로만 켠다. */
  return "kite";
}
function botSteer() {
  const style = botStyle();
  if (style === "melee") {
    /* 근접은 '겨눔'이다. 점수 매긴 탐침 방향으로 걸으면 부채꼴(±0.62rad)이 적을 빗나간다 —
       실측 한 번 휘둘러 0.58 마리. 160 안 적들의 무게중심을 향해 걷고(플레일은 걷는 방향으로
       나간다), 30 안에 붙었거나 체력이 절반 밑이면 그 반대로 물러선다. 아무도 없으면 가장
       가까운 적으로 간다. */
    const near = hash.query(player.x, player.y, 320, scratch3);
    let cx = 0, cy = 0, n = 0, nx = 0, ny = 0, nd = 1e9;
    for (let j = 0; j < near.length; j++) {
      const e = near[j]; if (!e.active) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < 160) { cx += e.x; cy += e.y; n++; }
      if (d < nd) { nd = d; nx = e.x; ny = e.y; }
    }
    let tx, ty;
    if (n) { tx = cx / n - player.x; ty = cy / n - player.y; }
    else if (nd < 1e9) { tx = nx - player.x; ty = ny - player.y; }
    else { tx = -player.x; ty = -player.y; }                  // 아무도 없으면 원점 쪽으로
    const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
    if (nd < 30) { tx = -tx; ty = -ty; }                      // 겹치면 한 걸음 물러선다
    __botX = tx; __botY = ty;
    return;
  }
  let best = 0, bestScore = -1e9;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU;
    const tx = player.x + Math.cos(a) * 150, ty = player.y + Math.sin(a) * 150;
    let s = -Math.hypot(tx, ty) * .02;            // 원점에서 너무 멀어지지 않게
    const near = hash.query(tx, ty, 300, scratch3);
    let cnt = 0;
    for (let j = 0; j < near.length; j++) {
      const e = near[j];
      if (!e.active) continue;
      const d = Math.hypot(e.x - tx, e.y - ty);
      if (style === "melee") {
        if (d < 40) s -= 4;                        // 겹치면 둘러싸인다
        else if (d < 140) { s += 2; cnt++; }       // 플레일 사거리 — 여기가 이득
        else if (d < 280) s += .3;
      } else {
        if (d < 95) s -= 9;                        // 붙으면 죽는다
        else if (d < 280) s += 1.1;                // 사거리 안이면 이득
      }
    }
    if (style === "melee" && cnt > 8) s -= (cnt - 8) * 1.2;    // 여덟 넘는 무리에는 안 들어간다 — 한 번에 부채꼴 하나만 친다
    if (s > bestScore) { bestScore = s; best = a; }
  }
  __botX = Math.cos(best); __botY = Math.sin(best);
}

function botInstall() {
  if (__botRealInput) return;
  __botRealInput = inputVector;
  inputVector = () => ({ x: __botX, y: __botY });
}
function botRestore() {
  if (__botRealInput) { inputVector = __botRealInput; __botRealInput = null; }
}
/* 자세를 쓰는 봇.

   성기사와 마법사는 '멈춰야' 힘이 나온다. 늘 움직이는 봇으로 재면 그 직업의 설계를
   통째로 빼놓고 재는 셈이다 — 마법사는 3단계 영창(피해 ×1.78 · 쿨다운 ×0.7 ·
   흡인 ×4.8 · 서리막)을 한 번도 못 얻는다. 그걸 두고 '약하다'고 하면 안 된다.

   그래서 안전할 때는 선다. 무엇이 안전인지는 직업마다 다르다 —
   마법사는 '가까이 아무도 없을 때', 성기사는 반대로 '둘러싸였을 때'다. */
function botHold() {
  if (!player.cls) return false;
  const near = hash.query(player.x, player.y, 260, scratch3);
  let close = 0, nearest = 1e9;
  for (let i = 0; i < near.length; i++) {
    const e = near[i];
    if (!e.active) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < nearest) nearest = d;
    if (d < 190) close++;
  }
  /* 마법사는 '적이 없을 때 멈춘다'로 두면 영영 못 멈춘다 — 계측해 보니 1분이 지나면
     반경 210 안이 비는 시간이 0% 다. 설계가 말하는 리듬은 그게 아니라
     '버틸 수 있는 동안 자리를 지키고, 위험하면 물러선다' 다. 그렇게 몬다. */
  if (player.cls.key === "mage")
    return player.hp > player.stats.maxHp * .6 && close < 6 && nearest > 90;
  if (player.cls.key === "paladin") return close >= 3 && player.hp > player.stats.maxHp * .45;
  return false;                                             // 전사·추적자는 계속 움직인다
}

function botTick(dt, useStance) {
  __botT -= dt; __botSkillT -= dt;
  if (__botT <= 0) { __botT = botStyle() === "melee" ? .12 : .25 + Math.random() * .35; botSteer(); }
  if (useStance && botHold()) { __botX = 0; __botY = 0; }
  if (__botSkillT <= 0 && player.cls && player.res >= curSkill().cost) {
    __botSkillT = .5; useSkill();
  }
}
`;

module.exports = { BOT };

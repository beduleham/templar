/* 계측용 봇 — 여러 테스트가 같이 쓴다.

   왜 저장소 안에 두는가: 예전에는 이 소스가 임시 폴더의 계측 스크립트 안에 있었고
   tests/regress-levelup-spam.js 가 그 파일을 읽어 썼다. 그 임시 파일을 덮어쓴 날
   게임은 멀쩡한데 테스트만 죽었다. 테스트가 저장소 밖을 읽으면 안 된다.

   봇의 성격이 결과를 완전히 바꾼다. 어트랙트 데모의 봇은 '보여주기'용이라 적을
   피하기만 해서 5분에 4마리를 잡고 1레벨로 죽는다 — 그 수치로 밸런스를 보면 전부 틀린다.
   여기 있는 봇은 '붙지는 않되 사거리 안에 둔다'. 사람만큼 잘하지는 않지만,
   싸우기는 한다.

   ■ 이 봇으로 재면 안 되는 것: 근접 무기, 그리고 전사.

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

function botSteer() {
  let best = 0, bestScore = -1e9;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU;
    const tx = player.x + Math.cos(a) * 150, ty = player.y + Math.sin(a) * 150;
    let s = -Math.hypot(tx, ty) * .02;            // 원점에서 너무 멀어지지 않게
    const near = hash.query(tx, ty, 300, scratch3);
    for (let j = 0; j < near.length; j++) {
      const e = near[j];
      if (!e.active) continue;
      const d = Math.hypot(e.x - tx, e.y - ty);
      if (d < 95) s -= 9;                          // 붙으면 죽는다
      else if (d < 280) s += 1.1;                  // 사거리 안이면 이득
    }
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
  if (__botT <= 0) { __botT = .25 + Math.random() * .35; botSteer(); }
  if (useStance && botHold()) { __botX = 0; __botY = 0; }
  if (__botSkillT <= 0 && player.cls && player.res >= curSkill().cost) {
    __botSkillT = .5; useSkill();
  }
}
`;

module.exports = { BOT };

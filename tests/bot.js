/* 계측용 봇 — 여러 테스트가 같이 쓴다.

   왜 저장소 안에 두는가: 예전에는 이 소스가 임시 폴더의 계측 스크립트 안에 있었고
   tests/regress-levelup-spam.js 가 그 파일을 읽어 썼다. 그 임시 파일을 덮어쓴 날
   게임은 멀쩡한데 테스트만 죽었다. 테스트가 저장소 밖을 읽으면 안 된다.

   봇의 성격이 결과를 완전히 바꾼다. 어트랙트 데모의 봇은 '보여주기'용이라 적을
   피하기만 해서 5분에 4마리를 잡고 1레벨로 죽는다 — 그 수치로 밸런스를 보면 전부 틀린다.
   여기 있는 봇은 '붙지는 않되 사거리 안에 둔다'. 사람만큼 잘하지는 않지만,
   싸우기는 한다.

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
function botTick(dt) {
  __botT -= dt; __botSkillT -= dt;
  if (__botT <= 0) { __botT = .25 + Math.random() * .35; botSteer(); }
  if (__botSkillT <= 0 && player.cls && player.res >= curSkill().cost) {
    __botSkillT = .5; useSkill();
  }
}
`;

module.exports = { BOT };

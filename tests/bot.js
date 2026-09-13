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
     카드가 뜨면: botPick();   // 규칙대로 한 장 고른다(§152). 안 쓰면 화면이 안 넘어간다
     botRestore();            // 원래대로 돌린다

   ■ 손잡이는 전부 globalThis.botCfg 에 있다. eval 안에 let 으로 두면 밖에서 못 바꾸고,
     못 바꾼 줄 모른 채 A/B 를 하면 같은 값이 두 번 나온다(§152 에서 실제로 그랬다).

   ■ 값을 견줄 때: 생존 시간의 표준편차는 직업에 따라 54~89초다(n=16). 세 판 돌려
     나온 1분 차이는 결과가 아니라 잡음이다. */
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
  /* ── 갈 곳 ──
     봇은 여태 **가까운 적만** 보고 걸었다. 목적지가 없으니 제단에 영영 안 간다.
     재서 알았다: 15분을 안 죽게 굴려도 징표 0 · 전직 0/4 였다. 막는 것은 고르기도
     생존도 조작도 아니라 **가지러 가지 않는 것**이었다.

     징표가 없으면 가장 가까운 안 연 제단 쪽에 점수를 준다. 징표를 얻을 때까지
     끌림이 살아 있으므로, 도착한 뒤 파수꾼과 싸우는 동안에도 그 자리를 지킨다. */
  let gx = 0, gy = 0, gw = 0, gd0 = 0;
  /* 몇 개가 필요한지는 차수가 정한다(1·2·3·4). 「하나도 없으면」으로 두면
     1차를 연 뒤로는 다시 제단에 안 간다 — 2차부터가 통째로 안 열린다. */
  const needSig = ADV_SIGILS[Math.min(player.advance.length, ADV_SIGILS.length - 1)] || 1;
  if (botCfg.seekSigil && player.sigils < needSig) {
    /* 땅에 떨어진 징표가 먼저다. 징표는 파수꾼이 죽은 자리에 **떨어지는 물건**이라
       주우러 가야 한다 — 제단만 찾아가게 했더니 제단을 여섯 개 열고도 징표가 0 이었다.
       잡는 것과 줍는 것은 다른 일이다. */
    let sig = null, sd = 1e9;
    for (const pk of pickups) {
      if (!pk.active || pk.kind !== "sigil") continue;
      const d = Math.hypot(pk.x - player.x, pk.y - player.y);
      if (d < sd) { sd = d; sig = pk; }
    }
    if (sig) { gx = sig.x; gy = sig.y; gw = botCfg.seekPull * 3; }
    else if (typeof nearestShrine === "function") {
      const sh = nearestShrine();
      if (sh) { gx = sh.x; gy = sh.y; gw = botCfg.seekPull; }
    }
    if (gw) gd0 = Math.hypot(gx - player.x, gy - player.y);
  }
  let best = 0, bestScore = -1e9;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU;
    const tx = player.x + Math.cos(a) * 150, ty = player.y + Math.sin(a) * 150;
    let s = -Math.hypot(tx, ty) * .02;            // 원점에서 너무 멀어지지 않게
    // 목적지에 가까워지는 방향에 점수 — 150px 만큼 좁히면 +gw
    if (gw) s += gw * (gd0 - Math.hypot(gx - tx, gy - ty)) / 150;
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

/* ── 카드 고르기 ──────────────────────────────────────────────────────────
   여태 이 일은 **검사마다 따로** 하고 있었다. choices[0] 을 집는 곳이 넷,
   회복만 피하는 곳이 셋, 계통을 박아 둔 곳이 하나 — 같은 게임을 서로 다른
   플레이어로 재고 있었다. 그중 choices[0] 은 플레이어가 아니라 **아무거나**다.

   무엇이 걸려 있나: 첫 장만 집으면 무기를 안 모으고 조합이 안 열린다.
   조합은 두 원소 무기를 각각 4레벨까지 올려야 열리는데, 첫 장 집기는 그걸
   맞출 이유가 없다. 그 상태로 잰 생존 시간은 이 게임의 값이 아니다.

   규칙은 사람이 하는 순서다.
     1. 위험하면 회복      — 체력 35% 밑이고 회복 카드가 있으면
     2. 특성은 그냥 받는다  — 트랙이 따로라(3레벨마다) 무기와 경쟁하지 않는다
     3. 무기를 몇 개 모은다 — 아래 botNewWeapons 까지만. 여덟 개를 1레벨씩
                            모으면 조합이 하나도 안 열린다
     4. 조합을 여는 강화    — 두 원소 중 **낮은 쪽**을 올린다. 가장 가까운 조합부터
     5. 그 외에는 집중      — 가장 레벨 높은 무기를 올린다
     6. 능력 → 남은 것      — 회복은 맨 마지막

   전직은 취향의 문제라 규칙을 못 세운다. 기본은 판의 난수로 고른다 —
   씨앗이 박힌 검사에서는 그대로 되풀이된다. 계통을 정하고 싶으면
   botCfg.advLine 에 키를 넣는다. */
/* 손잡이는 **전역 물체**에 둔다. 처음엔 let 으로 뒀는데 밖에서 바꿔도 안 먹었다 —
   이 파일은 검사 안에서 eval 되고, eval 안의 let 은 그 eval 만의 칸에 갇힌다.
   그래서 검사가 botNewWeapons = 6 이라고 써도 봇은 3 을 보고 있었다(무기 6 으로
   줘도 결과가 한 글자도 안 바뀌어서 알았다). 손잡이는 돌아가는지 확인하고 쓴다. */
globalThis.botCfg = globalThis.botCfg || {
  newWeapons: 3,        // 새 무기를 몇 개까지 받나
  passivePer: 1,        // 무기 몇 개당 능력 하나를 맞춰 가나 (0 이면 능력을 뒤로 민다)
  advLine: null,        // 전직 계통을 박고 싶을 때 키 배열
  /* 걸음걸이를 바꾸는 손잡이는 **꺼진 채로** 온다. 켜 놓았더니 sigil-guide 가
     깨졌다. 그 검사는 씨앗을 안 박으므로 한 번 깨진 것만으로는 탓을 못 하니
     열여덟 판씩 재어 봤다 — 「2:30 에 가장 가까운 안 연 제단」이

       끄면  208 ~ 1206u  (문턱 1300, 18/18 통과)
       켜면   17 ~  174u  가 17판, 그리고 **1514u 가 한 판**

     이다. 대개는 제단 위에 서 있지만, 근처를 이미 다 먹은 판에서는 다음 제단이
     멀다 — 꼬리가 문턱을 넘는다. 그 검사가 묻는 것은 제단 배치이지 봇이 아닌데
     선수를 바꾸니 재는 대상이 같이 움직였다. **공용 자를 말없이 바꾸면, 그 자로
     이미 맞춰 둔 문턱이 전부 거짓말이 된다.** 필요한 검사가 스스로 켠다.
     (덧붙여, 끈 쪽의 최대 1206u 도 문턱 1300 에 8%밖에 안 남았다.) */
  seekSigil: false,     // 징표가 없으면 가까운 제단으로 걸어간다 (adv-gate 가 켠다)
  seekPull: 7,          // 그 끌림의 세기 — 적 점수와 겨룬다
};
function botElemLv(el) {
  let lv = 0;
  for (const w of player.weapons) if (WEAPONS[w.key].element === el) lv = Math.max(lv, w.level);
  return lv;
}
function botPick() {
  const C = Game.choices;
  if (!C || !C.length) return null;
  let c = null;
  if (C[0].tier) {                                        // 전직 화면
    if (botCfg.advLine) c = C.find(a => botCfg.advLine.includes(a.key));
    c = c || pick(C);
  } else {
    const heal = player.hp < player.stats.maxHp * .35 && C.find(a => a.type === "heal");
    const trait = C.find(a => a.type === "trait");
    const newW = C.find(a => a.type === "weapon" && a.isNew);
    const upW = C.filter(a => a.type === "weapon" && !a.isNew).sort((x, y) => y.level - x.level)[0];
    /* 조합을 여는 강화. 두 원소를 다 들고 있고 아직 안 열린 조합 중,
       문턱까지 가장 가까운 것의 **낮은 쪽** 원소를 올린다. */
    let combo = null, gap = 99;
    for (const cb of COMBOS) {
      const la = botElemLv(cb.a), lb = botElemLv(cb.b);
      if (!la || !lb || Math.min(la, lb) >= COMBO_LEVEL) continue;
      const lowEl = la <= lb ? cb.a : cb.b;
      const card = C.find(a => a.type === "weapon" && !a.isNew && WEAPONS[a.key].element === lowEl);
      if (!card) continue;
      const g = COMBO_LEVEL - Math.min(la, lb);
      if (g < gap) { gap = g; combo = card; }
    }
    /* 능력을 무기 **뒤로** 미는 규칙을 먼저 써 봤다가 되돌렸다. 첫 장 집기보다
       평균 생존이 4:11 → 3:25 로 떨어졌고 마법사는 4:05 → 1:48 이었다.
       이유는 재고 보니 분명했다: 방어·체력·재생이 전부 무기 강화 뒤로 밀려서
       봇이 맨몸으로 후반을 맞았다. 사람은 그렇게 안 고른다 —
       **무기 수만큼 능력도 맞춰 간다.** */
    const passive = C.find(a => a.type === "passive");
    const wantPassive = botCfg.passivePer > 0
      && player.passives.length < player.weapons.length * botCfg.passivePer;
    c = heal || trait
      || (player.weapons.length < botCfg.newWeapons && newW)
      || (wantPassive && passive)
      || combo || upW || passive || newW
      || C.find(a => a.type !== "heal") || C[0];
  }
  Game.applyChoice(c);
  return c;
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

/* 회귀: HUD 의 글자들이 서로를 뭉개지 않는가.

   ── 무엇이 문제였나

   붐비는 판 한 프레임을 찍어 글자 상자를 전부 재 보니, 겹친 쌍이 256개였다.
   갈래로 나누니 원인이 하나가 아니었다.

     204쌍  피해 숫자끼리 — 타격마다 같은 자리에 새로 띄우고(`rnd(-6,6)` 은
            글자 폭보다 좁다) 전부 같은 속도로 곧게 올라가 영영 안 갈라졌다.
      51쌍  몹 이름표 ↔ 피해 숫자 — 이름표는 다른 이름표만 피하고
            숫자는 몰랐다. 둘 다 몹 머리 위 같은 자리를 노린다.
       1쌍  지형지물 표지 ↔ 아래 슬롯 — 표지가 화면 가장자리 46~58px 링에
            붙는데 HUD 판이 정확히 그 링 위에 있다.

   그리고 위 중앙 띠는 따로다. 시계·보스 체력·미션·전직 알림·토스트 다섯이
   각자 y 를 박아 두고 있었는데, **미션 배너에 상태가 둘**이라(막 뜨면 150,
   가라앉으면 82) 82 일 때 보스 체력바(64~80)와 전직 알림(108·128)을 통째로
   뚫고 지나갔다.

   ── 장면을 고정해야 한다

   살아 있는 판을 굴려 재면 스폰·치명타·무기 굴림이 매번 달라, 같은 코드로도
   33쌍과 106쌍이 나온다. 앞뒤를 견줄 수 없다. 그래서 씨앗을 고정하고 적을
   격자로 세워 정해진 피해를 넣는다.

   ── 미션 상태를 둘 다 봐야 한다

   처음 검사는 큰 상태만 보고 「겹침 없음」을 냈다. 그 사이 화면에서는 세 줄이
   겹쳐 있었다. 상태가 있는 채널은 상태마다 재야 한다.

   실행: node tests/hud-overlap.js */
const { chromium } = require('playwright');

const CAPTURE = `(() => {
  const boxes = [];
  const map = (x, y) => { const t = ctx.getTransform();
    return { x: x*t.a + y*t.c + t.e, y: x*t.b + y*t.d + t.f, k: t.a }; };
  const _t = ctx.fillText.bind(ctx);
  ctx.fillText = function (t, x, y) {
    const p = map(x, y), m = ctx.measureText(t);
    const fs = (parseFloat((ctx.font.match(/(\\d+(?:\\.\\d+)?)px/) || [0,14])[1]) || 14) * p.k;
    /* 상자는 **재서** 잡는다. 예전에는 글꼴 크기로 어림했다 —
       위쪽을 글꼴×0.58(middle 기준)로 보고 높이를 글꼴×1.16 으로 두었다.
       한글 굵은 글씨는 그렇지 않다: 「24레벨」 700 11px 의 실제 윗높이는 10.0px,
       곧 글꼴×0.91 이다. 어림이 3.6px 짧으니 화면 맨 위 글자가 실제로는 위로
       3px 잘려 나가 있는데도 검사는 안쪽에 있다고 읽었다(§147 에서 눈으로 찾았다).
       actualBoundingBox* 는 textAlign·textBaseline 을 이미 반영한 값이라
       맞춤을 따로 계산할 필요도 없다 — 어림 두 줄이 통째로 사라진다. */
    const x0 = p.x - m.actualBoundingBoxLeft * p.k, x1 = p.x + m.actualBoundingBoxRight * p.k;
    const y0 = p.y - m.actualBoundingBoxAscent * p.k, y1 = p.y + m.actualBoundingBoxDescent * p.k;
    if (String(t).trim())
      boxes.push({ t: String(t).slice(0,26), x: x0, y: y0, w: Math.max(1, x1-x0), h: Math.max(1, y1-y0), fs: +fs.toFixed(0) });
    return _t.apply(null, arguments);
  };
  frame(performance.now());
  ctx.fillText = _t;
  return boxes;
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  let bad = 0;

  /* 페이지를 여는 순간부터 게임의 rAF 루프를 막는다(§130).

     evaluate 안에서만 막으면 이미 늦다 — 페이지를 열고 Sprites 가 준비될 때까지
     루프가 **제 속도로** 돌고, 그동안 몇 프레임이 지나갔는지가 판마다 다르다.
     그 차이가 어트랙트 데모의 상태로 남아 재는 장면을 흔들었다(같은 코드로 띠가
     8·9·10줄). Sprites.ready 는 이미지 onload 로 서므로 rAF 없이도 준비된다.

     프레임은 아래에서 시계를 쥐고 직접 넘긴다 — 이 파일이 재는 것은 애니메이션이
     아니라 **한 프레임의 배치**다. */
  const newPage = async (vw, vh) => {
    const pg = await b.newPage({ viewport: { width: vw, height: vh } });
    await pg.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await pg.goto('file:///home/user/templar/game/index.html');
    await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
    return pg;
  };

  // ── 1. 붐비는 고정 장면에서 겹친 쌍
  {
    const pg = await newPage(1440, 860);
    const r = await pg.evaluate(async (CAP) => {
      let seed = 12345;
      Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      /* 프레임은 시계를 쥐고 넘긴다(§130). rAF 로 넘기면 판이 무거울 때 실제로
         그려지는 수가 달라지는데, 지형 표지는 **지난 프레임의 HUD 자리**를 보고
         비키므로 프레임 수가 흔들리면 재는 장면 자체가 흔들린다 — 혼자 돌려도
         띠가 12번 중 2번 10줄이 아니라 9줄이었다. 넘기는 동안은 frame() 이 자기를
         다시 예약하는 것을 막는다. 안 막으면 부른 만큼 루프가 불어나 화면 밖에서
         계속 돌고, 그 부하가 다시 다음 장면을 흔든다. */
      let ft = 1e6;
      /* 고정 타임스텝 누산기(acc)를 비운다. 프레임 수를 고정해도 이것이 남아
         있으면 **한 프레임에 update 가 두 번** 돌 수 있다 — 실제로 Game.time 이
         430.05 와 430.07 로 갈렸고, 그 한 번 차이로 적이 더 나와 띠가 8·9·10줄을
         오갔다. 넘기는 간격도 STEP 과 정확히 같게 준다(16.7 로 주면 조금씩 밀려
         누산기가 언젠가 넘친다). */
      acc = 0;
      const DT = 1000 / 60;
      const step = () => { last = ft; ft += DT; frame(ft); };
      selectedClass = 0; Game.reset(); Game.state = 'playing';
      player.base.maxHp = 1e9; recomputeStats(); player.hp = 1e9;
      Game.time = 430;
      for (const e of enemies) e.active = false;
      const KINDS = ['zombie','ghost','archer','hound','brute','shield'], E = [];
      for (let i = 0; i < 28; i++) {
        const a = i/28*TAU*3, rr = 70 + (i%5)*34;
        const e = Game.spawnEnemy(KINDS[i%6], player.x+Math.cos(a)*rr, player.y+Math.sin(a)*rr, RANKS.common);
        if (e) { e.think = () => {}; e.spd = 0; e.hp = 1e9; e.maxHp = 1e9; E.push(e); }
      }
      const keep = new Set(E);
      for (let f = 0; f < 24; f++) {
        for (const e of enemies) if (!keep.has(e)) e.active = false;
        for (const e of E) { e.spd = 0; e.hp = 1e9;
          damageEnemy(e, 14 + (f%4)*9, e.x+20, e.y, 0, ['physical','fire','holy'][f%3]); }
        if (Game.state !== 'playing') Game.state = 'playing';
        step();
      }
      for (const e of enemies) if (!keep.has(e)) e.active = false;
      const boxes = eval(CAP);
      const kind = q => /^-?\d[\d,]*$/.test(q.t) ? '피해 숫자'
        : q.fs <= 10 && /m$/.test(q.t) ? '지형 표지'
        : q.fs <= 10 ? '몹 이름표'
        : q.y < 210 && q.x + q.w > W*.25 && q.x < W*.75 ? '위 중앙'
        : q.x < 340 && q.y < 210 ? '왼쪽 위' : q.y > H-130 ? '아래 줄' : '기타';
      const pairs = {}; let n = 0;
      for (let i = 0; i < boxes.length; i++) for (let j = i+1; j < boxes.length; j++) {
        const A = boxes[i], B = boxes[j];
        const w = Math.min(A.x+A.w, B.x+B.w) - Math.max(A.x, B.x);
        const h = Math.min(A.y+A.h, B.y+B.h) - Math.max(A.y, B.y);
        if (w <= 0 || h <= 0) continue;
        if (w*h / Math.min(A.w*A.h, B.w*B.h) <= .20) continue;
        n++;
        const k = [kind(A), kind(B)].sort().join(' ↔ ');
        pairs[k] = (pairs[k] || 0) + 1;
      }
      // 화면 밖으로 나간 글자 — 표지를 HUD 밖으로 밀다 잘리는 사고를 잡는다
      const off = boxes.filter(q => q.y < -2 || q.y + q.h > H + 2 || q.x < -2 || q.x + q.w > W + 2)
                       .map(q => `${q.t} @ ${Math.round(q.x)},${Math.round(q.y)}`);
      return { texts: boxes.length, overlaps: n, pairs, off };
    }, CAPTURE);
    console.log(`붐비는 고정 장면 — 글자 ${r.texts}개 · 겹침 ${r.overlaps}쌍`);
    for (const [k, v] of Object.entries(r.pairs).sort((a,b) => b[1]-a[1])) console.log(`    ${String(v).padStart(4)}  ${k}`);
    /* 자는 고친 뒤의 값에서 잡는다. 남은 겹침은 촘촘히 붙은 적들의 숫자가
       떠오르며 스치는 것이라 0 이 될 수 없다(4~6쌍에서 오르내린다). */
    if (r.overlaps > 14) { console.log(`!! 겹침이 ${r.overlaps}쌍이다 (고친 뒤 4~6쌍이었다)`); bad++; }
    const nm = r.pairs['몹 이름표 ↔ 피해 숫자'] || 0;
    if (nm > 3) { console.log(`!! 이름표가 피해 숫자를 다시 덮는다 (${nm}쌍)`); bad++; }
    if (r.off.length) { console.log('!! 화면 밖으로 나간 글자: ' + r.off.join(' · ')); bad++; }
    await pg.close();
  }

  // ── 2. 위 중앙 띠 — 채널을 다 켜고, 미션 두 상태 × 세 해상도
  for (const BIG of [true, false])
  /* 뷰포트를 셋 골라도 논리 화면이 비슷하게 나온다(캔버스가 넓이를 맞춰 늘린다).
     좁은 화면은 미션 배너의 기준 y 가 달라지므로(narrow() → 152) 반드시 넣는다. */
  for (const [vw, vh] of [[1440,860],[844,390],[390,844]]) {
    const pg = await newPage(vw, vh);
    const r = await pg.evaluate(async ({ CAP, BIG }) => {
      /* 씨앗을 박는다. 붐비는 장면 쪽만 박아 두었더니 이 띠 검사가 실행마다
         11줄과 12줄 사이를 오갔고, 드물게 「보스 표지 ↔ 미션」 한 쌍이 났다.
         표지는 지난 프레임의 HUD 자리를 보고 비키므로, 장면이 흔들리면 비키는
         자리도 흔들린다. 계측기가 흔들리면 그 위의 판정도 못 믿는다. */
      let seed = 4242;
      Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      /* 프레임은 시계를 쥐고 넘긴다(§130). rAF 로 넘기면 판이 무거울 때 실제로
         그려지는 수가 달라지는데, 지형 표지는 **지난 프레임의 HUD 자리**를 보고
         비키므로 프레임 수가 흔들리면 재는 장면 자체가 흔들린다 — 혼자 돌려도
         띠가 12번 중 2번 10줄이 아니라 9줄이었다. 넘기는 동안은 frame() 이 자기를
         다시 예약하는 것을 막는다. 안 막으면 부른 만큼 루프가 불어나 화면 밖에서
         계속 돌고, 그 부하가 다시 다음 장면을 흔든다. */
      let ft = 1e6;
      /* 고정 타임스텝 누산기(acc)를 비운다. 프레임 수를 고정해도 이것이 남아
         있으면 **한 프레임에 update 가 두 번** 돌 수 있다 — 실제로 Game.time 이
         430.05 와 430.07 로 갈렸고, 그 한 번 차이로 적이 더 나와 띠가 8·9·10줄을
         오갔다. 넘기는 간격도 STEP 과 정확히 같게 준다(16.7 로 주면 조금씩 밀려
         누산기가 언젠가 넘친다). */
      acc = 0;
      const DT = 1000 / 60;
      const step = () => { last = ft; ft += DT; frame(ft); };
      selectedClass = 0; Game.reset(); Game.state = 'playing';
      player.base.maxHp = 1e9; recomputeStats(); player.hp = 1e9; Game.time = 430;
      for (const e of enemies) e.active = false;
      const boss = Game.spawnEnemy('boss1', player.x + 2200, player.y + 600, RANKS.common);
      if (boss) { boss.think = () => {}; boss.spd = 0; boss.hp = 16141; boss.maxHp = 32000; }
      step();
      Game.advancePending = 1;
      Game.lmFlash = 3; Game.lmFlashText = '봉인이 풀렸다 — 파수꾼을 쓰러뜨려라';
      Mission.flash = BIG ? 1.5 : 0;
      if (Game.state !== 'playing') Game.state = 'playing';
      step();
      step();          // 한 프레임 더 — 표지가 '지난 프레임의 HUD 자리'를 보고 비킨다
      Mission.flash = BIG ? 1.5 : 0;
      const boxes = eval(CAP);
      // 중앙에 쓰는 것만 — 왼쪽 위 조합 줄이 좁은 화면에서 이 구간에 들어온다
      const band = boxes.filter(q => q.y < 300 && q.fs > 10 && q.x + q.w > W*.3 && q.x < W*.7)
                        .sort((a,b) => a.y - b.y);
      const ov = [];
      for (let i = 0; i < band.length; i++) for (let j = i+1; j < band.length; j++) {
        const A = band[i], B = band[j];
        const w = Math.min(A.x+A.w, B.x+B.w) - Math.max(A.x, B.x);
        const h = Math.min(A.y+A.h, B.y+B.h) - Math.max(A.y, B.y);
        if (w > 1 && h > .5) ov.push(`${A.t} ↔ ${B.t} (세로 ${h.toFixed(1)}px)`);
      }
      return { W, H, rows: band.length, ov };
    }, { CAP: CAPTURE, BIG });
    const tag = `${r.W}×${r.H} 미션${BIG ? '큼' : '평상'}`;
    if (r.ov.length) { console.log(`!! ${tag} — 띠에서 겹침 ${r.ov.length}쌍\n     ${r.ov.join('\n     ')}`); bad++; }
    else console.log(`${tag} — 띠 ${r.rows}줄, 겹침 없음`);
    await pg.close();
  }

  /* ── 3. 전직한 좌상단 · 결과창 (§147)
     앞의 두 장면은 **레벨 1 · 전직 없음**이라, 전직해야 나오는 글자를 한 번도 재지
     않았다. 그래서 전직 이름이 자원 바를 13px 넘고 자세 아이콘이 그 글자 한가운데
     박히는 것을 검사가 통과시켰다. 판이 끝난 화면도 마찬가지로 아무도 안 봤다 —
     영혼 내역 줄이 액자 아래 금테를 밟고 있었다.

     **안 그려지는 상태는 안 재어진다.** 켜야 나오는 것은 켜고 재야 한다. */
  for (const [vw, vh] of [[1280, 720], [1450, 634], [390, 844]]) {
    const pg = await newPage(vw, vh);
    const r = await pg.evaluate(async (CAP) => {
      let seed = 4242; Math.random = () => (seed = (seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
      acc = 0; let ft = 1e6;
      const step = () => { last = ft; ft += 1000/60; frame(ft); };
      selectedClass = CLASSES.findIndex(c => c.key === 'paladin');
      Game.reset(); Game.state = 'playing'; Game.time = 420;
      for (let i = 1; i < 24; i++) player.level++;
      player.sigils = 10;
      let from = 'paladin'; player.advance.length = 0;
      for (let t = 1; t <= 2; t++) {
        const c = ADVANCES.filter(a => a.tier === t && a.from === from)[0];
        if (!c) break; player.advance.push(c); from = c.key;
      }
      recomputeStats(); player.hp = player.stats.maxHp * .55;
      for (let i = 0; i < 200; i++) { update(1/60); player.hp = player.stats.maxHp * .55; }
      step();
      const left = eval(CAP).filter(q => q.x < 340 && q.y < 200);
      const ov = [];
      for (let i = 0; i < left.length; i++) for (let j = i+1; j < left.length; j++) {
        const A = left[i], B = left[j];
        const w = Math.min(A.x+A.w, B.x+B.w) - Math.max(A.x, B.x);
        const h = Math.min(A.y+A.h, B.y+B.h) - Math.max(A.y, B.y);
        if (w > 0 && h > 0) ov.push(A.t + ' ↔ ' + B.t);
      }
      /* 체력·자원 바는 14~254 이고 그림 액자의 끝 장식이 8px 이라 글자가 놓일 수
         있는 곳은 22~246 이다. 틀이 있는 자리에 글자를 놓을 때는 틀 두께만큼 들어간다. */
      /* **바에 딸린 글자만** 본다. 거르개를 두 번 고쳤다. 그냥 x 범위로 걸렀더니
         바 왼쪽 밖(0~19)을 지나가는 몹 이름표가 잡혔고, 「바에 걸치면」으로 고쳤더니
         이번엔 세로 폰의 가운데 시계(225~295)가 잡혔다. 둘 다 바 글자가 아니다.
         바 글자는 **왼쪽에 매인 것**이므로 x<200 에서 시작한다. */
      const over = left.filter(q => q.y > 20 && q.y < 66 && q.x < 200 && q.x + q.w > 22
                                 && (q.x < 21 || q.x + q.w > 247))
                       .map(q => q.t + ' x ' + q.x.toFixed(0) + '~' + (q.x+q.w).toFixed(0));
      /* 시계 판이 왼쪽 바를 덮는가 — 세로 폰에서 실제로 덮는다(D9). 아직 안 고쳤으므로
         실패로 세우지 않고 **값만 적는다**. 바를 좁히려면 HUD 기둥 폭(240·254·246…)을
         통째로 매개변수로 빼야 해서 여기서 할 일이 아니다. 고칠 때 이 숫자가 0 이 된다. */
      const f = Sprites.frames.ui_clock;
      const cw = 150, ch = f ? Math.round(cw * f.h / f.w) : 0;
      const clockLap = Math.max(0, Math.min(254, W/2 + cw/2) - Math.max(14, W/2 - cw/2));

      // 결과창 — 금테를 밟는 글자
      Game.kills = 1423; Game.dmgDealt = 982314;
      Game.soulsEarned = 350; Game.soulParts = { time: 150, kills: 0, win: 200 };
      Game.state = 'won';
      const res = eval(CAP).filter(q => q.h > 8 && q.x > W*.2 && q.x < W*.8 && q.y > H*.25);
      const pw = Math.min(W - 40, 430);
      const x0 = Math.round(W/2 - pw/2 - 40), x1 = Math.round(W/2 + pw/2 + 40), wpx = x1 - x0;
      const d = ctx.getImageData(x0, 0, wpx, H).data;
      const gold = [];
      for (let y = 0; y < H; y++) {
        let n = 0;
        for (let x = 0; x < wpx; x++) { const i = (y*wpx+x)*4;
          if (d[i] > 120 && d[i+1] > 85 && d[i+2] < d[i]*.72) n++; }
        if (n > wpx*.45) gold.push(y);
      }
      const gb = gold[gold.length-1];
      const onRail = gb == null ? [] : res.filter(q => q.y < gb + 2 && q.y + q.h > gb - 2)
                                          .map(q => q.t + ' @ ' + q.y.toFixed(0));
      return { W, H, ov, over, gb, onRail, clockLap: Math.round(clockLap), clockH: ch };
    }, CAPTURE);
    const tag = `${r.W}×${r.H} 전직2차`;
    if (r.ov.length) { console.log(`!! ${tag} — 좌상단 겹침: ${r.ov.join(' · ')}`); bad++; }
    if (r.over.length) { console.log(`!! ${tag} — 바 안쪽선(22~246)을 넘는 글자: ${r.over.join(' · ')}`); bad++; }
    if (r.onRail.length) { console.log(`!! ${tag} — 결과창 금테(${r.gb})를 밟는 글자: ${r.onRail.join(' · ')}`); bad++; }
    if (!r.ov.length && !r.over.length && !r.onRail.length)
      console.log(`${tag} — 좌상단 겹침 없음 · 바 밖 없음 · 결과창 금테 ${r.gb} 깨끗`
        + (r.clockLap ? `  (시계 판이 바를 ${r.clockLap}px 덮는다 — D9, 아직 안 고침)` : ''));
    await pg.close();
  }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

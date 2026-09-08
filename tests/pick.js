#!/usr/bin/env node
/* 바뀐 곳에 걸리는 회귀만 골라 돌린다(§142).

   사용:
     node tests/pick.js              마지막 커밋 이후 바뀐 것에 걸리는 검사
     node tests/pick.js --since HEAD~3
     node tests/pick.js --list       고르기만 하고 안 돌린다
     node tests/pick.js adv aura     이름에 이 말이 들어가는 검사

   ■ 표를 손으로 쓰지 않는 이유

   「오오라를 고치면 adv-look 을 돌린다」 같은 표를 사람이 적어 두면, 검사를 하나
   고칠 때마다 그 표도 같이 고쳐야 하고 — 반드시 잊는다. 그러면 표가 거짓말을 하고,
   거짓말하는 표는 없는 것만 못하다(고른 것만 돌리는데 고르는 규칙이 틀렸으면
   안 돌린 자리에서 깨진다).

   그래서 **검사가 스스로 말하게 한다.** 회귀는 게임의 이름을 직접 부른다 —
   walk-feel 은 `CAM_DROP` 을, adv-look 은 `ADV_MOTIF` 를, card-bg 는 `drawLevelUp`
   을 적어 두고 있다. 그 이름들을 긁어 모으면 「이 검사가 무엇을 보는가」가 나온다.
   검사를 고치면 그 목록도 저절로 따라온다.

   ■ 흔한 이름은 버린다

   `player` · `ctx` · `Game` 은 거의 모든 검사에 나온다. 그런 이름으로 고르면 늘
   전부가 뽑혀 고른 보람이 없다. 검사의 40% 를 넘는 곳에 나오는 이름은 버린다.

   ■ 얼마나 아끼나 — 재 본 값

     전부         636초 (가장 느린 셋: adv-skill-fx 88 · regress-levelup-spam 77 · ui-parts 65)
     골라서       37~41초 (7~9개)

   ■ 늘 도는 것

   싼 검사 몇 개는 무엇을 고쳤든 돌린다. 「그려지기는 하는가 · 멈추지 않는가 ·
   예산을 넘지 않았는가」는 어디를 고쳐도 깨질 수 있고, 넷 다 몇 초면 끝난다. */
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'game/index.html');
const ALWAYS = ['regress-draw', 'regress-freeze', 'regress-pools', 'atlas-budget'];
const COMMON = .35;                     // 이 비율을 넘는 검사에 나오는 이름은 버린다
const WORD = /[A-Za-z_$][A-Za-z0-9_$]{3,}/g;
/* 어휘는 **게임이 선언한 이름**만이다. 처음에 「게임 파일 어딘가에 나오는 낱말」로
   잡았더니 52개 중 50개가 뽑혀 고른 보람이 없었다 — `path` · `data` · `else` ·
   `save` 같은 것이 걸렸는데, 그건 게임의 이름이 아니라 **검사 껍데기의 낱말**
   (require('path') · JS 예약어 · 지역 변수)이다. 어휘가 헐거우면 고르기는 늘
   전부를 고른다. */
/* **맨 바깥(들여쓰기 없는 줄)에 선언된 것만** 받는다. 함수 안의 지역 변수까지
   받았더니 `size` · `floor` · `from` · `back` 같은 것이 어휘에 들어왔고, 그 낱말은
   거의 모든 검사에 나오므로 다시 37개가 뽑혔다. 검사가 부르는 것은 게임의
   **바깥 이름**이지 남의 함수 속 지역 변수가 아니다. */
const DECL = [/^function\s+([A-Za-z_$][\w$]*)/gm, /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm];
const KEY = /"([a-z][a-z0-9]*(?:_[a-z0-9]+)+)"/g;

/* ■ 이름 대조가 **못 보는** 자리

   화면을 그려서 픽셀로 판정하는 검사는 게임의 이름을 거의 안 부른다 — adv-look 은
   drawScene() 하나만 부르고 나머지는 칸을 센다. 그래서 오오라를 통째로 갈아엎은
   세 커밋에서 adv-look 이 **안 걸렸다**(실제로 확인했다). 이름이 없으니 이름
   대조로는 영영 못 메운다.

   그래서 **바뀐 이름의 생김새**로 메운다. drawXxx 를 건드렸으면 화면을 통째로 보는
   검사들을, spawn·damage 를 건드렸으면 판이 무너지는지 보는 검사들을 얹는다.
   정확하지는 않지만 **빠뜨리는 쪽보다 더 도는 쪽으로** 틀린다.

   이래도 구멍은 남는다. 그래서 이 도구는 **고치는 동안** 쓰는 것이고, 배포 전에는
   전부 돌린다. 고르기는 빠르기를 사는 것이지 안전을 사는 것이 아니다. */
const SHAPE = [
  [/^draw/,                  ['adv-look', 'quarter-view', 'hud-overlap', 'regress-draw']],
  [/^(spawn|damage|update)/, ['regress-pools', 'regress-splitter', 'regress-knockback']],
  [/^(Sfx|Music|sfx)/,       ['audio-mix', 'music-modes']],
  [/^(ADV|adv|AURA|CLASS)/,  ['adv-look', 'adv-paths', 'codex']],
  [/^(fx_|FX)/,              ['adv-look', 'adv-skill-fx']],
  [/^(ui_|UI|HUD|hud)/,      ['ui-parts', 'hud-overlap', 'layout']],
  [/^(cam|CAM|player|hero|HERO)/, ['walk-feel', 'quarter-view']],
];

const tests = fs.readdirSync(path.join(ROOT, 'tests'))
  .filter(f => f.endsWith('.js') && f !== 'bot.js' && f !== 'pick.js')
  .map(f => f.replace(/\.js$/, ''));

const game = fs.readFileSync(GAME, 'utf8');
const inGame = new Set();
for (const re of DECL) { let m; re.lastIndex = 0; while ((m = re.exec(game))) if (m[1].length >= 4) inGame.add(m[1]); }
{ let m; KEY.lastIndex = 0; while ((m = KEY.exec(game))) inGame.add(m[1]); }   // 아틀라스·프레임 키

const symOf = {};
for (const t of tests) {
  const src = fs.readFileSync(path.join(ROOT, 'tests', t + '.js'), 'utf8');
  symOf[t] = new Set((src.match(WORD) || []).filter(w => inGame.has(w)));
}
const df = {};
for (const t of tests) for (const w of symOf[t]) df[w] = (df[w] || 0) + 1;
const rare = w => df[w] && df[w] <= tests.length * COMMON;

function pickByDiff(since) {
  let diff = '';
  /* 게임 파일만 본다. 문서나 굽는 스크립트가 바뀐 것으로 검사를 고르면 또 전부가
     뽑힌다 — 한국어 산문에도 라틴 낱말이 섞여 있다. 그림을 다시 구우면 아틀라스
     기록(ATLAS_FRAMES)이 게임 파일 안에서 바뀌므로 여기로 다 들어온다. */
  try { diff = execSync(`git diff -U0 ${since} -- game/index.html`,
                        { cwd: ROOT, maxBuffer: 1 << 28 }).toString(); } catch (e) { }
  /* 바뀐 이름은 **거르지 않고** 다 모은다. 처음에 「어떤 검사엔가 나오는 이름」만
     모았더니 `advTails` · `TAIL` 처럼 아무 검사도 부르지 않는 이름이 통째로
     빠졌고, 그래서 망토를 자락으로 갈아엎은 커밋에서 바뀐 이름이 **0개**로
     나왔다(생김새 판정도 같이 굶었다). 거르기는 검사와 맞대 볼 때만 한다. */
  const changed = new Set();
  for (const line of diff.split('\n')) {
    if (!/^[+-]/.test(line) || /^(\+\+\+|---)/.test(line)) continue;
    for (const w of line.match(WORD) || []) if (inGame.has(w)) changed.add(w);
  }
  const hit = [];
  for (const t of tests) {
    const m = [...symOf[t]].filter(w => changed.has(w) && rare(w));
    if (m.length) hit.push([t, m]);
  }
  hit.sort((a, b) => b[1].length - a[1].length);
  return { changed, hit };
}

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const si = args.indexOf('--since');
const since = si >= 0 ? args[si + 1] : 'HEAD~1';
const names = args.filter((a, i) => !a.startsWith('--') && !(si >= 0 && i === si + 1));

let chosen, why = {};
if (names.length) {
  chosen = tests.filter(t => names.some(n => t.includes(n)));
  for (const t of chosen) why[t] = ['이름으로 골랐다'];
} else {
  const { changed, hit } = pickByDiff(since);
  console.log(`바뀐 이름 ${changed.size}개 (${since} 이후)`);
  chosen = hit.map(h => h[0]);
  for (const [t, m] of hit) why[t] = m.slice(0, 6);
  // 이름 대조가 못 보는 자리 — 바뀐 이름의 생김새로 메운다
  for (const [re, ts] of SHAPE)
    for (const w of changed) if (re.test(w))
      for (const t of ts) if (tests.includes(t) && !chosen.includes(t)) {
        chosen.push(t); why[t] = ['생김새: ' + w];
      }
  // 검사 자신이 바뀌었으면 그 검사는 돌린다
  let td = '';
  try { td = execSync(`git diff --name-only ${since} -- tests`, { cwd: ROOT }).toString(); } catch (e) { }
  for (const f of td.split('\n')) {
    const t = path.basename(f, '.js');
    if (tests.includes(t) && !chosen.includes(t)) { chosen.push(t); why[t] = ['검사 자신이 바뀌었다']; }
  }
}
for (const t of ALWAYS) if (!chosen.includes(t)) { chosen.push(t); why[t] = why[t] || ['늘 돈다']; }

console.log(`고른 검사 ${chosen.length} / ${tests.length}`);
for (const t of chosen) console.log(`  ${t.padEnd(24)} ${why[t].join(' · ')}`);
if (listOnly) process.exit(0);

let pass = 0, fail = 0, t0 = Date.now();
for (const t of chosen) {
  const s = Date.now();
  try {
    execSync(`node tests/${t}.js`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
                                     env: { ...process.env, NODE_PATH: process.env.NODE_PATH } });
    pass++; console.log(`OK   ${t}  ${((Date.now() - s) / 1000).toFixed(0)}s`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${t}  ${((Date.now() - s) / 1000).toFixed(0)}s`);
    console.log((e.stdout || '').toString().split('\n').slice(-25).join('\n'));
  }
}
console.log(`=== 통과 ${pass} / 실패 ${fail} · ${((Date.now() - t0) / 1000).toFixed(0)}초 ===`);
process.exit(fail ? 1 : 0);

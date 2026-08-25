/* 화면에 그려지는 글자에 이모지가 다시 섞이지 않는가.

   이 게임은 전부 픽셀로 찍는다. 이모지는 OS 폰트라 기기마다 다른 그림이 뜨고,
   안티에일리어싱된 벡터라 나머지와 재질이 어긋난다 — 픽셀 아트 한가운데
   혼자 매끈한 그림이 떠 있으면 그 하나 때문에 전체가 싸구려로 보인다.

   메뉴를 다 걷어내고도 인게임 HUD 에 열다섯 곳이 남아 있었다.
   가장 오래, 가장 자주 보는 화면이 마지막까지 남았던 것이다.
   한 번 치웠어도 새 배너를 만들 때 손이 먼저 이모지를 집는다 — 그래서 감시한다.

   허용: ★ (U+2605). 문장 안에서 강조로 쓰는 활자 기호라 어느 기기에서나 같은
   글리프로 뜬다. 그림 자리를 차지하는 이모지와는 성격이 다르다.

   실행: node tests/no-emoji.js */
const fs = require('fs');

const SRC = '/home/user/templar/game/index.html';
const ALLOW = new Set(['★', '·', '→', '▶', '✝']);
// 그림 문자 대역 — 이모지 · 도형 · 기호
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}]/gu;
// 화면에 글자를 내보내는 통로
const DRAWS = /(ctx\.fillText|ctx\.strokeText|spawnNumber|iconText|lmFlashText\s*=|Mission\.text\s*=)/;

const lines = fs.readFileSync(SRC, 'utf8').split('\n');
const hits = [];
lines.forEach((l, i) => {
  if (!DRAWS.test(l)) return;
  // 그 줄의 문자열 리터럴만 본다 (변수명·주석은 상관없다)
  for (const m of l.matchAll(/"([^"]*)"|'([^']*)'/g)) {
    const txt = m[1] ?? m[2] ?? '';
    for (const ch of txt.match(EMOJI) || [])
      if (!ALLOW.has(ch)) hits.push({ n: i + 1, ch, line: l.trim().slice(0, 88) });
  }
});

// 데이터 표의 icon 필드는 남아 있어도 된다 — 그리는 데 쓰지만 않으면 된다.
// 대신 '그리는 데 쓰지 않는지'를 확인한다.
const src = fs.readFileSync(SRC, 'utf8');
const usedIcons = [...src.matchAll(/(?:fillText|spawnNumber)\([^)]*?\.icon\b/g)].map(m => m[0].slice(0, 60));

for (const h of hits) console.log(`  ${String(h.n).padStart(5)} ${h.ch}  ${h.line}`);
for (const u of usedIcons) console.log(`  데이터 아이콘을 그리고 있다: ${u}`);
console.log(`  글자 속 이모지 ${hits.length}곳 · 데이터 아이콘 그리기 ${usedIcons.length}곳`);

const pass = hits.length === 0 && usedIcons.length === 0;
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);

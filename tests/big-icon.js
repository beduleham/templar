/* 회귀: 큰 자리에서만 손그림 아이콘으로 바뀌는가.

   레벨업 카드의 아이콘은 화면에서 **64px** 이다 — 이 게임에서 가장 큰 아이콘인데
   32칸 표를 2배로 늘려 찍고 있었다. 카드 뒤에 손그림 문장까지 깔린 뒤로는 그
   계단이 더 도드라진다.

   그렇다고 전부 갈면 안 된다. **같은 표가 HUD·슬롯·배지에서는 16px 로 찍힌다.**
   128px 손그림을 그 크기로 내려 깔면 죽는다(§77) — 크기마다 맞는 도구가 다르다.

   ── 크기만으로는 모자랐다

   처음엔 '몇 px 로 찍히는지'만 보고 갈아 끼웠다. 그것으로 부족했던 까닭은
   **표 하나를 뜻이 다른 둘이 나눠 쓰기 때문**이다 — `orb` 는 레벨업 카드에서
   「마법 화살」이지만 영혼의 제단에서는 「영혼 구슬」이고, 제단 구슬도 64px 로
   찍힌다. 크기만 보니 제단 위에 얼음 화살이 얹혔다(tests/emblem.js 가 잡았다:
   구슬이 곳간을 따라 자라는 비율이 1.83배 → 1.24배로 떨어졌다).

   그래서 크기가 아니라 **부르는 자리**가 정한다. 이 테스트는 그 둘을 다 본다 —
   레벨업 카드는 손그림을 쓰고, 같은 키·같은 크기라도 제단은 표를 쓴다.

   양쪽을 다 걸어야 뜻이 있다. 큰 자리만 걸면 전부 손그림으로 바꿔도 통과하고,
   작은 자리만 걸면 손그림을 아예 안 써도 통과한다.

   되돌아가는 길도 지킨다 — 아틀라스에 자리만 예약하고 그림이 아직 없으면
   표로 떨어져야 한다. 안 그러면 아이콘 자리가 통째로 빈다(§75 에서 장식
   그림자 44개가 빈 자리에 깔렸던 것과 같은 사고다).

   실행: node tests/big-icon.js */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });

  const r = await pg.evaluate(() => {
    const out = { keys: Object.keys(BIG_ICON), min: BIG_ICON_MIN, frames: {}, path: {}, screens: {}, fallback: null };

    // 1. 손그림이 판에 실제로 들어 있고 서로 다른가
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    for (const k of out.keys) {
      const [ak, idx] = BIG_ICON[k];
      const f = Sprites.frames[ak];
      if (!f) { out.frames[k] = null; continue; }
      g.clearRect(0, 0, 128, 128);
      g.drawImage(Sprites.atlas, f.x + idx * f.w, f.y, f.w, f.h, 0, 0, 128, 128);
      const d = g.getImageData(0, 0, 128, 128).data;
      let op = 0, sig = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { op++; sig = (sig * 31 + (d[i] >> 4) + (i >> 9)) % 1e9; }
      out.frames[k] = { atlas: ak, idx, op, sig, fits: f.y + f.h <= Sprites.atlas.height };
    }

    /* 2. 어느 길로 그렸는지 — Sprites.draw 를 가로채 센다.
          '크게 그리면 손그림'을 화면 크기가 아니라 실제 호출로 확인한다. */
    const probe = (cell) => {
      const used = {};
      const _s = Sprites.draw;
      Sprites.draw = function (key) { used[key] = (used[key] || 0) + 1; return _s.apply(this, arguments); };
      const c2 = document.createElement('canvas'); c2.width = c2.height = 200;
      for (const k of out.keys) {
        used.__cur = k;
        const before = Object.keys(used).filter(x => x.startsWith('icon_')).length;
        drawMenuIcon(k, 100, 100, '#ffffff', cell);
      }
      Sprites.draw = _s;
      return Object.keys(used).filter(x => x.startsWith('icon_')).length;
    };
    // 크기별 · 자리별로 따로 본다. big 을 켠 자리에서만 손그림이어야 한다.
    for (const [tag, cell, wantBig] of [['배지 16px', 2, false], ['슬롯 16px', 3, false],
                                        ['카드 64px', 8, true], ['제단 64px(같은 크기, big 꺼짐)', 8, false]]) {
      const res = {};
      for (const k of out.keys) {
        let hit = 0;
        const _s = Sprites.draw;
        Sprites.draw = function (key) { if (String(key).startsWith('icon_')) hit++; return _s.apply(this, arguments); };
        ctx.save(); drawMenuIcon(k, 100, 100, '#ffffff', cell, wantBig); ctx.restore();
        Sprites.draw = _s;
        const p = iconPick(k, cell);
        res[k] = { px: p ? p.k * p.rows[0].length : 0, sprite: hit > 0, want: wantBig };
      }
      out.path[tag] = res;
    }

    // 3. 그림이 아직 없을 때는 표로 떨어지는가
    {
      const ak = BIG_ICON[out.keys[0]][0];
      const f = Sprites.frames[ak];
      const keepY = f.y;
      f.y = Sprites.atlas.height + 1000;            // 판 밖으로 밀어 '그림 없음'을 흉내낸다
      let hit = 0;
      const _s = Sprites.draw;
      Sprites.draw = function (key) { if (String(key).startsWith('icon_')) hit++; return _s.apply(this, arguments); };
      const ok = drawMenuIcon(out.keys[0], 100, 100, '#ffffff', 8, true);
      Sprites.draw = _s;
      f.y = keepY;
      out.fallback = { drewSprite: hit > 0, returned: !!ok };
    }
    return out;
  });

  let bad = 0;
  console.log(`손그림으로 바꾸는 아이콘 ${r.keys.length}종, 경계 ${r.min}px`);
  const sigs = [];
  for (const [k, v] of Object.entries(r.frames)) {
    if (!v) { console.log(`!! ${k} 의 아틀라스 줄이 없다`); bad++; continue; }
    console.log(`  ${k.padEnd(7)} ${v.atlas}[${v.idx}]  불투명 ${String(v.op).padStart(5)}칸  판 안 ${v.fits}`);
    if (!v.fits) { console.log(`!! ${k} — 판이 그 줄까지 자라지 않았다`); bad++; }
    if (v.op < 2000) { console.log(`!! ${k} 이 비었다 (${v.op}칸)`); bad++; }
    sigs.push(v.sig);
  }
  if (new Set(sigs).size !== sigs.length) { console.log('!! 같은 그림이 두 번 들어갔다'); bad++; }

  console.log('\n자리마다 어느 길을 쓰는가');
  for (const [tag, res] of Object.entries(r.path)) {
    const n = Object.values(res).filter(v => v.sprite).length;
    console.log(`  ${tag.padEnd(28)} 손그림 ${n} / ${Object.keys(res).length}종`);
    for (const [k, v] of Object.entries(res)) {
      const want = v.want && v.px >= r.min;               // 켠 자리이고 충분히 클 때만
      if (want && !v.sprite) { console.log(`!! ${tag} — ${k} 이 ${v.px}px 인데 표를 쓴다`); bad++; }
      if (!want && v.sprite) { console.log(`!! ${tag} — ${k} 이 손그림을 쓴다 (여기서는 다른 뜻이거나 너무 작다)`); bad++; }
    }
  }

  console.log(`\n그림이 없을 때: 손그림 그림 ${r.fallback.drewSprite} · 무언가 그림 ${r.fallback.returned}`);
  if (r.fallback.drewSprite) { console.log('!! 판 밖의 줄을 그리려 했다'); bad++; }
  if (!r.fallback.returned) { console.log('!! 표로도 안 떨어져 아이콘 자리가 빈다'); bad++; }

  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close();
  process.exit(bad ? 1 : 0);
})();

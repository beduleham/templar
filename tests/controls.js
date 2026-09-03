/* 회귀: 조작·접근성(7번) — 키 배치, 게임패드, 자동 일시정지, 색약 팔레트, 설정 화면이 화면에 든다.

   1. Keymap: 위를 i 로 바꾸면 i 를 누른 이동이 위로 가고, w 는 더 이상 안 먹는다. 스킬을 f 로 바꾸면 f 가 스킬이다.
   2. 패드: getGamepads 를 가짜로 꽂아 스틱을 밀면 inputVector 가 그 방향이고, A 는 눌린 순간 한 번만 onKey 로 간다.
   3. 창을 벗어나면(blur) 판이 멈춘다.
   4. 색약 팔레트를 켜면 체력 막대 색이 파랑/주황이다.
   5. 설정 열 줄과 키 설정 일곱 줄이 1280×652 · 390×844 에서 화면 밖으로 안 나간다.

   실행: node tests/controls.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let bad = 0; const errs = [];
  for (const [vw, vh] of [[1280, 652], [390, 844]]) {
    const pg = await b.newPage({ viewport: { width: vw, height: vh } });
    pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await pg.goto('file://' + require('path').resolve(__dirname, '../game/index.html'));
    await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
    const r = await pg.evaluate(() => {
      const out = {};
      // 설정 화면 — 마지막 줄 바닥이 화면 안인가 (panel 호출을 가로채 가장 아래를 잰다)
      let maxBottom = 0; const op = panel;
      panel = function (x, y, w, h, ...a) { maxBottom = Math.max(maxBottom, y + h); return op(x, y, w, h, ...a); };
      Game.optFrom = 'intro'; Game.state = 'options'; frame(performance.now()); out.optBottom = Math.round(maxBottom); out.optRows = OPT_ROWS.length + 1;
      maxBottom = 0; Game.keyRow = 0; Game.keyWait = false; Game.state = 'keys'; frame(performance.now()); out.keysBottom = Math.round(maxBottom);
      panel = op;
      out.H = H;
      return out;
    });
    console.log(`${vw}×${vh}: 설정 ${r.optRows}줄 바닥 ${r.optBottom}/${r.H} · 키 설정 바닥 ${r.keysBottom}/${r.H}`);
    if (r.optBottom > r.H - 8) { console.log(`!! ${vw}×${vh} 설정 줄이 화면 밖으로 나간다`); bad++; }
    if (r.keysBottom > r.H - 8) { console.log(`!! ${vw}×${vh} 키 설정 줄이 화면 밖으로 나간다`); bad++; }
    if (vw === 1280) {
      await pg.screenshot({ path: __dirname + '/../art/out/opt-screen.png' });
      await pg.evaluate(() => { Game.state = 'keys'; Game.keyRow = 4; Game.keyWait = true; });
      await pg.waitForTimeout(80);
      await pg.screenshot({ path: __dirname + '/../art/out/keys-screen.png' });
    }
    await pg.close();
  }
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '../game/index.html'));
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  const r = await pg.evaluate(() => {
    const out = {};
    // 1. 키 배치
    Keymap.set('up', 'i'); keys.clear(); keys.add('i'); out.upI = inputVector().y; keys.clear(); keys.add('w'); out.upW = inputVector().y; keys.clear();
    Keymap.reset('up');
    selectedClass = 0; Game.reset(); Game.state = 'playing';
    let skillCalls = 0; const os = useSkill; useSkill = function () { skillCalls++; };
    Keymap.set('skill', 'f'); Game.onKey('f'); Game.onKey(' '); out.skillF = skillCalls; useSkill = os; Keymap.reset('skill');
    out.skillDefault = Keymap.is(' ', 'skill') && Keymap.is('shift', 'skill');
    // 2. 패드
    let pressed = false, axes = [0, 0];
    navigator.getGamepads = () => [{ connected: true, axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0 && pressed })) }];
    axes = [0, -1]; Pad.poll(); out.padUp = inputVector().y; axes = [0, 0]; Pad.poll();
    let keyCalls = []; const ok = Game.onKey; Game.onKey = function (k) { keyCalls.push(k); return ok.call(this, k); };
    pressed = true; Pad.poll(); Pad.poll(); Pad.poll(); pressed = false; Pad.poll();
    Game.onKey = ok; out.padA = keyCalls;
    // 3. 자동 일시정지
    Game.state = 'playing'; window.dispatchEvent(new Event('blur')); out.pausedOnBlur = Game.state;
    Game.state = 'playing';
    // 4. 색약 팔레트
    let barCol = null; const ob = pxBar; pxBar = function (x, y, w, h, f, color, ...a) { if (y === 24) barCol = color; return ob(x, y, w, h, f, color, ...a); };
    Opt.cb = 1; player.hp = player.stats.maxHp; drawHUD(); out.cbBar = barCol; Opt.cb = 0; drawHUD(); out.normalBar = barCol; pxBar = ob;
    return out;
  });
  console.log(JSON.stringify(r));
  if (r.upI !== -1 || r.upW !== 0) { console.log('!! 키 배치 — 위를 i 로 바꿨는데 이동이 따라오지 않는다'); bad++; }
  if (r.skillF !== 1) { console.log(`!! 스킬 키를 f 로 바꿨는데 f 가 ${r.skillF}번 스킬을 냈다(1이어야 한다, Space 는 안 먹어야 한다)`); bad++; }
  if (!r.skillDefault) { console.log('!! 기본값 되돌리기가 Space·Shift 를 복구하지 않았다'); bad++; }
  if (r.padUp !== -1) { console.log(`!! 패드 스틱 위가 이동으로 안 간다 (${r.padUp})`); bad++; }
  if (!(r.padA.length === 1 && r.padA[0] === ' ')) { console.log(`!! 패드 A 가 눌린 순간 한 번이어야 하는데 ${JSON.stringify(r.padA)}`); bad++; }
  if (r.pausedOnBlur !== 'paused') { console.log(`!! 창을 벗어났는데 상태가 ${r.pausedOnBlur}`); bad++; }
  if (r.cbBar !== '#4fa8ff' || r.normalBar !== '#3ddc84') { console.log(`!! 색약 팔레트 체력 막대 색 ${r.cbBar} / 기본 ${r.normalBar}`); bad++; }
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close(); process.exit(bad ? 1 : 0);
})();

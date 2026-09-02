/* 회귀: 음악이 모드마다 다른 곡인가.

   예전엔 한 곡(Am-F-C-G 152bpm)을 볼륨 3단계로만 돌려 메뉴와 보스전이 같은 노래였다.
   지금은 menu·play·boss 세 곡과 그 아래 늘 깔리는 앰비언트 한 겹이다.

   오디오는 헤드리스에서 들을 수 없으니 **예약된 음**을 센다 — tone·pad·noise·kick 을
   가로채 한 바퀴(64칸 = 네 마디)마다 무엇이 몇 번 울렸는지 기록한다.

   재는 것:
     1. 세 모드의 리드 음렬이 서로 다르다 (같은 곡이 아니다)
     2. 메뉴에는 킥이 없고, 보스는 플레이보다 타악이 많다 (성격이 다르다)
     3. 앰비언트(pad)는 세 모드 모두에 있다 (바닥이 이어진다)
     4. setMode 는 마디 머리에서만 갈아탄다 (화음이 안 부딪힌다)
     5. 예외가 없다

   실행: node tests/music-modes.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file:///home/user/templar/game/index.html');
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  const r = await pg.evaluate(() => {
    Sfx.init();
    if (!Sfx.ctx) return { noCtx: true };
    Music.start('menu');
    if (Music.timer) { clearInterval(Music.timer); Music.timer = null; }   // 손으로 돈다
    const rec = { tone: [], pad: 0, noise: 0, kick: 0 };
    const T = Music.tone.bind(Music), P = Music.pad.bind(Music), N = Music.noise.bind(Music), K = Music.kick.bind(Music);
    Music.tone = (t, f, d, ty, v, dest) => { rec.tone.push(Math.round(f)); T(t, f, d, ty, v, dest); };
    Music.pad = (...a) => { rec.pad++; P(...a); };
    Music.noise = (...a) => { rec.noise++; N(...a); };
    Music.kick = (...a) => { rec.kick++; K(...a); };
    const cycle = (mode) => {
      Music.mode = mode; Music.pending = null; Music.bpm = Music.track.bpm; Music.step = 0;
      rec.tone = []; rec.pad = 0; rec.noise = 0; rec.kick = 0;
      const t0 = Music.ctx.currentTime + 1;
      for (let i = 0; i < 64; i++) Music.tick(i, t0 + i * .1, .1);
      return { bpm: Music.bpm, tones: rec.tone.length, pad: rec.pad, noise: rec.noise, kick: rec.kick,
        sig: rec.tone.join(',') };
    };
    const out = { menu: cycle('menu'), play: cycle('play'), boss: cycle('boss') };
    // 4. 마디 머리 갈아타기 — 3칸 지난 뒤 요청하면 16칸에서 바뀌어야 한다
    Music.mode = 'play'; Music.pending = null; Music.step = 0; Music.bpm = 152;
    Music.nextTime = Music.ctx.currentTime;
    const seen = [];
    for (let i = 0; i < 20; i++) {
      if (i === 3) Music.setMode('boss');
      // schedule 의 한 칸만 손으로 흉내낸다
      if (Music.step % 16 === 0 && Music.pending) { Music.mode = Music.pending; Music.pending = null; Music.bpm = Music.track.bpm; Music.step = 0; }
      seen.push(Music.mode); Music.step = (Music.step + 1) % 64;
    }
    out.switchAt = seen.indexOf('boss'); out.switchSeen = seen.join('').replace(/play/g, 'p').replace(/boss/g, 'B');
    return out;
  });
  let bad = 0;
  if (r.noCtx) { console.log('!! AudioContext 를 만들 수 없다 — 이 환경에서는 잴 수 없다'); bad++; }
  else {
    for (const m of ['menu', 'play', 'boss']) {
      const x = r[m];
      console.log(`${m.padEnd(5)} ${x.bpm}bpm  음 ${String(x.tones).padStart(3)} · 패드 ${x.pad} · 노이즈 ${String(x.noise).padStart(3)} · 킥 ${String(x.kick).padStart(2)}`);
      if (x.tones < 8) { console.log(`!! ${m} — 음이 거의 없다`); bad++; }
      if (x.pad < 4) { console.log(`!! ${m} — 앰비언트 패드가 없다, 바닥이 끊긴다`); bad++; }
    }
    if (r.menu.sig === r.play.sig || r.play.sig === r.boss.sig || r.menu.sig === r.boss.sig) { console.log('!! 두 모드가 같은 음렬이다 — 같은 곡이다'); bad++; }
    if (r.menu.kick !== 0) { console.log(`!! 메뉴에 킥이 ${r.menu.kick}번 — 메뉴가 재촉한다`); bad++; }
    if (!(r.boss.kick > r.play.kick && r.boss.noise > r.play.noise)) { console.log('!! 보스전 타악이 플레이보다 많지 않다'); bad++; }
    if (!(r.boss.bpm > r.play.bpm && r.play.bpm > r.menu.bpm)) { console.log('!! 박자가 menu < play < boss 가 아니다'); bad++; }
    console.log(`갈아타기: 3칸에 요청 → ${r.switchAt}칸에서 바뀜  (${r.switchSeen})`);
    if (r.switchAt !== 16) { console.log('!! 마디 머리(16칸)가 아닌 곳에서 갈아탔다'); bad++; }
  }
  if (errs.length) { console.log(errs.join('\n')); bad++; }
  console.log(bad ? '\n실패 ' + bad + '건' : '\n통과');
  await b.close(); process.exit(bad ? 1 : 0);
})();

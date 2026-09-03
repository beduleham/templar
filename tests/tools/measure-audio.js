/* 소리 계측 — 통과/실패가 없는 도구라 tests/ 가 아니라 tests/tools/ 에 둔다.

   헤드리스에는 스피커가 없다. 그래서 **울린 소리를 받아 적고, 그걸 오프라인으로
   다시 렌더해서 파형을 잰다.** Sfx.play / Sfx.burst 는 인자만 주면 결과가 정해져
   있으므로(주파수·길이·파형·크기·활강·자리) 받아 적은 목록으로 원음을 복원할 수 있다.

   자리와 예산도 그대로 다시 계산한다 — place() 를 실제로 부르고, 동시 발음 수를
   게임 시계로 세어 CAP 을 넘는 판 소리는 목록에서 빠뜨린다. 그래야 헤드리스에서
   재는 값이 진짜로 들리는 것과 같아진다.

   재는 자리 셋: 1분 · 5분 · 10분 각각 10초.

   찍는 것:
     소리/초    초당 몇 개가 울리는가
     최대겹침   한 순간에 몇 개가 동시에 울리는가
     피크       합친 파형의 최대 진폭 (1.0 을 넘으면 깎여 나간다)
     깎임%      |x| >= 0.999 인 표본의 비율 — 실제로 찌그러진 양
     RMS        평균 세기
     폭         Σ|L-R| / Σ(|L|+|R|) — 0 이면 모노, 1 이면 완전히 갈렸다
     |좌우|     자리를 가진 소리의 평균 |좌우| 값 (0 = 가운데, 1 = 한쪽 끝)
     종류별     무슨 소리가 자리를 차지하는가

   ■ 봇 판은 실시간보다 빠르게 굴러가므로 throttled 의 performance.now() 가
     게임 시간과 어긋난다. 계측 동안에는 게임 시계로 바꿔 끼운다 —
     실제 60fps 플레이와 같은 간격이 나오게.

   실행:  node tests/tools/measure-audio.js before [직업 0~3]
          node tests/tools/measure-audio.js after  [직업 0~3]
   결과는 표준 출력과 ab_audio_<tag>.json 으로 남는다. */
const { chromium } = require('playwright');
const { BOT } = require('../bot.js');
const path = require('path');
const tag = process.argv[2] || 'run';
const CLS = Number(process.argv[3] || 0);
const WINDOWS = [[55, 65], [295, 305], [595, 605]];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('file://' + path.resolve(__dirname, '../../game/index.html'));
  await pg.waitForFunction('typeof Game !== "undefined" && Sprites.ready', null, { timeout: 20000 });
  await pg.evaluate((BOT_SRC) => { (0, eval)(BOT_SRC); }, BOT);

  // 1. 판을 굴리며 울린 소리를 전부 받아 적는다 (자리·예산까지 그대로 계산)
  const ev = await pg.evaluate(({ cls, until }) => {
    selectedClass = cls; Game.reset(); botInstall();
    player.godMode = true;                       // 10분까지 반드시 간다
    const rec = [], ends = [];
    const gt = () => Game.time;
    // 지금 울리고 있는 소리 수 — 게임 시계로 센다
    const liveNow = (t) => { while (ends.length && ends[0] <= t) ends.shift(); return ends.length; };
    const hold = (t, dur) => { ends.push(t + dur + .05); ends.sort((a, z) => a - z); };
    const gate = (vol, pos, t) => {
      if (!pos || !Sfx.place) return [vol, 0];   // 옛 판(자리 없음)도 같은 자로 잰다
      const p = Sfx.place(pos.x, pos.y);
      if (!p || liveNow(t) >= Sfx.CAP) return null;
      return [vol * p[0], p[1]];
    };
    const src = { play: Sfx.play, burst: Sfx.burst, throttled: Sfx.throttled, arp: Sfx.arp };
    Sfx.play = function (f, d, ty = 'square', v = 1, s = 0, pos = null) {
      const t = gt(), gp = gate(v, pos, t); if (!gp) return;
      rec.push({ t, f, d, ty, v: gp[0], s, pan: gp[1], n: 0, k: Sfx._k || 'etc' }); hold(t, d);
    };
    Sfx.burst = function (d, v, band, pos = null) {
      const t = gt(), gp = gate(v, pos, t); if (!gp) return;
      rec.push({ t, f: band, d, ty: 'noise', v: gp[0], s: 0, pan: gp[1], n: 1, k: (Sfx._k || 'etc') + '~' }); hold(t, d);
    };
    const lastG = {};
    Sfx.throttled = function (key, ms, fn) {
      const now = gt() * 1000;
      if (lastG[key] !== undefined && now - lastG[key] < ms) return;
      lastG[key] = now; const prev = Sfx._k; Sfx._k = key.replace(/[0-3]$/, ''); fn(); Sfx._k = prev;
    };
    Sfx.arp = function (notes, gap, dur, type, vol) {
      const t0 = gt();
      notes.forEach((f, i) => rec.push({ t: t0 + i * gap / 1000, f, d: dur, ty: type, v: vol, s: 0, pan: 0, n: 0, k: 'arp' }));
    };
    for (let i = 0; i < 60 * until + 5; i++) {
      if (Game.state === 'playing') { botTick(1 / 60, true); player.hp = player.stats.maxHp; }
      update(1 / 60);
      let g = 0;
      while ((Game.state === 'levelup' || Game.state === 'advance') && g++ < 50) {
        const C = Game.choices;
        Game.applyChoice(C.find(c => c.type === 'passive') || C.find(c => c.type !== 'heal') || C[0]);
      }
      if (Game.state === 'dead' || Game.state === 'won') break;
    }
    Object.assign(Sfx, src); botRestore();
    // 압축기는 새 판에만 있다. 옛 판을 렌더할 때 걸면 안 잰 것을 재게 된다.
    return { rec, end: Game.time, st: Game.state, kills: Game.kills, comp: !!Sfx.place };
  }, { cls: CLS, until: 610 });

  // 2. 구간마다 오프라인으로 다시 렌더해 파형을 잰다
  const out = { tag, cls: CLS, end: Math.round(ev.end), kills: ev.kills, win: {} };
  for (const [a, z] of WINDOWS) {
    const evs = ev.rec.filter(e => e.t >= a && e.t < z);
    if (!evs.length) { out.win[a] = { none: true }; continue; }
    const m = await pg.evaluate(async ({ evs, a, z, comp }) => {
      const SR = 22050, oc = new OfflineAudioContext(2, Math.ceil((z - a) * SR), SR);
      const master = oc.createGain(); master.gain.value = .25;      // Opt.sfxVol() 최대치
      if (comp) {
        const c = oc.createDynamicsCompressor();
        c.threshold.value = -16; c.knee.value = 10; c.ratio.value = 9;
        c.attack.value = .003; c.release.value = .18;
        master.connect(c); c.connect(oc.destination);
      } else master.connect(oc.destination);
      const nn = Math.floor(SR * .5), nz = oc.createBuffer(1, nn, SR), nd = nz.getChannelData(0);
      for (let i = 0; i < nn; i++) nd[i] = Math.random() * 2 - 1;
      for (const e of evs) {
        const t = e.t - a, g = oc.createGain();
        if (e.n) {
          const s = oc.createBufferSource(); s.buffer = nz;
          const f = oc.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = e.f; f.Q.value = .8;
          g.gain.setValueAtTime(e.v * .3, t);
          g.gain.exponentialRampToValueAtTime(.0001, t + e.d);
          s.connect(f); f.connect(g); s.start(t, Math.random() * .4, e.d + .02);
        } else {
          const o = oc.createOscillator();
          o.type = e.ty; o.frequency.setValueAtTime(e.f, t);
          if (e.s) o.frequency.exponentialRampToValueAtTime(Math.max(30, e.f + e.s), t + e.d);
          g.gain.setValueAtTime(.0001, t);
          g.gain.linearRampToValueAtTime(e.v * .3, t + .002);
          g.gain.exponentialRampToValueAtTime(.0001, t + e.d);
          o.connect(g); o.start(t); o.stop(t + e.d + .02);
        }
        if (e.pan) { const p = oc.createStereoPanner(); p.pan.value = e.pan; g.connect(p); p.connect(master); }
        else g.connect(master);
      }
      const buf = await oc.startRendering();
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      let peak = 0, clip = 0, sum = 0, dif = 0, tot = 0;
      for (let i = 0; i < L.length; i++) {
        const x = Math.max(Math.abs(L[i]), Math.abs(R[i]));
        if (x > peak) peak = x;
        if (x >= .999) clip++;
        sum += (L[i] * L[i] + R[i] * R[i]) / 2;
        dif += Math.abs(L[i] - R[i]); tot += Math.abs(L[i]) + Math.abs(R[i]);
      }
      return { peak, clipPct: clip / L.length * 100, rms: Math.sqrt(sum / L.length), sep: tot ? dif / tot : 0 };
    }, { evs, a, z, comp: ev.comp });
    const pts = [];
    for (const e of evs) { pts.push([e.t, 1]); pts.push([e.t + e.d, -1]); }
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    let cur = 0, maxOv = 0;
    for (const [, d] of pts) { cur += d; if (cur > maxOv) maxOv = cur; }
    const pos = evs.filter(e => e.pan !== 0 || e.k === 'hit' || e.k === 'kill');
    const panAvg = pos.length ? pos.reduce((a, e) => a + Math.abs(e.pan), 0) / pos.length : 0;
    const byKey = {};
    for (const e of evs) byKey[e.k] = (byKey[e.k] || 0) + 1;
    const top = Object.entries(byKey).sort((x, y) => y[1] - x[1]).slice(0, 5);
    out.win[a] = { n: evs.length, per: +(evs.length / (z - a)).toFixed(1), maxOv,
      peak: +m.peak.toFixed(3), clipPct: +m.clipPct.toFixed(2), rms: +m.rms.toFixed(4),
      sep: +m.sep.toFixed(3), panAvg: +panAvg.toFixed(3), top };
  }

  const lab = { 55: '1분', 295: '5분', 595: '10분' };
  console.log(`\n${tag}  ${['성기사', '전사', '추적자', '마법사'][CLS]}  ${Math.round(ev.end)}s · ${ev.kills}킬`);
  console.log('구간   소리/초  최대겹침    피크   깎임%     RMS      폭  |좌우|  많은 순');
  for (const [a] of WINDOWS) {
    const w = out.win[a];
    if (!w || w.none) { console.log(`${lab[a].padEnd(6)} (없음)`); continue; }
    console.log(`${lab[a].padEnd(6)} ${String(w.per).padStart(6)}  ${String(w.maxOv).padStart(8)}  ${String(w.peak).padStart(6)}  ${String(w.clipPct).padStart(6)}  ${String(w.rms).padStart(6)}  ${String(w.sep).padStart(6)}  ${String(w.panAvg).padStart(6)}  ` +
      w.top.map(([k, n]) => `${k}:${n}`).join(' '));
  }
  if (errs.length) console.log(errs.join('\n'));
  require('fs').writeFileSync(`ab_audio_${tag}.json`, JSON.stringify(out));
  await b.close();
})();

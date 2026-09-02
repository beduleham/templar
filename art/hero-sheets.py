"""영웅 동작 시트(2×2) 넷을 128칸 아틀라스 네 줄로 넣는다 — 전사에서 겪은 것을 절차로.

  python3 art/hero-sheets.py <직업키> <대기.png> <걷기.png> <공격.png> <기술.png>

하는 일(§95·§96):
  1. 시트를 넷으로 가른다. 가로 중앙선은 세로 방향 빈 띠의 가운데, 세로 중앙선은
     위·아래 반쪽마다 따로 찾는다(뻗은 무기가 한쪽만 중앙선을 넘는다).
  2. 칸마다 몸높이(머리 꼭대기→발, 머리 축 위에서)와 허리 폭을 잰다. 높이가 대기
     중앙값에서 6% 넘게 벗어나고 허리 폭도 같은 방향으로 벗어나면 **작게 그려진 것**
     이라 원본을 키운다. 높이만 낮으면 웅크린 자세라 둔다.
  3. 열여섯 장을 같은 폭 캔버스에 **머리 축을 가운데로** 놓는다. 정렬 도구는 가로를
     맞추지 않고, 발로 축을 잡으면 땅에 놓인 무기가 축을 민다.
  4. align-frames 로 발밑선·공통 창을 맞추고 inject-frames 로 128 줄 넷에 넣는다.
  5. 성기사와 몸높이가 같도록 s 를 풀고, 발과 머리 축을 성기사 자리에 맞춰 oy·ox 를 준다.
"""
import sys, io, json, subprocess, os
import numpy as np
from PIL import Image

GAME = "game/index.html"; ATLAS = "art/atlas.png"
ACTS = ["idle", "walk", "attack", "cast"]

def key(a): return (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) <= 55

def empty_runs(flags, lo, hi):
    runs = []
    for x in range(lo, hi):
        if flags[x]: continue
        if runs and x == runs[-1][1] + 1: runs[-1][1] = x
        else: runs.append([x, x])
    return runs

def split(sheet, cls, act):
    im = Image.open(sheet).convert("RGBA"); a = np.array(im).astype(int); fg = key(a); H, W = fg.shape
    rows = fg.sum(1) > 0
    r = max(empty_runs(rows, H // 3, 2 * H // 3), key=lambda t: t[1] - t[0]); cy = (r[0] + r[1]) // 2
    cuts = []
    for y0, y1 in ((0, cy), (cy, H)):
        cols = fg[y0:y1].sum(0) > 0
        c = max(empty_runs(cols, W // 4, 3 * W // 4), key=lambda t: t[1] - t[0]); cuts.append((c[0] + c[1]) // 2)
    cells = [(0, 0, cuts[0], cy), (cuts[0], 0, W, cy), (0, cy, cuts[1], H), (cuts[1], cy, W, H)]
    out = []
    for i, (x0, y0, x1, y1) in enumerate(cells):
        c = im.crop((x0, y0, x1, y1)); w, h = c.size; s = max(w, h)
        sq = Image.new("RGBA", (s, s), (255, 0, 255, 255)); sq.paste(c, ((s - w) // 2, (s - h) // 2))
        p = f"art/src/{cls}_{act}_{i + 1}.png"; sq.save(p); out.append(p)
    print(f"{act}: 가로선 y={cy}, 세로선 위 x={cuts[0]} 아래 x={cuts[1]}")
    return out

def measure(p):
    a = np.array(Image.open(p).convert("RGBA")).astype(int); fg = key(a); H, W = fg.shape
    ys, xs = np.where(fg); bot = ys.max()
    rows = range(bot - int(H * .06), bot + 1)
    fax = int(np.median(np.concatenate([np.where(fg[y])[0] for y in rows if fg[y].any()])))
    lo = max(0, fax - int(W * .18)); band = fg[:, lo:fax + int(W * .18)]; top = np.where(band.any(1))[0].min()
    mids = []
    for y in range(top + int(H * .012), top + int(H * .09)):
        r = np.where(band[y])[0]
        if len(r): mids.append((r.min() + r.max()) / 2 + lo)
    ax = int(np.mean(mids))
    band2 = fg[:, max(0, ax - int(W * .05)):ax + int(W * .05)]; top2 = np.where(band2.any(1))[0].min()
    wy = bot - int((bot - top2) * .45); r = np.where(fg[wy])[0]
    return dict(h=bot - top2, waist=r.max() - r.min() + 1, ax=ax, bot=bot, W=W, H=H, x0=xs.min(), x1=xs.max())

def main():
    cls, sheets = sys.argv[1], sys.argv[2:6]
    cells = {act: split(sh, cls, act) for act, sh in zip(ACTS, sheets)}
    M = {p: measure(p) for act in ACTS for p in cells[act]}
    ref_h = float(np.median([M[p]["h"] for p in cells["idle"]])); ref_w = float(np.median([M[p]["waist"] for p in cells["idle"]]))
    print(f"\n대기 몸높이 중앙값 {ref_h:.0f} · 허리 폭 {ref_w:.0f}")
    for act in ACTS:
        for p in cells[act]:
            m = M[p]; dh = m["h"] / ref_h - 1; dw = m["waist"] / ref_w - 1; tag = ""
            if abs(dh) > .06 and dw * dh > 0 and abs(dw) > .06:
                f = ref_h / m["h"]; im = Image.open(p).convert("RGBA"); ns = int(round(im.size[0] * f))
                big = np.array(im.resize((ns, ns), Image.LANCZOS)).astype(int); bg = ~key(big); big[bg] = [255, 0, 255, 255]
                Image.fromarray(big.astype(np.uint8), "RGBA").save(p); M[p] = measure(p); tag = f"  → ×{f:.3f} 로 키움(몸높이 {M[p]['h']})"
            elif abs(dh) > .06: tag = "  (자세 — 허리 폭이 그대로라 둔다)"
            print(f"  {os.path.basename(p):22} 몸높이 {m['h']:4d} ({dh:+.1%})  허리 {m['waist']:3d} ({dw:+.1%})  머리축 {m['ax']}/{m['W']}{tag}")
    half = max(max(M[p]["ax"] - M[p]["x0"], M[p]["x1"] - M[p]["ax"]) for p in M) + 16
    maxH = max(M[p]["H"] for p in M); NW = 2 * half + 1
    for p, m in M.items():
        im = Image.open(p).convert("RGBA"); out = Image.new("RGBA", (NW, maxH), (255, 0, 255, 255))
        out.paste(im, (half - m["ax"], maxH - im.size[1])); out.save(p)
    print(f"공통 캔버스 {NW}×{maxH}, 머리 축 x={half}")
    strip = f"art/out/{cls}_all.png"
    order = [p for act in ACTS for p in cells[act]]
    r = subprocess.run(["python3", "art/align-frames.py", strip, *order, "--cell", "128"], capture_output=True, text=True)
    print("\n".join(l for l in r.stdout.splitlines() if "공통 크롭" in l or "완성" in l))
    jobs = [f"hero_{cls}_{act}:{4 * i},{4 * i + 1},{4 * i + 2},{4 * i + 3}" for i, act in enumerate(ACTS)]
    r = subprocess.run(["python3", "art/inject-frames.py", strip, "128", *jobs], capture_output=True, text=True)
    print("\n".join(l for l in r.stdout.splitlines() if "hero_" in l or "아틀라스" in l))
    html = io.open(GAME, encoding="utf-8").read()
    a = html.index("const ATLAS_FRAMES = ") + len("const ATLAS_FRAMES = "); b = html.index("};", a) + 1; fr = json.loads(html[a:b])
    at = np.array(Image.open(ATLAS).convert("RGBA"))
    def cell_stats(f, i=0):
        m = at[f["y"]:f["y"] + 128, f["x"] + i * 128:f["x"] + (i + 1) * 128, 3] > 8; ys, xs = np.where(m); bot = ys.max()
        fax = int(np.median(np.concatenate([np.where(m[y])[0] for y in range(bot - 7, bot + 1) if m[y].any()])))
        lo = max(0, fax - 24); band = m[:, lo:fax + 24]; top = np.where(band.any(1))[0].min(); mids = []
        for y in range(top + 2, top + 12):
            r = np.where(band[y])[0]
            if len(r): mids.append((r.min() + r.max()) / 2 + lo)
        ax = float(np.mean(mids)); band2 = m[:, int(ax) - 7:int(ax) + 7]; top2 = np.where(band2.any(1))[0].min()
        return bot - top2, (bot + 1) / 128, ax
    pb, pf, pax = cell_stats(fr["hero_paladin_idle"]); hb, hf, hax = cell_stats(fr[f"hero_{cls}_idle"])
    sp = fr["hero_paladin_idle"]["s"]; s = round(sp * pb / hb, 6)
    oy = round((pf - .5) * 128 * sp / s - (hf - .5) * 128); ox = round(pax - hax)
    for act in ACTS: fr[f"hero_{cls}_{act}"].update({"s": s, "oy": oy, "ox": ox})
    html = html[:a] + json.dumps(fr, separators=(",", ":"), ensure_ascii=False) + html[b:]; io.open(GAME, "w", encoding="utf-8").write(html)
    print(f"\n성기사 몸 {pb} 발 {pf:.4f} 축 {pax:.1f}  |  {cls} 몸 {hb} 발 {hf:.4f} 축 {hax:.1f}  →  s {s} oy {oy} ox {ox}")
    for act in ACTS:
        f = fr[f"hero_{cls}_{act}"]; print(f"  {act:7} 머리 축 " + " ".join(f"{cell_stats(f, i)[2]:.1f}" for i in range(4)) + "   몸 " + " ".join(str(cell_stats(f, i)[0]) for i in range(4)))

if __name__ == "__main__": main()

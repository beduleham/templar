#!/usr/bin/env python3
"""2차 머리 장식 시트 두 장을 갈래 열로 잘라 아틀라스에 넣는다(§144).

사용:  python3 art/head-sheet.py

■ 오오라(aura-sheet.py)와 무엇이 다른가

오오라는 **직업**의 것이라 직업 색을 그림에 구워 넣었다(직업이 곧 색이다).
머리 장식은 **갈래**의 것인데 색은 **마디**마다 다르다 — 2차 마디 열여섯이
칼날 갈래 안에서도 검성 #e0c2ff · 검의달인 #ffd36e · 명사수 #c2e06a 로 갈린다.
색을 구워 넣으면 그 구분이 사라진다.

그래서 시트를 **흰빛으로만** 받아 게임에서 마디 색으로 물들인다. 모양은 갈래가,
색은 마디가 말하는 지금 구조가 그대로 남는다.

■ 바닥선이 아니라 **밑선**

오오라는 인물을 둘러싸는 타원이라 「가장 넓은 줄」에 발밑을 맞췄다. 머리 장식은
머리 위에 **얹히는** 것이므로 맞출 자리가 다르다 — 내용의 **아래 끝**이다.
갈래마다 높이가 다른데(후광은 납작하고 칼날관은 높다) 아래 끝을 맞춰야 열 가지가
같은 선 위에 앉는다.
"""
import io, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib
import numpy as np
from PIL import Image

GAME = "game/index.html"
ATLAS = "art/atlas.png"
CELL = 96                       # 화면에서 40~60px 로 그린다 — 96 이면 넉넉하다
COLS, ROWS = 4, 5
SHEETS = [("art/src/fx_head_a.png", ["holy", "iron", "blade", "flame", "frost"]),
          ("art/src/fx_head_b.png", ["blood", "shadow", "arcane", "fang", "storm"])]
FPS = 8
CUT = 118


def lumamask(a, cut=26):
    return a[:, :, :3].max(2) > cut


def gaps(mask, lo, hi):
    out = []
    for x in range(lo, hi):
        if mask[x]: continue
        if out and x == out[-1][1] + 1: out[-1][1] = x
        else: out.append([x, x])
    return out


def cut_at(mask, n, size):
    return [sum(max(gaps(mask, round(size * (j / n - .1)), round(size * (j / n + .1))),
                    key=lambda t: t[1] - t[0])) // 2
            for j in range(1, n)]


def build(quiet=False):
    out = {}
    for path, motifs in SHEETS:
        im = Image.open(path).convert("RGB")
        a = np.array(im).astype(np.int16)
        H, W = a.shape[:2]
        fg = lumamask(a)
        ys = cut_at(fg.sum(1) > 0, ROWS, H)
        xs = cut_at(fg.sum(0) > 0, COLS, W)
        if not quiet:
            print(f"  {os.path.basename(path)} {W}x{H}: 가로선 {ys} · 세로선 {xs}")
        for r, (y0, y1) in enumerate(zip([0] + ys, ys + [H])):
            strip = Image.new("RGBA", (CELL * COLS, CELL), (0, 0, 0, 0))
            bots, wide = [], 0
            for i, (x0, x1) in enumerate(zip([0] + xs, xs + [W])):
                c = np.clip(a[y0:y1, x0:x1], 0, 255).astype(np.float32)
                al = np.clip(c.max(2) / CUT, 0, 1) ** .85 * 255
                on = al > 40
                ry = np.nonzero(on.any(1))[0]
                rx = np.nonzero(on.any(0))[0]
                if ry.size:
                    bots.append((ry[-1] + 1) / al.shape[0])
                    wide = max(wide, (rx[-1] - rx[0] + 1) / al.shape[1])
                rgba = np.dstack([c, al]).astype(np.uint8)
                strip.alpha_composite(Image.fromarray(rgba, "RGBA").resize((CELL, CELL), Image.LANCZOS), (i * CELL, 0))
            key = "fx_head_" + motifs[r]
            hb = round(sum(bots) / max(1, len(bots)), 3)
            out[key] = (strip, hb, round(wide, 3))
            if not quiet:
                print(f"    {key:<18} 밑선 {hb:.3f} · 내용 폭 {wide:.2f}")
    return out


def main():
    strips = build()
    html = io.open(GAME, encoding="utf-8").read()
    frames, aa, bb = atlaslib.frames_of(html)
    atlas = Image.open(ATLAS).convert("RGBA")
    AW, AH = atlas.size
    need = sum(CELL for k in strips if k not in frames)
    new = Image.new("RGBA", (AW, AH + need), (0, 0, 0, 0)); new.paste(atlas, (0, 0))

    y = AH
    for key, (strip, hb, wide) in strips.items():
        reuse = key in frames and frames[key]["w"] == CELL
        ty = frames[key]["y"] if reuse else y
        new.paste(Image.new("RGBA", (CELL * COLS, CELL), (0, 0, 0, 0)), (0, ty))
        new.paste(strip, (0, ty), strip)
        frames[key] = {"x": 0, "y": ty, "w": CELL, "h": CELL, "n": COLS, "fps": FPS, "hb": hb}
        if not reuse: y += CELL
    new = new.crop((0, 0, AW, max(y, AH)))

    atlaslib.save(atlaslib.put_frames(html, frames, aa, bb), new)
    print(f"\n머리 장식 {len(strips)}줄  아틀라스 {AW}x{AH} → {new.size[0]}x{new.size[1]}")


if __name__ == "__main__":
    main()

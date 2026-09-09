#!/usr/bin/env python3
"""3차 궤도를 도는 물체 두 장을 갈래 열로 잘라 아틀라스에 넣는다(§145).

사용:  python3 art/orbit-sheet.py

■ 왜 「고리」가 아니라 「물체」인가

궤도는 코드가 이미 만들고 있다 — 타원 위 여러 자리에 물체를 놓고, **뒤로 갈 때는
주인공보다 먼저 그린다**(가려진다). 그 앞뒤 가름은 회귀가 지킨다(orbit-depth).
고리를 통째로 그림 한 장으로 바꾸면 그 깊이가 사라진다. 그래서 갈아 끼우는 것은
**도는 물체 한 개**뿐이고, 도는 일과 가려지는 일은 코드에 그대로 남는다.

■ 칸을 잘라 낸다(머리 장식과 반대)

머리 장식은 **얹히는** 것이라 칸을 통째로 두고 아래 끝을 맞췄다. 궤도 물체는
타원 위의 한 점에 **가운데를 맞춰** 놓이므로, 내용만 잘라 내 가운데를 맞추는 편이
정확하다. 다만 **한 줄은 한 배율**이다 — 프레임마다 배율이 다르면 도는 동안
물체가 들썩인다(fx-sheet 가 같은 이유로 그렇게 한다).
"""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib
import numpy as np
from PIL import Image

GAME, ATLAS = "game/index.html", "art/atlas.png"
CELL, COLS, ROWS, FPS, CUT = 64, 4, 5, 8, 118
SHEETS = [("art/src/fx_orbit_a.png", ["holy", "iron", "blade", "flame", "frost"]),
          ("art/src/fx_orbit_b.png", ["blood", "shadow", "arcane", "fang", "storm"])]


def lumamask(a, cut=26): return a[:, :, :3].max(2) > cut
def gaps(mask, lo, hi):
    out = []
    for x in range(lo, hi):
        if mask[x]: continue
        if out and x == out[-1][1] + 1: out[-1][1] = x
        else: out.append([x, x])
    return out
def cut_at(mask, n, size):
    return [sum(max(gaps(mask, round(size * (j / n - .1)), round(size * (j / n + .1))),
                    key=lambda t: t[1] - t[0])) // 2 for j in range(1, n)]


def build(quiet=False):
    out = {}
    for path, motifs in SHEETS:
        a = np.array(Image.open(path).convert("RGB")).astype(np.int16)
        H, W = a.shape[:2]
        fg = lumamask(a)
        ys, xs = cut_at(fg.sum(1) > 0, ROWS, H), cut_at(fg.sum(0) > 0, COLS, W)
        if not quiet: print(f"  {os.path.basename(path)} {W}x{H}: 가로선 {ys} · 세로선 {xs}")
        for r, (y0, y1) in enumerate(zip([0] + ys, ys + [H])):
            cells = []
            for x0, x1 in zip([0] + xs, xs + [W]):
                c = np.clip(a[y0:y1, x0:x1], 0, 255).astype(np.float32)
                al = np.clip(c.max(2) / CUT, 0, 1) ** .85 * 255
                on = al > 40
                if not on.any(): cells.append(None); continue
                yy, xx = np.nonzero(on)
                cells.append((c, al, (xx.min(), yy.min(), xx.max() + 1, yy.max() + 1)))
            big = max((max(b[2] - b[0], b[3] - b[1]) for _, _, b in cells if cells and _ is not None), default=1)
            k = (CELL * .92) / big                      # 한 줄은 한 배율
            strip = Image.new("RGBA", (CELL * COLS, CELL), (0, 0, 0, 0))
            for i, cc in enumerate(cells):
                if not cc: continue
                c, al, b = cc
                rgba = np.dstack([c[b[1]:b[3], b[0]:b[2]], al[b[1]:b[3], b[0]:b[2]]]).astype(np.uint8)
                ci = Image.fromarray(rgba, "RGBA")
                w, h = max(1, round(ci.width * k)), max(1, round(ci.height * k))
                ci = ci.resize((w, h), Image.LANCZOS)
                strip.alpha_composite(ci, (i * CELL + (CELL - w) // 2, (CELL - h) // 2))
            out["fx_orbit_" + motifs[r]] = strip
            if not quiet: print(f"    fx_orbit_{motifs[r]:<8} 가장 큰 프레임 {big}px → 배율 {k:.3f}")
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
    for key, strip in strips.items():
        reuse = key in frames and frames[key]["w"] == CELL
        ty = frames[key]["y"] if reuse else y
        new.paste(Image.new("RGBA", (CELL * COLS, CELL), (0, 0, 0, 0)), (0, ty))
        new.paste(strip, (0, ty), strip)
        frames[key] = {"x": 0, "y": ty, "w": CELL, "h": CELL, "n": COLS, "fps": FPS}
        if not reuse: y += CELL
    new = new.crop((0, 0, AW, max(y, AH)))
    atlaslib.save(atlaslib.put_frames(html, frames, aa, bb), new)
    print(f"\n궤도 물체 {len(strips)}줄  아틀라스 {AW}x{AH} → {new.size[0]}x{new.size[1]}")


if __name__ == "__main__":
    main()

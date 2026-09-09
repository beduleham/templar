#!/usr/bin/env python3
"""4차 발밑 마법진 두 장을 갈래 열로 잘라 아틀라스에 넣는다(§145).

사용:  python3 art/sigil-sheet.py

■ 칸을 통째로 쓴다

마법진은 **정원(正圓)** 이고 지면이 눕는 좌표에 그려지므로 화면에서 저절로 타원이
된다. 칸마다 내용을 잘라 내면 갈래마다 고리 반지름이 달라져 「내 땅」의 크기가
들쭉날쭉해진다 — 그건 정보다(4차가 두르는 범위). 그래서 칸을 그대로 쓴다.

■ 가운데는 비어 있어야 한다

이 게임의 피해는 「몇 마리에게 둘러싸였나」를 눈으로 세는 데 걸려 있어서 발밑을
채우면 그 읽기가 통째로 막힌다(adv-look 이 지킨다). 그림을 그렇게 주문했고,
구운 뒤 **가운데가 정말 비었는지 여기서 다시 잰다** — 주문대로 왔는지는 재서 안다.
"""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib
import numpy as np
from PIL import Image

GAME, ATLAS = "game/index.html", "art/atlas.png"
CELL, COLS, ROWS, FPS, CUT = 128, 4, 5, 8, 118
SHEETS = [("art/src/fx_sigil_a.png", ["holy", "iron", "blade", "flame", "frost"]),
          ("art/src/fx_sigil_b.png", ["blood", "shadow", "arcane", "fang", "storm"])]


def lumamask(a, cut=26): return a[:, :, :3].max(2) > cut


def cut_at(dens, n, size):
    """n 칸으로 가르는 경계 — **가장 옅은 줄**을 고른다.

    다른 시트는 「빈 줄」을 찾아 갈랐다. 여기서는 못 쓴다 — 마법진의 빛살·불꽃·
    번개가 칸 경계를 넘어가서 **완전히 빈 줄이 하나도 없다**(그렇게 주문해서 그렇게
    그려져 왔다). 빈 줄을 찾는 자는 여기서 그냥 멈춰 선다.

    비어 있음을 못 쓰면 **가장 덜 찬 구간**을 쓴다. 여기서 한 번 더 틀렸다 —
    처음엔 「가장 옅은 한 줄」(argmin)을 골랐는데, 빛살 사이의 우연한 골에 걸려
    경계가 262·502·776·1058 로 벌어졌다(5줄 1402px 면 280 언저리마다 와야 한다).
    **한 줄은 흔들리고 구간은 안 흔들린다** — 문턱 아래로 내려간 가장 긴 구간을
    찾아 그 한가운데를 쓴다."""
    out = []
    for j in range(1, n):
        lo, hi = round(size * (j / n - .12)), round(size * (j / n + .12))
        w = dens[lo:hi]
        low = w < max(1.0, w.max() * .12)
        best, run, s0 = (0, 0), 0, 0
        for i, v in enumerate(list(low) + [False]):
            if v:
                if run == 0: s0 = i
                run += 1
            else:
                if run > best[1] - best[0]: best = (s0, s0 + run)
                run = 0
        out.append(lo + ((best[0] + best[1]) // 2 if best[1] > best[0] else int(w.argmin())))
    return out


def build(quiet=False):
    out = {}
    for path, motifs in SHEETS:
        a = np.array(Image.open(path).convert("RGB")).astype(np.int16)
        H, W = a.shape[:2]
        fg = lumamask(a)
        ys, xs = cut_at(fg.sum(1), ROWS, H), cut_at(fg.sum(0), COLS, W)
        if not quiet: print(f"  {os.path.basename(path)} {W}x{H}: 가로선 {ys} · 세로선 {xs}")
        for r, (y0, y1) in enumerate(zip([0] + ys, ys + [H])):
            strip = Image.new("RGBA", (CELL * COLS, CELL), (0, 0, 0, 0))
            cores = []
            for i, (x0, x1) in enumerate(zip([0] + xs, xs + [W])):
                c = np.clip(a[y0:y1, x0:x1], 0, 255).astype(np.float32)
                al = np.clip(c.max(2) / CUT, 0, 1) ** .85 * 255
                h, w = al.shape                                  # 가운데 40% 가 비었나
                cores.append((al[int(h*.3):int(h*.7), int(w*.3):int(w*.7)] > 40).mean())
                rgba = np.dstack([c, al]).astype(np.uint8)
                strip.alpha_composite(Image.fromarray(rgba, "RGBA").resize((CELL, CELL), Image.LANCZOS), (i * CELL, 0))
            key = "fx_sigil_" + motifs[r]
            out[key] = strip
            core = sum(cores) / len(cores)
            flag = "" if core < .06 else "  !! 가운데가 찼다 — 포위 읽기를 막는다"
            if not quiet: print(f"    {key:<18} 가운데참 {core:.3f}{flag}")
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
    print(f"\n마법진 {len(strips)}줄  아틀라스 {AW}x{AH} → {new.size[0]}x{new.size[1]}")


if __name__ == "__main__":
    main()

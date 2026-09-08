#!/usr/bin/env python3
"""직업 오오라 시트 넉 장을 「직업×차수」 16줄로 잘라 아틀라스에 넣는다(§140).

사용:  python3 art/aura-sheet.py

■ fx-sheet.py 와 무엇이 다른가

`fx-sheet.py` 는 **칸마다 내용을 잘라내 가운데 맞춘다**(bbox 크롭 + 줄당 한 배율).
한 번 터지고 사라지는 이펙트는 그래야 크기가 고르다.

오오라는 반대다. **발밑에 고정된 채 계속 도는 것**이라, 칸에서 잘라 내 가운데
맞추면 차수마다 바닥 고리의 높이가 달라져 오오라가 위아래로 들썩인다. 그리고
1차가 작고 4차가 큰 것은 **그리려던 것**인데(차수가 오를수록 세진다), 칸마다
꽉 차게 키우면 그 차이가 사라진다.

그래서 여기서는 **칸을 통째로** 쓴다. 격자 경계만 찾아 16칸으로 가르고, 여백까지
그대로 CELL 정사각에 넣는다. 모든 프레임이 같은 기하를 가지므로 바닥 고리가
제자리에 있고, 1차와 4차의 크기 차이도 그대로 남는다.

알파는 fx-sheet 와 같다 — 배경이 검정이고 가산 합성이므로 밝기가 곧 알파다.
번짐(glow)은 안 준다. 받은 그림이 이미 빛 그림이라 선 사이가 비어 있지 않다.
"""
import io, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib
import numpy as np
from PIL import Image

GAME = "game/index.html"
ATLAS = "art/atlas.png"
CELL = 128                      # 아틀라스 칸
COLS, ROWS = 4, 4               # 가로 = 프레임, 세로 = 차수
CLASSES = ["paladin", "warrior", "rogue", "mage"]
FPS = 10                        # 넷이 0.4초에 돈다 — 오오라는 이펙트보다 느긋해야 한다
CUT = 118                       # 이 밝기면 알파가 꽉 찬다


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
    """n 칸으로 가르는 경계. j/n 자리 ±10% 안에서 가장 넓은 빈 줄."""
    return [sum(max(gaps(mask, round(size * (j / n - .1)), round(size * (j / n + .1))),
                    key=lambda t: t[1] - t[0])) // 2
            for j in range(1, n)]


def build(quiet=False):
    """직업마다 차수 넷의 4프레임 스트립을 만든다. → {키: (스트립, 바닥선 비율)}"""
    out = {}
    for cls in CLASSES:
        path = f"art/src/fx_aura_{cls}.png"
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
            floors = []
            for i, (x0, x1) in enumerate(zip([0] + xs, xs + [W])):
                c = np.clip(a[y0:y1, x0:x1], 0, 255).astype(np.float32)
                lum = c.max(2)
                al = np.clip(lum / CUT, 0, 1) ** .85 * 255
                """바닥선 — 게임이 이 자리를 발밑에 맞춘다.

                   처음엔 「아래 절반에서 가장 밝은 줄」로 잡았는데 성기사 고리가
                   발밑보다 위에 앉았다. 고리를 정하는 것은 **밝기가 아니라 폭**이다 —
                   4차의 날개처럼 위쪽이 아무리 밝아도 가장 넓은 줄은 바닥 고리다.
                   위쪽 날개에 속지 않게 아래 45% 안에서만 본다."""
                hh = al.shape[0]
                lo, hi = int(hh * .55), int(hh * .96)
                best, by = -1, int(hh * .8)
                for yy in range(lo, hi):
                    on = np.nonzero(al[yy] > 40)[0]
                    if on.size and on[-1] - on[0] > best:
                        best, by = on[-1] - on[0], yy
                floors.append(by / hh)
                rgba = np.dstack([c, al]).astype(np.uint8)
                ci = Image.fromarray(rgba, "RGBA").resize((CELL, CELL), Image.LANCZOS)
                strip.alpha_composite(ci, (i * CELL, 0))
            key = f"fx_aura_{cls}_{r + 1}"
            out[key] = (strip, sum(floors) / len(floors))
            if not quiet:
                print(f"    {key:<20} 바닥선 {out[key][1]:.3f}")
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
    for key, (strip, floor) in strips.items():
        reuse = key in frames and frames[key]["w"] == CELL
        ty = frames[key]["y"] if reuse else y
        new.paste(Image.new("RGBA", (CELL * COLS, CELL), (0, 0, 0, 0)), (0, ty))
        new.paste(strip, (0, ty), strip)
        frames[key] = {"x": 0, "y": ty, "w": CELL, "h": CELL, "n": COLS, "fps": FPS,
                       "fl": round(floor, 3)}
        if not reuse: y += CELL
    new = new.crop((0, 0, AW, max(y, AH)))

    atlaslib.save(atlaslib.put_frames(html, frames, aa, bb), new)
    print(f"\n오오라 {len(strips)}줄  아틀라스 {AW}x{AH} → {new.size[0]}x{new.size[1]}")
    print("바닥선 평균 " + json.dumps({k: round(v[1], 3) for k, v in strips.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""이펙트 시트 한 장을 4프레임 스트립 여러 개로 잘라 아틀라스에 넣는다(§127).

사용:  python3 art/fx-sheet.py

■ 왜 따로 있나

`ui-parts.py` 는 **칸 하나에 부품 하나**를 전제한다(n:1). 이펙트는 그렇지 않다 —
가로 한 줄이 이펙트 하나의 4단계이고, 아틀라스에는 그 넷이 옆으로 붙어 `n:4` 인
프레임 하나로 들어간다. 자르는 규칙도 다르다. 이펙트는 **가산 합성**(lighter)으로
그리므로 배경이 초록이 아니라 검정이고, 알파를 밝기에서 뽑는다 —
초록 키는 가장자리에 초록 테를 남기는데 가산 합성에서는 그 테가 초록빛으로 탄다.

■ 어떻게

  1. 어두운 배경 위에서 밝은 덩어리를 찾아 가로 4 · 세로 5 로 가른다.
     빈 줄을 찾는 방식은 ui-parts 와 같되, 「빈 곳」의 뜻이 초록이 아니라 어둠이다.
  2. 칸마다 밝기로 알파를 만든다. RGB 는 건드리지 않는다 — 가산 합성은
     RGB×알파를 더하므로, 어두운 자리는 알파가 낮아 저절로 안 보인다.
  3. 네 칸을 같은 크기 정사각(CELL)에 비율대로 넣어 옆으로 잇는다.
     한 줄 안에서 단계마다 크기가 다르면 애니메이션이 들썩인다 — **한 줄은 한 배율**로
     맞춘다. 그 줄에서 가장 큰 단계를 기준으로 잡고 나머지는 같은 배율로 줄인다.
  4. 아틀라스에 줄 단위로 넣는다. 이미 있는 이름이면 제자리에 덮어쓴다.
"""
import io, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib
import numpy as np
from PIL import Image

GAME = "game/index.html"
ATLAS = "art/atlas.png"
SHEET = "art/src/fx_shape_sheet.png"
CELL = 128                      # 아틀라스 칸. 화면에서는 90~130px 로 그린다
COLS, ROWS = 4, 5

# 줄 이름과 넘김 속도. 넷이 0.2~0.3초에 지나간다 — 느리면 굼뜨고 빠르면 안 보인다.
FX = [("fx_pillar",   16),      # 내리꽂히는 빛기둥 — 낙뢰(skStrike)
      ("fx_crescent", 20),      # 앞으로 긋는 참격 — 참격(skSlash)
      ("fx_wedge",    16),      # 앞으로 미는 쐐기 — 돌진(skDash)
      ("fx_implode",  18),      # 안으로 빨려드는 붕괴 — 순간이동이 떠나는 자리
      ("fx_volley",   20)]      # 쏟아져 나가는 발사 — 탄막(skBurst)


def lumamask(a, cut=26):
    """밝기로 본 내용. 배경이 검정이라 밝기가 곧 알파다."""
    return a[:, :, :3].max(2) > cut


def gaps(mask, lo, hi):
    """[lo, hi) 안의 빈 줄들. ui-parts 의 empty_runs 와 같은 규칙."""
    out = []
    for x in range(lo, hi):
        if mask[x]: continue
        if out and x == out[-1][1] + 1: out[-1][1] = x
        else: out.append([x, x])
    return out


def cut(mask, n, size):
    """n 칸으로 가르는 경계. j/n 자리 ±10% 안에서 가장 넓은 빈 줄(§124 와 같은 규칙)."""
    return [sum(max(gaps(mask, round(size * (j / n - .1)), round(size * (j / n + .1))),
                    key=lambda t: t[1] - t[0])) // 2
            for j in range(1, n)]


def main():
    im = Image.open(SHEET).convert("RGB")
    a = np.array(im).astype(np.int16)
    H, W = a.shape[:2]
    fg = lumamask(a)
    ys = cut(fg.sum(1) > 0, ROWS, H)
    print(f"  {os.path.basename(SHEET)} {W}x{H}: 가로선 {ys}")

    strips = []
    for r, (y0, y1) in enumerate(zip([0] + ys, ys + [H])):
        band = fg[y0:y1]
        xs = cut(band.sum(0) > 0, COLS, W)
        cells = []
        for x0, x1 in zip([0] + xs, xs + [W]):
            c = a[y0:y1, x0:x1]
            m = lumamask(c)
            if not m.any(): cells.append(None); continue
            yy, xx = np.nonzero(m)
            box = (xx.min(), yy.min(), xx.max() + 1, yy.max() + 1)
            cells.append((c[box[1]:box[3], box[0]:box[2]], box))
        # 한 줄은 한 배율 — 단계마다 배율이 다르면 애니메이션이 들썩인다
        big = max((max(cc[0].shape[0], cc[0].shape[1]) for cc in cells if cc), default=1)
        k = (CELL * .94) / big
        strip = Image.new("RGBA", (CELL * COLS, CELL), (0, 0, 0, 0))
        for i, cc in enumerate(cells):
            if not cc: continue
            src = cc[0]
            lum = src.max(2).astype(np.float32)
            al = np.clip(lum / 190.0, 0, 1) ** .85 * 255      # 밝기 = 알파
            rgba = np.dstack([np.clip(src, 0, 255), al]).astype(np.uint8)
            ci = Image.fromarray(rgba, "RGBA")
            w, h = max(1, round(ci.width * k)), max(1, round(ci.height * k))
            ci = ci.resize((w, h), Image.LANCZOS)
            strip.alpha_composite(ci, (i * CELL + (CELL - w) // 2, (CELL - h) // 2))
        strips.append(strip)
        print(f"  {FX[r][0]:<13} 세로선 {xs}  가장 큰 단계 {big}px → 배율 {k:.3f}")

    html = io.open(GAME, encoding="utf-8").read()
    frames, aa, bb = atlaslib.frames_of(html)
    atlas = Image.open(ATLAS).convert("RGBA")
    AW, AH = atlas.size
    need = sum(CELL for (k, _), _ in zip(FX, strips) if k not in frames)
    new = Image.new("RGBA", (AW, AH + need), (0, 0, 0, 0)); new.paste(atlas, (0, 0))

    y = AH
    for (key, fps), strip in zip(FX, strips):
        reuse = key in frames and frames[key]["w"] == CELL
        ty = frames[key]["y"] if reuse else y
        new.paste(Image.new("RGBA", (CELL * COLS, CELL), (0, 0, 0, 0)), (0, ty))
        new.paste(strip, (0, ty), strip)
        frames[key] = {"x": 0, "y": ty, "w": CELL, "h": CELL, "n": COLS, "fps": fps}
        print(f"{key:<14}y={ty:5d}  {COLS}프레임  fps={fps}{'  (제자리)' if reuse else '  (새 줄)'}")
        if not reuse: y += CELL
    new = new.crop((0, 0, AW, max(y, AH)))

    atlaslib.save(atlaslib.put_frames(html, frames, aa, bb), new)
    print(f"\n이펙트 {len(FX)}줄  아틀라스 {AW}x{AH} → {new.size[0]}x{new.size[1]}")


if __name__ == "__main__":
    main()

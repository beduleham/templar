#!/usr/bin/env python3
"""아틀라스에서 아무도 안 쓰는 가로줄을 걷어낸다.

사용:  python3 art/repack-atlas.py [--dry]

■ 왜

아틀라스는 도구가 그림을 넣을 때마다 **아래에 줄을 덧붙이는** 방식으로 자랐다.
128칸 격자에 맞춰 한 줄씩 붙이고, 나중에 그 자리를 다시 안 쓰면 그대로 남는다.
잰 값: 512×16640 중 프레임이 선언한 넓이가 81%, **19% 가 아무도 안 보는 자리**였다.

빈 자리는 PNG 에서 거의 안 무겁지만(투명 픽셀은 잘 눌린다) **키가 16640 이라 WebP
가 안 된다** — WebP 는 한 변 16383 까지다. 그러니까 이 도구는 용량을 줄이려고
있는 게 아니라 **WebP 로 갈 수 있게 만들려고** 있다. 실제 절약은 WebP 가 한다.

■ 어떻게

가로로는 안 건드린다. 폭 512 는 넣는 도구 넷이 다 전제하고 있고, 옆으로 옮기면
그 넷을 다 고쳐야 한다. **세로 줄만** 본다.

  1. 프레임마다 차지하는 줄 [y, y+h) 를 모은다
  2. 겹치거나 붙은 것끼리 합친다  → 살아 있는 띠
  3. 띠를 위에서부터 빈틈없이 다시 쌓는다
  4. 프레임의 y 를 새 자리로 옮긴다

**띠 단위로 옮기는 것이 요점이다.** 빈 가로줄만 골라 지우면 안 된다 — 그림 한 칸
(128줄) 안에도 위아래로 빈 줄이 있고, 그걸 지우면 그 칸의 그림이 세로로 찌그러진다.
"""
import io, os, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib

GAME = "game/index.html"
ATLAS = "art/atlas.png"


def main():
    dry = "--dry" in sys.argv
    html = io.open(GAME, encoding="utf-8").read()
    frames, a, b = atlaslib.frames_of(html)
    atlas = Image.open(ATLAS).convert("RGBA")
    AW, AH = atlas.size

    # 1~2. 살아 있는 띠
    spans = sorted((f["y"], f["y"] + f["h"]) for f in frames.values())
    bands = []
    for y0, y1 in spans:
        if bands and y0 <= bands[-1][1]: bands[-1][1] = max(bands[-1][1], y1)
        else: bands.append([y0, y1])
    live = sum(y1 - y0 for y0, y1 in bands)
    print(f"아틀라스 {AW}x{AH} · 프레임 {len(frames)}개가 띠 {len(bands)}개로 "
          f"{live}줄을 쓴다 — 빈 자리 {AH - live}줄 ({(AH - live) / AH * 100:.1f}%)")
    if AH - live == 0 and AH <= atlaslib.WEBP_MAX:
        print("걷어낼 자리가 없다."); return

    # 3~4. 다시 쌓고 y 를 옮긴다
    new = Image.new("RGBA", (AW, live), (0, 0, 0, 0))
    move, ty = {}, 0
    for y0, y1 in bands:
        new.paste(atlas.crop((0, y0, AW, y1)), (0, ty))
        move[(y0, y1)] = ty
        ty += y1 - y0
    for f in frames.values():
        for (y0, y1), nz in move.items():
            if y0 <= f["y"] < y1: f["y"] = nz + f["y"] - y0; break
        else:
            raise SystemExit(f"띠 밖의 프레임이 있다 (y={f['y']})")

    if dry:
        print(f"→ {AW}x{live} 가 된다 (WebP 한 변 {atlaslib.WEBP_MAX} "
              f"{'안' if live <= atlaslib.WEBP_MAX else '밖'})")
        return
    atlaslib.save(atlaslib.put_frames(html, frames, a, b), new)


if __name__ == "__main__":
    main()

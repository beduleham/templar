#!/usr/bin/env python3
"""아틀라스에서 아무도 안 쓰는 가로줄을 걷어낸다.

사용:  python3 art/repack-atlas.py [--dry] [--width 1024]

■ 왜

아틀라스는 도구가 그림을 넣을 때마다 **아래에 줄을 덧붙이는** 방식으로 자랐다.
128칸 격자에 맞춰 한 줄씩 붙이고, 나중에 그 자리를 다시 안 쓰면 그대로 남는다.
잰 값: 512×16640 중 프레임이 선언한 넓이가 81%, **19% 가 아무도 안 보는 자리**였다.

빈 자리는 PNG 에서 거의 안 무겁지만(투명 픽셀은 잘 눌린다) **키가 16640 이라 WebP
가 안 된다** — WebP 는 한 변 16383 까지다. 그러니까 이 도구는 용량을 줄이려고
있는 게 아니라 **WebP 로 갈 수 있게 만들려고** 있다. 실제 절약은 WebP 가 한다.

■ 어떻게

기본은 가로를 안 건드린다. 폭 512 는 넣는 도구 넷이 다 전제하고 있어서다. **세로 줄만**
본다.

■ --width — 한 변의 벽에 닿았을 때

512×15424 까지 자라 15600 문턱(`tests/atlas-budget.js`)에 176줄만 남았다. 빈 줄은
0 이라 걷어낼 것이 없고, 16383 은 WebP 의 진짜 벽이다. 그때의 탈출구가 폭을 넓히는
것이다 — 살아 있는 띠(512 폭)를 **여러 기둥에 나눠 쌓는다**. 띠 하나가 통째로 한
기둥에 들어가므로 그림은 한 점도 안 바뀌고, 프레임의 x 에 기둥 자리(512·k)가 더해질
뿐이다. 넣는 도구 넷은 그대로 돈다 — 새 줄을 맨 아래에 512 폭으로 덧붙이니 오른쪽
기둥 자리가 비지만, 그건 다음 재묶기가 다시 채운다.

옮긴 뒤 **프레임 하나하나를 옛 아틀라스와 픽셀로 대조**한다. 하나라도 다르면 저장하지
않는다. 재묶기는 그림을 옮기는 일이지 바꾸는 일이 아니다.

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
    width = int(sys.argv[sys.argv.index("--width") + 1]) if "--width" in sys.argv else None
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
    if AH - live == 0 and AH <= atlaslib.WEBP_MAX and not (width and width != AW):
        print("걷어낼 자리가 없다."); return

    # 3~4. 다시 쌓고 자리를 옮긴다.
    #      기둥이 여럿이면 띠를 더 잘게 가른다 — 빈 줄이 없는 아틀라스는 띠가 **하나**라서
    #      (지금이 그렇다: 15424줄 한 덩어리) 띠째로는 기둥에 나눠 담을 수가 없다.
    #      프레임이 걸치지 않는 줄이면 어디서든 자를 수 있으므로, 그런 줄로 토막을 내고
    #      토막을 차례로 기둥에 채운다. 토막 안은 통째로 옮기니 그림은 안 바뀐다.
    W2 = width or AW
    if W2 % AW: raise SystemExit(f"--width 는 {AW} 의 배수여야 한다")
    ncol = W2 // AW
    if ncol > 1:
        edges = sorted({e for y0, y1 in spans for e in (y0, y1)})
        cuts = [e for e in edges if not any(y0 < e < y1 for y0, y1 in spans)]
        pieces = [(cuts[i], cuts[i + 1]) for i in range(len(cuts) - 1)]
    else:
        pieces = [tuple(b) for b in bands]
    goal = -(-live // ncol)                     # 기둥 하나의 목표 높이(올림)
    colH, c = [0] * ncol, 0
    move = {}                                   # (y0, y1) -> (기둥 x, 새 y)
    for y0, y1 in pieces:
        h = y1 - y0
        # 이 토막을 얹으면 목표를 넘고, 다음 기둥이 남아 있으면 넘어간다
        if c + 1 < ncol and colH[c] and colH[c] + h > goal and (colH[c] + h - goal) > (goal - colH[c]):
            c += 1
        move[(y0, y1)] = (c * AW, colH[c])
        colH[c] += h
    H2 = max(colH)
    new = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    for (y0, y1), (nx, ny) in move.items():
        new.paste(atlas.crop((0, y0, AW, y1)), (nx, ny))
    old = {k: dict(f) for k, f in frames.items()}
    for f in frames.values():
        for (y0, y1), (nx, ny) in move.items():
            if y0 <= f["y"] < y1: f["x"] += nx; f["y"] = ny + f["y"] - y0; break
        else:
            raise SystemExit(f"띠 밖의 프레임이 있다 (y={f['y']})")

    # 대조 — 프레임마다 옛 자리와 새 자리의 픽셀이 같아야 한다
    bad = 0
    for k, f in frames.items():
        o = old[k]; w = f["w"] * f.get("n", 1)
        if atlas.crop((o["x"], o["y"], o["x"] + w, o["y"] + f["h"])).tobytes() != \
           new.crop((f["x"], f["y"], f["x"] + w, f["y"] + f["h"])).tobytes():
            bad += 1; print(f"  다르다: {k}")
    print(f"프레임 대조 {len(frames)}개 중 다른 것 {bad}개" + ("" if ncol == 1 else
          f" · 기둥 {ncol}개 높이 {colH}"))
    if bad: raise SystemExit("재묶기가 그림을 바꿨다 — 저장하지 않는다")

    if dry:
        print(f"→ {W2}x{H2} 가 된다 (WebP 한 변 {atlaslib.WEBP_MAX} "
              f"{'안' if H2 <= atlaslib.WEBP_MAX else '밖'})")
        return
    atlaslib.save(atlaslib.put_frames(html, frames, a, b), new)


if __name__ == "__main__":
    main()

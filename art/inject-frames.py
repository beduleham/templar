#!/usr/bin/env python3
"""정렬된 프레임 스트립을 아틀라스와 게임 파일에 넣는다.

절차 생성기(make-sprites.js)가 굽는 아틀라스는 셀이 64px 인데,
게임은 그걸 화면에서 1.67배 확대해 그린다(53px × dpr2 = 기기픽셀 107).
즉 지금 스프라이트는 원본보다 크게 늘려 찍히고 있다. 그래서 손으로 그린
그림을 넣을 때는 셀을 128px 로 올리고 s 를 절반으로 내린다 —
화면 크기는 그대로인데 확대가 아니라 살짝 축소가 되어 훨씬 또렷하다.

  기존: 64px × s 0.5  × 1.6675 = 화면 53.4px  (원본의 1.67배로 확대)
  변경: 128px × s 0.25 × 1.6675 = 화면 53.4px  (원본의 0.83배로 축소)

발 위치도 맞춘다. 스프라이트는 셀 중심을 기준으로 찍히므로, 새 그림에서
발이 셀의 더 아래쪽에 있으면 그만큼 위로 올려야 그림자와 발이 맞는다.
그 보정값이 oy 이고 단위는 '셀' 이다.

사용:
  python3 art/inject-frames.py <strip.png> <cell> "<상태:프레임번호들>" ...
  예) python3 art/inject-frames.py art/out/paladin_5.png 128 \\
        hero_paladin_idle:0,0,0,0  hero_paladin_attack:1,2,3,4
"""
import sys, os, json, base64, io
import numpy as np
from PIL import Image, ImageFilter

GAME = "game/index.html"
ATLAS = "art/atlas.png"
SCALE_HERO = 1.15 * 1.45          # player.r/14 * 1.15 * CHAR_SCALE


def feet_frac(cell_img):
    m = Image.fromarray((np.array(cell_img)[:, :, 3] > 8).astype(np.uint8) * 255)
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    ys, _ = np.nonzero(np.array(m) > 0)
    return (ys.max() + 1) / cell_img.size[1]


def main():
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    strip_path, cell = sys.argv[1], int(sys.argv[2])
    jobs = []
    for spec in sys.argv[3:]:
        key, idxs = spec.split(":")
        jobs.append((key, [int(v) for v in idxs.split(",")]))

    strip = Image.open(strip_path).convert("RGBA")
    src = [strip.crop((i * cell, 0, (i + 1) * cell, cell))
           for i in range(strip.size[0] // cell)]

    html = io.open(GAME, encoding="utf-8").read()
    a = html.index("const ATLAS_FRAMES = ") + len("const ATLAS_FRAMES = ")
    b = html.index("};", a) + 1
    frames = json.loads(html[a:b])

    atlas = Image.open(ATLAS).convert("RGBA")
    AW, AH = atlas.size
    need = len(jobs) * cell
    new = Image.new("RGBA", (max(AW, cell * max(len(j[1]) for j in jobs)), AH + need), (0, 0, 0, 0))
    new.paste(atlas, (0, 0))

    # 기존 프레임의 발 위치 — 새 그림을 여기에 맞춘다
    old_key = jobs[0][0]
    of = frames[old_key]
    old_cell = atlas.crop((of["x"], of["y"], of["x"] + of["w"], of["y"] + of["h"]))
    fo = feet_frac(old_cell)
    fn = feet_frac(src[jobs[0][1][0]])
    oy = round((fo - fn) * cell)
    s = round(53.4 / (cell * SCALE_HERO), 6)
    print(f"발 위치  기존 {fo:.4f} → 새 {fn:.4f}   oy = {oy}")
    print(f"셀 {cell}px, s = {s}  →  화면 {cell * s * SCALE_HERO:.1f}px (기존과 동일)")

    # 이미 넣은 적이 있는 줄은 제자리에 덮어쓴다. 매번 아래에 새로 붙이면
    # 다시 넣을 때마다 아틀라스가 계속 자란다 — 걷기를 나중에 받아 다시 돌리는
    # 일이 당연히 생기므로 이건 한 번은 겪는다.
    y = AH
    for key, idxs in jobs:
        f = frames[key]
        reuse = f.get("w") == cell and f.get("y", 0) + cell <= AH
        ty = f["y"] if reuse else y
        if reuse:                                   # 덮어쓰기 전에 그 줄을 비운다
            new.paste(Image.new("RGBA", (new.size[0], cell), (0, 0, 0, 0)), (0, ty))
        for i, fi in enumerate(idxs):
            new.paste(src[fi], (i * cell, ty))
        f.update({"x": 0, "y": ty, "w": cell, "h": cell, "n": len(idxs), "s": s, "oy": oy})
        print(f"  {key:24} y={ty:5d}  {len(idxs)}프레임  fps={f['fps']}"
              f"{'  (제자리 덮어쓰기)' if reuse else ''}")
        if not reuse:
            y += cell
    new = new.crop((0, 0, new.size[0], max(y, AH)))

    new.save(ATLAS)
    html = html[:a] + json.dumps(frames, separators=(",", ":"), ensure_ascii=False) + html[b:]
    buf = io.BytesIO(); new.save(buf, "PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    io.open("art/atlas.b64", "w").write(b64)
    i0 = html.index('Sprites.load("data:image/png;base64,')
    i1 = html.index('"', i0 + len('Sprites.load("'))
    html = html[:i0] + 'Sprites.load("data:image/png;base64,' + b64 + html[i1:]
    io.open(GAME, "w", encoding="utf-8").write(html)
    print(f"\n아틀라스 {AW}x{AH} → {new.size[0]}x{new.size[1]}   "
          f"game/index.html {os.path.getsize(GAME) / 1024:.0f}KB")


if __name__ == "__main__":
    main()

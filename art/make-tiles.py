#!/usr/bin/env python3
"""바닥 타일 낱장을 이어 붙여도 이음매가 안 보이게 고쳐 아틀라스에 넣는다.

캐릭터 그림은 '잘라내는' 일이고 바닥 타일은 '이어 붙이는' 일이라 도구가 다르다.
align-frames.py 는 배경을 지우고 인물에 맞춰 크롭하는데, 타일은 배경이 없고
정사각형을 통째로 쓴다. 대신 여기서만 신경 쓸 것이 세 가지 있다.

  1. 장마다 밝기가 다르면 바닥이 바둑판처럼 얼룩진다.
     칸마다 0~3 중 하나가 무작위로 깔리므로, 한 장만 밝아도 그 장이 깔린 칸이
     전부 밝은 점으로 보인다. 받은 그림의 안쪽 평균이 38.0~44.2 로 6.2 벌어져
     있었다.

  2. 가장자리가 안쪽보다 어두우면(비네팅) 칸 경계마다 어두운 격자가 생긴다.
     받은 그림 중 셋이 가장자리가 1.5~4 어두웠다.

  3. 1·2 를 고쳐도 낱알 무늬는 여전히 경계에서 어긋난다.
     그래서 바깥 띠를 반대쪽 가장자리와 감아 섞는다(wrap blend).

고쳤는지는 눈이 아니라 숫자로 본다. **같은 타일 안에서 이웃한 두 줄의 밝기
차이**가 '자연스러운 값'이고, 이음매를 가로지르는 차이가 그 값 근처면 눈은
경계를 못 찾는다. 받은 그림은 자연값의 3.7~4.0 배였다.

사용:
  python3 art/make-tiles.py <아틀라스키> <타일1.png> <타일2.png> ...
  예) python3 art/make-tiles.py floor art/src/floor_1.png ... --cell 128
"""
import sys, os, json, io, base64
import numpy as np
from PIL import Image, ImageFilter

GAME = "game/index.html"
ATLAS = "art/atlas.png"


def natural(t):
    """같은 타일 안에서 이웃한 두 줄의 평균 밝기 차이 — 이음매의 기준선."""
    l = t.mean(axis=2)
    return (np.abs(l[1:] - l[:-1]).mean() + np.abs(l[:, 1:] - l[:, :-1]).mean()) / 2


def seams(T):
    """모든 조합의 이음매 대비 중 최악값. 가로·세로 둘 다 본다."""
    nat = np.mean([natural(t) for t in T])
    wh = wv = 0
    for a in T:
        for b in T:
            la, lb = a.mean(axis=2), b.mean(axis=2)
            wh = max(wh, np.abs(lb[:, 0] - la[:, -1]).mean())
            wv = max(wv, np.abs(lb[0, :] - la[-1, :]).mean())
    return nat, wh, wv


def flatten(t, sigma):
    """저주파(비네팅·전체 기울기)만 걷어낸다. 낱알과 돌판 조각은 남는다.

    sigma 를 작게 잡으면 묻힌 돌판 조각까지 지워진다 — 조각이 타일의 4분의 1쯤
    되므로 그보다 훨씬 큰 규모만 건드려야 한다."""
    im = Image.fromarray(np.clip(t, 0, 255).astype(np.uint8))
    lo = np.asarray(im.filter(ImageFilter.GaussianBlur(sigma))).astype(float)
    return t - lo + lo.mean(axis=(0, 1))


def wrap_blend(t, band):
    """바깥 띠를 반대쪽 가장자리와 감아 섞는다.

    타일 t 의 왼쪽 띠는 '자기 오른쪽 바깥에 이어 붙을 것'과 만난다. 네 장이
    섞여 깔리므로 특정 상대를 알 수 없다 — 대신 자기 자신의 반대쪽과 섞어
    두면 모든 장의 가장자리가 서로 비슷해져 어느 조합이든 맞는다."""
    o = t.copy()
    w = np.linspace(0, .5, band)[:, None, None]          # 가장자리일수록 많이 섞는다
    o[:band] = t[:band] * (1 - w) + t[-band:][::-1] * w
    o[-band:] = t[-band:] * (1 - w[::-1]) + t[:band][::-1] * w[::-1]
    w2 = w.transpose(1, 0, 2)
    o[:, :band] = o[:, :band] * (1 - w2) + o[:, -band:][:, ::-1] * w2
    o[:, -band:] = o[:, -band:] * (1 - w2[:, ::-1]) + o[:, :band][:, ::-1] * w2[:, ::-1]
    return o


def main():
    argv = sys.argv[1:]
    cell, sigma, band = 128, 40, 8
    for flag in ("--cell", "--sigma", "--band"):
        if flag in argv:
            i = argv.index(flag); v = int(argv[i + 1]); argv = argv[:i] + argv[i + 2:]
            if flag == "--cell": cell = v
            elif flag == "--sigma": sigma = v
            else: band = v
    if len(argv) < 2:
        raise SystemExit(__doc__)
    key, ins = argv[0], argv[1:]

    T = []
    for p in ins:
        im = Image.open(p).convert("RGB").resize((cell, cell), Image.LANCZOS)
        T.append(np.asarray(im).astype(float))
        print(f"  {os.path.basename(p):28} → {cell}x{cell}")

    nat, wh, wv = seams(T)
    print(f"\n손대기 전  자연값 {nat:.2f}   가로 이음매 {wh:.2f}({wh/nat:.1f}배)   세로 {wv:.2f}({wv/nat:.1f}배)")
    print("장별 안쪽 평균 밝기  " + " · ".join(f"{t[16:-16,16:-16].mean():.1f}" for t in T))

    T = [flatten(t, sigma) for t in T]                    # 1·2 비네팅과 기울기
    tgt = np.mean([t.mean(axis=(0, 1)) for t in T], axis=0)
    T = [t - t.mean(axis=(0, 1)) + tgt for t in T]        # 1 장별 밝기 맞추기
    T = [wrap_blend(t, band) for t in T]                  # 3 낱알 이음매
    T = [np.clip(t, 0, 255) for t in T]

    nat2, wh2, wv2 = seams(T)
    print(f"손댄 뒤    자연값 {nat2:.2f}   가로 이음매 {wh2:.2f}({wh2/nat2:.1f}배)   세로 {wv2:.2f}({wv2/nat2:.1f}배)")
    print("장별 안쪽 평균 밝기  " + " · ".join(f"{t[16:-16,16:-16].mean():.1f}" for t in T))
    lum = np.concatenate([t.mean(axis=2).ravel() for t in T])
    print(f"전체 밝기  평균 {lum.mean():.1f}  최대 {lum.max():.1f}  90 넘는 픽셀 {int((lum>90).sum())}개")

    html = io.open(GAME, encoding="utf-8").read()
    a = html.index("const ATLAS_FRAMES = ") + len("const ATLAS_FRAMES = ")
    b = html.index("};", a) + 1
    frames = json.loads(html[a:b])
    f = frames[key]
    if f["w"] != cell or f["h"] != cell:
        raise SystemExit(f"{key} 의 셀이 {f['w']}x{f['h']} 라 {cell} 과 다르다")

    atlas = Image.open(ATLAS).convert("RGBA")
    for i, t in enumerate(T[:f["n"]]):
        img = Image.fromarray(t.astype(np.uint8)).convert("RGBA")
        atlas.paste(img, (f["x"] + i * cell, f["y"]))
    atlas.save(ATLAS)
    print(f"\n{key} {f['n']}장 → 아틀라스 (x={f['x']} y={f['y']})")

    b64 = base64.b64encode(io.open(ATLAS, "rb").read()).decode()
    io.open("art/atlas.b64", "w").write(b64)
    s = html.index('Sprites.load("data:image/png;base64,') + len('Sprites.load("data:image/png;base64,')
    e = html.index('"', s)
    html = html[:s] + b64 + html[e:]
    io.open(GAME, "w", encoding="utf-8").write(html)
    print(f"game/index.html {len(html)//1024}KB")


main()

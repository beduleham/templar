#!/usr/bin/env python3
"""프레임 낱장을 게임에 넣을 수 있는 스프라이트 시트로 만든다.

생성 모델로 애니메이션 프레임을 한 장씩 뽑으면 그림은 잘 나와도 '정합'이 안 맞는다.
프레임마다 인물이 캔버스 안에서 조금씩 위아래로 움직이고, 무기를 치켜든 프레임만
세로로 더 크다. 그대로 각자 잘라 붙이면 화면에서 캐릭터가 까딱거리고 커졌다 작아진다
(14fps 에서는 2px 도 보인다).

그래서 두 가지를 기계적으로 맞춘다.

  1. 발 밑선 정렬 — 프레임마다 알파 경계상자의 '바닥'을 같은 높이로 민다.
     사람이 서 있는 그림이므로 바닥이 곧 접지면이다.
  2. 공통 크롭 창 — 정렬한 뒤 모든 프레임의 경계상자를 합집합으로 묶고,
     그 하나의 창으로 전부 자른다. 절대 프레임마다 그림에 맞춰 자르지 않는다.
     그게 크기 튐의 원인이다. 무기를 치켜든 프레임의 여유는 나머지 프레임에서
     빈 공간으로 남는 게 정답이다.

사용:
  python3 art/align-frames.py OUT.png IN1.png IN2.png ...  [--cell 128] [--key ff00ff]
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter


def key_out(img, key_rgb, tol):
    """배경색을 알파로 뺀다. 이미 알파가 있으면 그대로 둔다.

    마젠타는 색거리로 재면 안 된다. |RGB - ff00ff| 의 합으로 재면
    밝은 강철(#eef2fa)이 264, 마젠타 반투명 가장자리가 220 이라 순서가 뒤집힌다 —
    가장자리를 지우려고 문턱을 올리면 갑옷 하이라이트가 먼저 지워진다.

    마젠타는 'R 과 B 가 둘 다 높고 G 만 낮은' 색이다. min(R,B) - G 로 재면
    강철 -7, 금 -115, 핏빛 십자 +14, 순수 마젠타 +255 로 깔끔하게 갈린다.
    반쯤 섞인 가장자리도 +125 라 같이 걸린다.

    그리고 남은 한 겹을 침식으로 깎는다. 원본이 1254px 라 몇 px 잃어도
    128px 로 줄이면 티가 안 나지만, 안 깎으면 윤곽에 분홍 점이 남는다."""
    rgba = np.array(img.convert("RGBA")).astype(np.int16)
    if (rgba[:, :, 3] < 250).mean() > 0.02:      # 이미 컷아웃된 그림
        return rgba.astype(np.uint8), "기존 알파 사용"
    R, G, B = rgba[:, :, 0], rgba[:, :, 1], rgba[:, :, 2]
    if tuple(key_rgb) == (255, 0, 255):
        bg = (np.minimum(R, B) - G) > 55
    else:
        bg = np.abs(rgba[:, :, :3] - np.array(key_rgb, dtype=np.int16)).sum(axis=2) <= tol
    m = Image.fromarray((~bg).astype(np.uint8) * 255)
    grow = max(2, int(min(img.size) * 0.004))    # 원본 크기에 비례해 깎는다
    m = m.filter(ImageFilter.MinFilter(2 * grow + 1))
    rgba[:, :, 3] = np.array(m)
    return rgba.astype(np.uint8), f"배경 제거 (가장자리 {grow}px 침식)"


def bbox(rgba):
    """알파 경계상자. 잡티에 속으면 안 된다 —
    실제로 받은 프레임 두 장의 왼쪽 아래 구석에 1px 짜리 압축 잡티가 있었고,
    그것 때문에 경계상자가 캔버스 바닥까지 끌려가 '발이 잘렸다'로 잘못 읽혔다.
    그래서 열림 연산(침식 후 팽창)으로 고립된 점을 지우고 나서 잰다.
    검 끝처럼 가느다란 것도 3px 이상이면 살아남는다."""
    m = Image.fromarray((rgba[:, :, 3] > 8).astype(np.uint8) * 255)
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    ys, xs = np.nonzero(np.array(m) > 0)
    if len(ys) == 0:
        raise SystemExit("빈 그림이다 — 배경 제거가 과했는지 확인해라")
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1     # x0,y0,x1,y1


def main():
    args = [a for a in sys.argv[1:]]
    cell, key = 128, "ff00ff"
    for flag, cast in (("--cell", int), ("--key", str)):
        if flag in args:
            i = args.index(flag)
            v = cast(args[i + 1]); args = args[:i] + args[i + 2:]
            if flag == "--cell": cell = v
            else: key = v
    if len(args) < 2:
        raise SystemExit(__doc__)
    out_path, ins = args[0], args[1:]
    key_rgb = tuple(int(key[i:i + 2], 16) for i in (0, 2, 4))

    frames, boxes = [], []
    for p in ins:
        rgba, how = key_out(Image.open(p), key_rgb, 90)
        b = bbox(rgba)
        frames.append(rgba); boxes.append(b)
        print(f"  {os.path.basename(p):28} {rgba.shape[1]}x{rgba.shape[0]}  "
              f"인물 {b[2]-b[0]}x{b[3]-b[1]}  발밑 y={b[3]}  ({how})")

    # 1) 발 밑선 정렬 — 가장 아래에 있는 프레임을 기준으로 나머지를 내린다
    base_foot = max(b[3] for b in boxes)
    shifts = [base_foot - b[3] for b in boxes]
    print(f"\n발 밑선 어긋남: {min(shifts)} ~ {max(shifts)}px "
          f"(캔버스의 {max(shifts) / frames[0].shape[0] * 100:.1f}%)")

    H = max(f.shape[0] for f in frames) + max(shifts)
    Wd = max(f.shape[1] for f in frames)
    canv = []
    for rgba, dy in zip(frames, shifts):
        c = np.zeros((H, Wd, 4), np.uint8)
        c[dy:dy + rgba.shape[0], :rgba.shape[1]] = rgba
        canv.append(c)

    # 2) 공통 크롭 창 — 정렬 후 모든 경계상자의 합집합
    ab = [bbox(c) for c in canv]
    x0 = min(b[0] for b in ab); x1 = max(b[2] for b in ab)
    y0 = min(b[1] for b in ab); y1 = max(b[3] for b in ab)
    pad = int(max(x1 - x0, y1 - y0) * 0.04)
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(Wd, x1 + pad), min(H, y1 + pad)
    side = max(x1 - x0, y1 - y0)                       # 정사각으로
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    sx0, sy0 = cx - side // 2, cy - side // 2
    print(f"공통 크롭 창: {side}x{side} at ({sx0},{sy0}) — 네 장 전부 같은 창")

    strip = Image.new("RGBA", (cell * len(canv), cell), (0, 0, 0, 0))
    for i, c in enumerate(canv):
        big = np.zeros((side, side, 4), np.uint8)      # 창이 캔버스를 벗어나도 안전하게
        ys, xs = max(0, sy0), max(0, sx0)
        ye, xe = min(H, sy0 + side), min(Wd, sx0 + side)
        big[ys - sy0:ye - sy0, xs - sx0:xe - sx0] = c[ys:ye, xs:xe]
        im = Image.fromarray(big).resize((cell, cell), Image.NEAREST)
        strip.paste(im, (i * cell, 0))
    strip.save(out_path)
    print(f"\n완성: {out_path}  {cell * len(canv)}x{cell}  ({len(canv)}프레임 x {cell}px)")


if __name__ == "__main__":
    main()

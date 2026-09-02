#!/usr/bin/env python3
"""성한 가시덤불 그림에서 시든 그림을 만든다.

가시덤불은 체력이 절반 밑으로 내려가면 초록에서 갈색으로 시든다. 그건
'거의 다 부쉈다'는 신호라 없앨 수 없다. 그런데 손그림으로 상태를 따로
받으면 칸 두 장이 변종이 아니라 상태로 다 나가 버린다 — 한 화면에 둘이
같이 보이는데(90분위 2) 둘 다 같은 그림이 된다.

절차로 그리던 코드가 하던 일이 답이었다. **모양은 그대로 두고 밑색만 바꾼다.**

    성한 것  mid = #4a6239 (74,98,61)   밝기 88  채도 33
    시든 것       = #4a4626 (74,70,38)  밝기 66  채도 42

그래서 색만 옮긴다 — 색조를 초록에서 올리브로 돌리고, 어둡게, 채도는 오히려
올린다(마른 풀은 회색이 아니라 누렇다). 모양이 같으므로 시들어도 '같은 덤불이
말라 간다'로 읽힌다. 다른 덤불로 바뀌면 신호가 아니라 사고로 보인다.

마젠타 바탕은 건드리지 않는다 — 키잉이 그 색을 찾는다.

    python3 art/wither.py art/src/thorn_1.png art/src/thorn_1_dry.png
"""
import sys, colorsys
import numpy as np
from PIL import Image

# 절차 그림에서 잰 값 — 지어내지 않는다
DRY_HUE = 42 / 360.0      # 올리브·호박색
KEEP_HUE = .25            # 원래 색조 차이를 이만큼만 남긴다 (전부 한 색이면 평평해진다)
SAT_MUL = 1.30
VAL_MUL = .75


def main():
    src, dst = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(float) / 255.0
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    # 마젠타 바탕 — 게임 도구와 같은 식으로 고른다
    bg = (np.minimum(r, b) - g) * 255 > 55

    hsv = np.asarray([[colorsys.rgb_to_hsv(*px) for px in row] for row in a])
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    # 초록(≈1/3)을 기준으로 벌어진 만큼만 남기고 올리브로 옮긴다
    h2 = (DRY_HUE + (h - 1 / 3.0) * KEEP_HUE) % 1.0
    s2 = np.clip(s * SAT_MUL, 0, 1)
    v2 = np.clip(v * VAL_MUL, 0, 1)
    out = np.asarray([[colorsys.hsv_to_rgb(*px) for px in row]
                      for row in np.dstack([h2, s2, v2])])
    out[bg] = a[bg]                               # 바탕은 그대로
    Image.fromarray((out * 255).round().astype(np.uint8)).save(dst)

    fg = ~bg
    lum = (out[:, :, 0] * .299 + out[:, :, 1] * .587 + out[:, :, 2] * .114) * 255
    mx, mn = out.max(axis=2), out.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0) * 100
    print(f"{dst}  밝기 {lum[fg].mean():.0f}  채도 {sat[fg].mean():.0f}   (절차 시든 것 밝기 66 채도 42)")


main()

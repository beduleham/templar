#!/usr/bin/env python3
"""걷기 시트에 보폭을 넣는다 — 그림이 안 걸을 때 기하로 걷게 만든다.

■ 왜 이런 게 필요한가

전사·마법사의 걷기 시트는 세 번 받는 동안 「서 있는 그림 넷」이었다(§111). 발
구간의 가로 폭이 한 바퀴 동안 전사 6~11px, 마법사 3~4px 밖에 안 움직인다(추적자 38).
생성 모델에 자세를 글로 못 박는 것이 안 통했다.

화면에서 주인공은 53px 이고 그중 다리는 10px 남짓이다. 그 크기에서 「걷는다」로 읽히는
것은 다리의 관절이 아니라 **두 발이 벌어졌다 모였다 하는 것**이다. 그건 그림을 다시
받지 않아도 기하로 만들 수 있다.

■ 무엇을 하는가

허리 아래를 몸 축에서 **부채처럼 벌린다**. 세로 위치에 따라 0(허리)에서 1(발)로 커지는
경사를 두고, 그 줄을 축 기준으로 가로로 늘리거나 줄인다.

    x' = 축 + (x - 축) × f(y)        f(y) = 1 + (f - 1) × 경사(y)

**자르지 않고 늘이는 것이 요점이다.** 두 다리 사이를 갈라 밀면 가운데 걸친 것(전사의
겉옷 자락, 마법사의 로브)이 찢어진다. 늘이면 자락도 같이 벌어져 옷이 흔들린 것으로
읽힌다. 대신 장화도 같이 넓어지는데, 아틀라스에서 장화 하나가 18px 이라 1.3배면
5px 넓어진다 — 화면에서는 2px 다.

■ 넉 장을 어떻게 다르게 하는가

좌우를 같은 배로 벌리면 1번과 3번이 똑같아져 「벌렸다 모았다」하는 제자리뛰기가 된다.
한쪽을 더 벌려 **번갈아** 딛게 한다.

    1번(접지)    왼쪽 wide · 오른쪽 near      왼발이 앞
    2번(지나가기) 양쪽 narrow                  두 발이 모인다
    3번(접지)    왼쪽 near · 오른쪽 wide      오른발이 앞
    4번(지나가기) 양쪽 narrow

몸의 오르내림은 코드가 2·4번에서 띄운다(§111). 접지에서 발이 벌어지고 지나가기에서
모이며 몸이 뜬다 — 순서가 맞는다.

■ 축에서 먼 것은 딸려 가지 않는다

전사의 플레일 공은 발 옆 땅 가까이 늘어져 있다. 축에서 멀어 배를 그대로 곱하면 크게
날아간다. 그래서 축에서 R(반폭의 --hold 배) 밖은 늘이지 않고 R 자리의 이동량만큼
**평행이동**한다. 연속이라 이음매가 안 보인다.

    실행: python3 art/stride-warp.py art/src/warrior_walk_sheet_try2.png \\
              art/src/warrior_walk_sheet.png --hip .58 --wide 1.40 --narrow .78
"""
import sys
from PIL import Image
import numpy as np

MAGENTA = (255, 0, 255)


def fg_mask(a):
    R, G, B = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    return ~((np.minimum(R, B) - G) > 55)


def widest_empty(mask, lo, hi):
    best, run = (0, None), None
    for i in range(lo, hi):
        if not mask[i]:
            if run is None:
                run = i
        elif run is not None:
            if i - run > best[0]:
                best = (i - run, (run, i))
            run = None
    if run is not None and hi - run > best[0]:
        best = (hi - run, (run, hi))
    return best[1]


def split(im):
    """2×2 를 네 칸으로. hero-sheets.py 와 같은 자리에서 자른다."""
    a = np.asarray(im.convert('RGB'))
    fg = fg_mask(a)
    H, W = fg.shape
    rb = widest_empty(fg.any(axis=1), H // 3, 2 * H // 3)
    if rb is None:
        sys.exit('가운데 1/3 에 빈 가로 띠가 없다 — 칸을 못 가른다')
    cut_r = (rb[0] + rb[1]) // 2
    boxes = []
    for y0, y1 in ((0, cut_r), (cut_r, H)):
        cb = widest_empty(fg[y0:y1].any(axis=0), W // 3, 2 * W // 3)
        if cb is None:
            sys.exit('빈 세로 띠가 없다 — 칸을 못 가른다')
        cut_c = (cb[0] + cb[1]) // 2
        boxes += [(0, y0, cut_c, y1), (cut_c, y0, W, y1)]
    return boxes


def warp_cell(cell, hip, fl, fr, hold):
    """허리 아래를 축에서 부채처럼 벌린다. 왼쪽 fl 배, 오른쪽 fr 배."""
    a = np.asarray(cell.convert('RGB')).copy()
    fg = fg_mask(a)
    ys = np.where(fg.any(axis=1))[0]
    if not len(ys):
        return cell
    y0, y1 = ys[0], ys[-1]
    h = y1 - y0 + 1
    y_hip = int(round(y0 + h * hip))
    out = a.copy()
    for y in range(y_hip, y1 + 1):
        row = a[y]
        xs = np.where(fg[y])[0]
        if not len(xs):
            continue
        # 축은 **허리 줄**의 좌우 중점이다. 그 줄에서 아래로 내려가며 넓어지므로
        # 줄마다 축을 다시 잡으면 벌어진 만큼 축이 따라 움직여 아무 일도 안 난다.
        t = (y - y_hip) / max(1, y1 - y_hip)
        new = np.full_like(row, 0)
        new[:] = MAGENTA
        W = len(row)
        for x in range(W):
            f = 1 + ((fl if x < warp_cell.axis else fr) - 1) * t
            d = x - warp_cell.axis
            R = warp_cell.half * hold
            if abs(d) <= R:
                sx = warp_cell.axis + d / f
            else:                                   # 축에서 먼 것은 평행이동
                sx = x - np.sign(d) * (R * (f - 1)) / f
            sx = int(round(sx))
            if 0 <= sx < W:
                new[x] = row[sx]
        out[y] = new
    return Image.fromarray(out)


def main(argv):
    src, dst = argv[0], argv[1]
    opt = dict(hip=.58, wide=1.40, near=1.12, narrow=.78, hold=.55)
    i = 2
    while i < len(argv):
        k = argv[i].lstrip('-')
        opt[k] = float(argv[i + 1])
        i += 2
    im = Image.open(src).convert('RGB')
    out = im.copy()
    for n, (x0, y0, x1, y1) in enumerate(split(im)):
        cell = im.crop((x0, y0, x1, y1))
        a = np.asarray(cell)
        fg = fg_mask(a)
        ys = np.where(fg.any(axis=1))[0]
        h = ys[-1] - ys[0] + 1
        y_hip = int(round(ys[0] + h * opt['hip']))
        hx = np.where(fg[y_hip])[0]
        warp_cell.axis = (hx[0] + hx[-1]) / 2 if len(hx) else (x1 - x0) / 2
        xs = np.where(fg.any(axis=0))[0]
        warp_cell.half = (xs[-1] - xs[0]) / 2
        fl, fr = ((opt['wide'], opt['near']), (opt['narrow'], opt['narrow']),
                  (opt['near'], opt['wide']), (opt['narrow'], opt['narrow']))[n]
        out.paste(warp_cell(cell, opt['hip'], fl, fr, opt['hold']), (x0, y0))
        print(f'  {n + 1}번  축 {warp_cell.axis:.0f}  왼쪽 ×{fl}  오른쪽 ×{fr}')
    out.save(dst)
    print(dst)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1:])

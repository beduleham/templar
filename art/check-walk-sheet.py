#!/usr/bin/env python3
"""걷기 시트를 **넣기 전에** 잰다 — 이 인물이 정말 걷는가.

넣고 나서 tests/walk-feel.js 로 재면 아틀라스를 한 번 부풀렸다 되돌려야 한다.
원본 시트에서 같은 것을 재면 받자마자 통과/불합격을 가른다.

재는 것은 tests/walk-feel.js 와 같다 — 발 구간(인물 아래 16%)의 가로 폭이 넉 장
동안 얼마나 변하는가. 다만 여기서는 두 가지로 잰다.

    전부    발 구간에 있는 것 전부. 늘어뜨린 플레일 공, 짚은 지팡이가 같이 잡힌다
    다리만  그 구간에서 인물 가운데 40% 에 걸치지 않는 덩어리를 뺀다

전사의 플레일 공은 발 옆 땅 가까이 내려온다(§96 에서도 축을 밀었다). 그래서 「전부」
가 무기의 흔들림을 보폭으로 읽을 수 있다. 둘을 같이 찍어 두면 어느 쪽인지 보인다.

기준은 **몸높이 대비 비**로 본다. 시트마다 인물이 그려진 크기가 달라서 픽셀 폭은
바로 못 비교한다. 추적자(제대로 걷는 유일한 시트)가 0.52 이고, 그 시트가 아틀라스에서
38px 이므로 **아틀라스 px ≈ 비 × 72** 다. 문턱 0.30 은 아틀라스 22px 쯤이다.

    실행: python3 art/check-walk-sheet.py art/src/warrior_walk_sheet.png
          python3 art/check-walk-sheet.py --min 0.25 art/src/mage_walk_sheet.png
"""
import sys
from collections import deque
import numpy as np
from PIL import Image

ROGUE = .52   # 추적자 걷기 시트의 다리만 폭비 — 이것이 「걷는다」의 모양이다
PX_PER = 72   # 비 → 아틀라스 px (추적자 0.529 가 38px)
MIN = .30     # 받아들이는 문턱. 로브 입은 인물은 --min 으로 내린다


def split(path):
    """마젠타 빈 띠를 찾아 2×2 로 가른다. hero-sheets.py 와 같은 방식."""
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(int)
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    fg = ~((np.minimum(R, B) - G) > 55)
    H, W = fg.shape

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

    rb = widest_empty(fg.any(axis=1), H // 3, 2 * H // 3)
    if rb is None:
        sys.exit('가운데 1/3 에 빈 가로 띠가 없다 — 칸을 못 가른다')
    cut_r = (rb[0] + rb[1]) // 2
    out = []
    for y0, y1 in ((0, cut_r), (cut_r, H)):
        half = fg[y0:y1]
        cb = widest_empty(half.any(axis=0), W // 3, 2 * W // 3)
        if cb is None:
            sys.exit('빈 세로 띠가 없다 — 칸을 못 가른다')
        cut_c = (cb[0] + cb[1]) // 2
        out += [half[:, 0:cut_c], half[:, cut_c:]]
    return out


def blobs(band):
    lab = np.zeros(band.shape, int)
    n = 0
    h, w = band.shape
    for sy in range(h):
        for sx in range(w):
            if band[sy, sx] and not lab[sy, sx]:
                n += 1
                lab[sy, sx] = n
                q = deque([(sy, sx)])
                while q:
                    y, x = q.popleft()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and band[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n
                            q.append((ny, nx))
    return lab, n


def measure(cell):
    ys = np.where(cell.any(axis=1))[0]
    xs = np.where(cell.any(axis=0))[0]
    y0, y1, x0, x1 = ys[0], ys[-1], xs[0], xs[-1]
    h = y1 - y0 + 1
    band = cell[int(round(y1 - h * .16)):y1 + 1]
    bx = np.where(band.any(axis=0))[0]
    whole = bx[-1] - bx[0] + 1
    # 인물 가운데 40% 에 걸치지 않는 덩어리는 다리가 아니다(늘어뜨린 무기)
    lab, n = blobs(band)
    cx0, cx1 = x0 + (x1 - x0) * .30, x0 + (x1 - x0) * .70
    keep = np.zeros(band.shape, bool)
    for i in range(1, n + 1):
        m = lab == i
        cs = np.where(m.any(axis=0))[0]
        if cs[-1] >= cx0 and cs[0] <= cx1:
            keep |= m
    kx = np.where(keep.any(axis=0))[0]
    return whole, (kx[-1] - kx[0] + 1) if len(kx) else 0, h


def main(paths, floor):
    bad = 0
    for path in paths:
        print(path)
        rows = [measure(c) for c in split(path)]
        for kind, idx in (('전부  ', 0), ('다리만', 1)):
            r = [v[idx] / v[2] for v in rows]
            px = [v[idx] for v in rows]
            span = max(r) - min(r)
            print(f'   {kind}  {px}  몸높이대비 {" ".join(f"{v:.3f}" for v in r)}'
                  f'   차 {span:.3f}')
            if idx == 1:
                verdict = '통과' if span >= floor else '불합격'
                if verdict == '불합격':
                    bad += 1
                print(f'   → 다리 폭비 차 {span:.3f} = 아틀라스 {span * PX_PER:.0f}px 쯤'
                      f'  (문턱 {floor:.2f} · 추적자 {ROGUE}) — {verdict}')
        print('   1·3번이 접지(넓음), 2·4번이 지나가기(좁음)여야 한다')
    return 1 if bad else 0


if __name__ == '__main__':
    args = sys.argv[1:]
    floor = MIN
    if '--min' in args:
        i = args.index('--min')
        floor = float(args[i + 1])
        del args[i:i + 2]
    if not args:
        sys.exit(__doc__)
    sys.exit(main(args, floor))

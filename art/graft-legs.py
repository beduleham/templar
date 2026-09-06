#!/usr/bin/env python3
"""걷는 다리를 빌려 온다 — 상체는 그대로 두고 무릎 아래만 추적자 것으로 간다.

■ 왜

전사 걷기 시트를 세 번 받았는데 세 번 다 「서 있는 그림 넷」이었다(§111). 발 구간의
가로 폭이 한 바퀴 동안 6~11px 밖에 안 움직인다. 추적자 시트는 38px 이다 — 이 판에서
**제대로 걷는 그림은 그것 하나뿐**이다.

화면에서 주인공은 53px 이고 무릎 아래는 12px 남짓이다. 그 크기에서 「걷는다」로 읽히는
것은 관절이 아니라 **두 발이 벌어졌다 모였다 하는 것**이다. 그러니 그 12px 을 추적자
것으로 갈아 끼우면 된다.

■ 어떻게

    ① 두 시트를 각각 네 칸으로 가르고, 추적자를 상체 시트의 키에 맞춰 키운다.
       배율은 **서 있는 2번 칸**으로 잡는다. 1·3번은 웅크린 자세라 키가 작은데,
       그걸로 배율을 잡으면 접지 칸만 커져 다리가 길어진다.
    ② 바닥에서 몸높이의 --cut 배 되는 줄에서 자른다. 위는 상체 시트, 아래는 추적자.
       전사는 겉옷이 무릎까지 내려와 이음매를 덮는다.
    ③ 다리 띠에서 **바닥에 안 닿는 덩어리를 버린다** — 추적자가 든 단검이 그 띠에
       걸린다. 발은 늘 바닥에 닿으므로 이 규칙으로 발만 남는다.
    ④ 색을 상체 쪽으로 옮긴다. 버릴 예정이던 **상체 시트 제 다리**의 색을 밝기 순으로
       늘어놓아 붙임표로 삼고, 추적자 다리의 밝기 백분위를 거기에 대응시킨다. 모양만
       빌리고 재질은 제 것이 된다 — 추적자의 초록 천도 이 단계에서 사라진다.

    실행: python3 art/graft-legs.py art/src/warrior_walk_sheet_try3.png \\
              art/src/rogue_walk_sheet.png art/src/warrior_walk_sheet.png --cut .27 --stride .75

    --cut     바닥에서 몸높이의 몇 배 되는 줄에서 자르는가(기본 .30). 정강이를 얼마나
              가져오는지를 정한다. **보폭은 안 바꾼다** — 27% 로 내려 봤는데 35px 그대로였다.
    --stride  빌린 다리를 축 기준으로 가로로 모으는 배(기본 1). 보폭은 이걸로 줄인다.
"""
import sys
from collections import deque
import numpy as np
from PIL import Image

MAGENTA = (255, 0, 255)
GAP = 40                      # 칸 사이 마젠타 띠. 자동으로 가르는 도구가 이걸 찾는다


def fgm(a):
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


def cells(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im)
    fg = fgm(a)
    H, W = fg.shape
    rb = widest_empty(fg.any(axis=1), H // 3, 2 * H // 3)
    if rb is None:
        sys.exit(f'{path}: 가운데 1/3 에 빈 가로 띠가 없다')
    cut_r = (rb[0] + rb[1]) // 2
    out = []
    for y0, y1 in ((0, cut_r), (cut_r, H)):
        cb = widest_empty(fg[y0:y1].any(axis=0), W // 3, 2 * W // 3)
        if cb is None:
            sys.exit(f'{path}: 빈 세로 띠가 없다')
        cut_c = (cb[0] + cb[1]) // 2
        for x0, x1 in ((0, cut_c), (cut_c, W)):
            sub = fg[y0:y1, x0:x1]
            ys = np.where(sub.any(axis=1))[0]
            xs = np.where(sub.any(axis=0))[0]
            out.append(im.crop((x0 + xs[0], y0 + ys[0], x0 + xs[-1] + 1, y0 + ys[-1] + 1)))
    return out


def drop_floating(mask):
    """바닥에 안 닿는 덩어리를 버린다 — 추적자가 든 단검이 다리 띠에 걸린다."""
    h, w = mask.shape
    keep = np.zeros_like(mask)
    seen = np.zeros_like(mask)
    floor = int(h * .94)
    for sy in range(h):
        for sx in range(w):
            if mask[sy, sx] and not seen[sy, sx]:
                q, blob = deque([(sy, sx)]), []
                seen[sy, sx] = True
                low = sy
                while q:
                    y, x = q.popleft()
                    blob.append((y, x))
                    low = max(low, y)
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
                if low >= floor:
                    for y, x in blob:
                        keep[y, x] = True
    return keep


def ramp_from(img, mask, n=48):
    """밝기 백분위 → 색. 갈아 끼울 자리의 제 색으로 붙임표를 만든다."""
    a = np.asarray(img).astype(float)
    px = a[mask]
    if not len(px):
        return None
    lum = px @ [.299, .587, .114]
    order = np.argsort(lum)
    px, lum = px[order], lum[order]
    edges = np.linspace(0, len(px), n + 1).astype(int)
    return np.array([px[edges[i]:max(edges[i] + 1, edges[i + 1])].mean(axis=0)
                     for i in range(n)])


def recolor(img, mask, ramp):
    a = np.asarray(img).astype(float).copy()
    lum = a[mask] @ [.299, .587, .114]
    rank = np.argsort(np.argsort(lum)) / max(1, len(lum) - 1)
    a[mask] = ramp[np.clip((rank * len(ramp)).astype(int), 0, len(ramp) - 1)]
    return Image.fromarray(a.round().astype(np.uint8))


def axis_at(img, row):
    fg = fgm(np.asarray(img))
    row = min(max(0, row), fg.shape[0] - 1)
    xs = np.where(fg[row])[0]
    if not len(xs):
        xs = np.where(fg.any(axis=0))[0]
    return (xs[0] + xs[-1]) / 2


def main(argv):
    top_p, leg_p, dst = argv[0], argv[1], argv[2]
    cut_frac = .30
    green_cut = 999      # 기본은 안 지운다 — 아래 주석 참고
    do_recolor = '--recolor' in argv
    if '--green' in argv:
        green_cut = int(argv[argv.index('--green') + 1])
    if '--cut' in argv:
        cut_frac = float(argv[argv.index('--cut') + 1])
    stride = float(argv[argv.index('--stride') + 1]) if '--stride' in argv else 1.0
    tops, legs = cells(top_p), cells(leg_p)
    scale = np.median([t.height for t in tops]) / legs[1].height
    print(f'다리 배율 {scale:.3f} (서 있는 2번 칸 기준)')

    made = []
    for i in range(4):
        top, leg = tops[i], legs[i]
        L = leg.resize((max(1, round(leg.width * scale)), max(1, round(leg.height * scale))),
                       Image.NEAREST)
        band_h = int(round(top.height * cut_frac))
        cut = top.height - band_h
        band = L.crop((0, L.height - band_h, L.width, L.height))
        ba0 = np.asarray(band).astype(int)
        # 추적자의 초록 천이 두 다리 사이에 늘어져 있다. 지우는 길 둘을 다 대 봤는데
        # 둘 다 더 나빴다 — 색을 옮기면(--recolor) 띠에서 가장 밝은 축이라 붙임표의
        # 맨 위(하얀 쇠)로 가서 오히려 튀고, 올리브만 골라 지우면(--green) 색이
        # 고르지 않아 천에 구멍이 숭숭 뚫린다. 화면에서 그 천은 2px 이고 전사에게도
        # 붉은 띠와 올리브 자락이 이미 있다. 그대로 두는 것이 낫다.
        olive = ((ba0[:, :, 1] - ba0[:, :, 2]) > green_cut) & (ba0[:, :, 1] >= ba0[:, :, 0])
        bm = drop_floating(fgm(np.asarray(band)) & ~olive)
        if do_recolor:
            # 붙임표는 **장화만**으로 만든다. 이음매 아래 전부를 쓰면 겉옷 자락의
            # 크림색이 섞여 어두운 장화가 하얗게 뜬다(한 번 그렇게 나왔다).
            boot0 = top.height - int(round(top.height * .10))
            own = top.crop((0, boot0, top.width, top.height))
            r = ramp_from(own, fgm(np.asarray(own)))
            if r is not None:
                band = recolor(band, bm, r)
        # 이음매 줄에서 두 그림의 축을 맞춘다
        ax_t, ax_b = axis_at(top, cut - 2), axis_at(band, 1)
        # 보폭 조절. 이음매 높이는 보폭을 안 바꾼다 — 발 자리는 추적자 그림이 정하고
        # 이음매는 정강이를 얼마나 가져오는지만 정한다(27% 로 내려 봤는데 35px 그대로였다).
        # 보폭을 줄이려면 다리 띠를 축 기준으로 가로로 모아야 한다. 장화도 같이
        # 좁아지는데 화면에서 장화 하나가 7px 이라 0.75 배면 2px 다.
        if stride != 1:
            ba_ = np.asarray(band)
            nb = np.full_like(ba_, 255); nb[:, :, 1] = 0
            nm = np.zeros_like(bm)
            for x in range(band.width):
                sx = int(round(ax_b + (x - ax_b) / stride))
                if 0 <= sx < band.width:
                    nb[:, x] = ba_[:, sx]; nm[:, x] = bm[:, sx]
            band, bm = Image.fromarray(nb), nm
        W = max(top.width, band.width) + 120
        cell = Image.new('RGB', (W, top.height), MAGENTA)
        ba = np.asarray(band)
        ox = int(round(W / 2 - ax_b))
        for y in range(band.height):
            for x in range(band.width):
                if bm[y, x] and 0 <= x + ox < W:
                    cell.putpixel((x + ox, cut + y), tuple(int(v) for v in ba[y, x]))
        ta = np.asarray(top)
        tm = fgm(ta)
        tx = int(round(W / 2 - ax_t))
        # 이음매 아래라도 **제 다리만** 지운다. 전사의 늘어뜨린 플레일 공도 그 아래에
        # 있는데 창(가로 범위)으로 가르면 공이 잘린다 — 사슬이 손에서 내려오므로
        # 「이음매 줄에서 축 가까이를 지나는 덩어리」만 다리다.
        own_legs = np.zeros_like(tm)  # 이름을 legs 로 두면 바깥의 네 칸 목록을 덮는다
        q = deque()
        for x in range(top.width):
            if tm[cut, x] and abs(x - ax_t) < top.width * .22:
                own_legs[cut, x] = True
                q.append((cut, x))
        while q:
            y, x = q.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if cut <= ny < top.height and 0 <= nx < top.width \
                        and tm[ny, nx] and not own_legs[ny, nx]:
                    own_legs[ny, nx] = True
                    q.append((ny, nx))
        for y in range(top.height):
            for x in range(top.width):
                if tm[y, x] and not own_legs[y, x] and 0 <= x + tx < W:
                    cell.putpixel((x + tx, y), tuple(int(v) for v in ta[y, x]))
        made.append(cell)
        print(f'  {i + 1}번  이음매 {cut}/{top.height}  다리 띠 {band_h}px')

    cw = max(c.width for c in made) + GAP
    ch = max(c.height for c in made) + GAP
    sheet = Image.new('RGB', (cw * 2 + GAP, ch * 2 + GAP), MAGENTA)
    for i, c in enumerate(made):
        x = GAP + (i % 2) * cw + (cw - GAP - c.width) // 2
        y = GAP + (i // 2) * ch + (ch - GAP - c.height)
        sheet.paste(c, (x, y))
    sheet.save(dst)
    print(dst, sheet.size)


if __name__ == '__main__':
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    main(sys.argv[1:])

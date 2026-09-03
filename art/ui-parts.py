#!/usr/bin/env python3
"""메뉴 UI 부품 시트를 갈라서 아틀라스에 넣는다.

사용:  python3 art/ui-parts.py

■ 배경은 초록이다

지금까지 손그림은 마젠타 배경으로 받았고 `min(R,B) - G` 로 뺐다. UI 는 그 규칙에
걸린다 — **마법사 문장의 보라색이 마젠타로 판정되어 통째로 지워진다**(#8a4fd0 이면
min(138,208) - 79 = 59 > 55). 그래서 UI 부품만 순수 초록 배경으로 받고
`G - max(R,B) > 110` 으로 뺀다. 그림 안의 짙은 숲 초록(추적자 방패)은 차이가 30
남짓이라 안전하게 갈린다.

■ 초록 물빼기

키를 뺀 뒤에도 부드러운 가장자리에는 초록기가 남는다 — 성기사 문장의 후광이 배경과
섞여 초록 테를 두르고 나왔다. 남긴 픽셀 중 G 가 (R+B)/2 보다 높은 만큼을 눌러 준다.
진짜 초록은 R·B 도 함께 낮으므로 눌러도 색이 안 변한다.

■ 로고만 배경이 다르다

로고 시트는 순수 초록이 아니라 **짙은 초록(4,23,15)** 으로 왔다 — G - max(R,B) 가 8
밖에 안 되어 위 규칙에 아예 안 걸리고, 초록 판째로 화면에 실렸다. 로고는 배경색이
고르므로 그 색과의 거리로 뺀다. 두 가지를 조심한다.

  글자 안의 구멍  — A·O·R 의 속은 배경색이지만 테두리에서 이어지지 않는다. 가장자리
                  에서만 번지면 초록 알약이 남는다. 그래서 **두꺼운 배경 덩어리**를
                  씨앗으로 함께 심는다(13칸 침식). 글자 안의 가는 균열은 얇아서 씨앗이
                  못 되고, 속 구멍은 넓어서 씨앗이 된다.
  십자가의 후광    — 배경과 수십 픽셀에 걸쳐 섞인다. 딱 자르면 테가 남으므로 거리 8~45
                  를 알파 경사로 두고, 남긴 색에서 배경이 섞인 몫을 도로 나눈다
                  (언프리멀티플라이). 안 그러면 후광이 초록빛으로 뜬다.

■ 크기는 그리는 크기에 맞춘다

버튼은 화면에서 가로 250 안팎(dpr2 면 500)이라 384px 로 저장한다. 아틀라스는 폭이
512 이므로 넓은 것은 한 줄에 하나씩, 작은 것은 한 줄에 여러 개 담는다. UI 는 늘려
그리므로 128칸 격자에 맞출 이유가 없다 — 조각마다 제 크기를 준다.
"""
import io, os, json, base64
import numpy as np
from PIL import Image, ImageFilter

GAME = "game/index.html"
ATLAS = "art/atlas.png"

# 시트 → 칸 이름 (2×2, 낱장은 하나)
SHEETS = [
    ("art/src/ui_button.png", ["btn", "btn_hover", "btn_sel", "btn_short"], "green"),
    ("art/src/ui_frame.png",  ["panel", "inset", "divider", "corner"], "green"),
    ("art/src/ui_crest.png",  ["crest_paladin", "crest_warrior", "crest_rogue", "crest_mage"], "green"),
    ("art/src/ui_logo.png",   ["logo"], "dark"),
]
# 아틀라스에 넣을 크기와 자리 — (이름, 폭, 높이, 줄 안 x). 같은 줄은 x 로 나눈다.
LAYOUT = [
    [("btn", 384, 72, 0)],
    [("btn_hover", 384, 72, 0)],
    [("btn_sel", 384, 72, 0)],
    [("btn_short", 192, 72, 0)],
    [("panel", 320, 256, 0)],
    [("inset", 224, 184, 0)],
    [("divider", 512, 40, 0)],
    [("crest_paladin", 104, 136, 0), ("crest_warrior", 104, 136, 104),
     ("crest_rogue", 104, 136, 208), ("crest_mage", 104, 136, 312),
     ("corner", 96, 96, 416)],
    [("logo", 512, 248, 0)],
]


def keygreen(im, thresh=110, grow=1):
    a = np.array(im.convert("RGBA")).astype(np.int16)
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    bg = (G - np.maximum(R, B)) > thresh
    m = Image.fromarray((~bg).astype(np.uint8) * 255).filter(ImageFilter.MinFilter(2 * grow + 1))
    a[:, :, 3] = np.array(m)
    lim = (R.astype(np.float32) + B) / 2 + 12          # 초록 물빼기
    a[:, :, 1] = np.clip(G - np.maximum(0, G - lim) * .9, 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def grow_into(seed, m, cap=4000):
    """seed 에서 m 안으로만 번진다 — 이웃으로 한 칸씩, 더 안 늘 때까지."""
    cur = seed & m
    for _ in range(cap):
        n = cur.copy()
        n[1:, :] |= cur[:-1, :]; n[:-1, :] |= cur[1:, :]
        n[:, 1:] |= cur[:, :-1]; n[:, :-1] |= cur[:, 1:]
        n &= m
        if n.sum() == cur.sum(): return cur
        cur = n
    return cur


def keydark(im, lo=8, hi=45, thick=13):
    """고른 짙은 배경을 색 거리로 뺀다 — 로고 시트용."""
    a = np.array(im.convert("RGB")).astype(np.float32)
    bg = np.median(np.concatenate([a[:2].reshape(-1, 3), a[-2:].reshape(-1, 3),
                                   a[:, :2].reshape(-1, 3), a[:, -2:].reshape(-1, 3)]), 0)
    d = np.abs(a - bg).max(2)
    m = d <= hi
    seed = np.array(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(thick))) > 0
    seed[0, :] |= m[0, :]; seed[-1, :] |= m[-1, :]; seed[:, 0] |= m[:, 0]; seed[:, -1] |= m[:, -1]
    out = grow_into(seed, m)
    al = np.ones(d.shape, np.float32)
    al[out] = np.clip((d[out] - lo) / (hi - lo), 0, 1)
    s = al[..., None]
    c = np.where(s > .004, (a - bg * (1 - s)) / np.maximum(s, .004), 0)
    return Image.fromarray(np.dstack([np.clip(c, 0, 255), al * 255]).astype(np.uint8), "RGBA")


def empty_runs(f, lo, hi):
    out = []
    for x in range(lo, hi):
        if f[x]: continue
        if out and x == out[-1][1] + 1: out[-1][1] = x
        else: out.append([x, x])
    return out


def split(path, n, mode):
    im = Image.open(path).convert("RGB")
    if mode == "dark": return [im]
    a = np.array(im).astype(np.int16)
    fg = ~((a[:, :, 1] - np.maximum(a[:, :, 0], a[:, :, 2])) > 110)
    H, W = fg.shape
    if n == 1: return [im]
    r = max(empty_runs(fg.sum(1) > 0, H // 3, 2 * H // 3), key=lambda t: t[1] - t[0])
    cy = (r[0] + r[1]) // 2
    cuts = []
    for y0, y1 in ((0, cy), (cy, H)):
        c = max(empty_runs(fg[y0:y1].sum(0) > 0, W // 4, 3 * W // 4), key=lambda t: t[1] - t[0])
        cuts.append((c[0] + c[1]) // 2)
    print(f"  {os.path.basename(path)}: 가로선 y={cy}, 세로선 위 x={cuts[0]} 아래 x={cuts[1]}")
    return [im.crop(b) for b in [(0, 0, cuts[0], cy), (cuts[0], 0, W, cy),
                                 (0, cy, cuts[1], H), (cuts[1], cy, W, H)]]


FIT = {"logo"}   # 늘리지 않고 칸 안에 맞춰 넣는다 — 글자는 비율이 틀어지면 티가 난다


def fitbox(im, w, h):
    r = min(w / im.size[0], h / im.size[1])
    r2 = im.resize((max(1, round(im.size[0] * r)), max(1, round(im.size[1] * r))), Image.LANCZOS)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(r2, ((w - r2.size[0]) // 2, (h - r2.size[1]) // 2))
    return out


def main():
    parts = {}
    for path, names, mode in SHEETS:
        for im, nm in zip(split(path, len(names), mode), names):
            k = keygreen(im) if mode == "green" else keydark(im)
            a = np.array(k); ys, xs = np.nonzero(a[:, :, 3] > (8 if mode == "green" else 30))
            k = k.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
            k.save(f"art/src/ui_{nm}.png")
            parts[nm] = k

    html = io.open(GAME, encoding="utf-8").read()
    a = html.index("const ATLAS_FRAMES = ") + len("const ATLAS_FRAMES = ")
    b = html.index("};", a) + 1
    frames = json.loads(html[a:b])
    atlas = Image.open(ATLAS).convert("RGBA")
    AW, AH = atlas.size

    # 이미 넣은 적이 있으면 제자리에 덮어쓴다 — 다시 받아 넣는 일이 당연히 생긴다
    known = all(("ui_" + n) in frames for row in LAYOUT for (n, *_ ) in row)
    need = 0 if known else sum(max(h for (_, _, h, _) in row) for row in LAYOUT)
    new = Image.new("RGBA", (AW, AH + need), (0, 0, 0, 0)); new.paste(atlas, (0, 0))

    y = AH
    print(f"\n{'부품':<16}{'원본':>12}{'아틀라스':>12}   자리")
    for row in LAYOUT:
        rh = max(h for (_, _, h, _) in row)
        for (nm, w, h, x) in row:
            fk = "ui_" + nm
            ty = frames[fk]["y"] if known else y
            tx = frames[fk]["x"] if known else x
            src = fitbox(parts[nm], w, h) if nm in FIT else parts[nm].resize((w, h), Image.LANCZOS)
            new.paste(Image.new("RGBA", (w, h), (0, 0, 0, 0)), (tx, ty))
            new.paste(src, (tx, ty), src)
            frames[fk] = {"x": tx, "y": ty, "w": w, "h": h, "n": 1, "fps": 1}
            print(f"{nm:<16}{str(parts[nm].size):>12}{f'{w}x{h}':>12}   x={tx} y={ty}")
        if not known: y += rh
    if not known: new = new.crop((0, 0, AW, y))

    new.save(ATLAS)
    html = html[:a] + json.dumps(frames, separators=(",", ":"), ensure_ascii=False) + html[b:]
    buf = io.BytesIO(); new.save(buf, "PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    io.open("art/atlas.b64", "w").write(b64)
    i0 = html.index('Sprites.load("data:image/png;base64,')
    i1 = html.index('"', i0 + len('Sprites.load("'))
    html = html[:i0] + 'Sprites.load("data:image/png;base64,' + b64 + html[i1:]
    io.open(GAME, "w", encoding="utf-8").write(html)
    print(f"\nUI 부품 {len(parts)}개  아틀라스 {AW}x{AH} → {new.size[0]}x{new.size[1]}   "
          f"game/index.html {os.path.getsize(GAME) / 1024 / 1024:.2f}MB")


if __name__ == "__main__":
    main()

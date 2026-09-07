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
import io, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib
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
    # 2단계(§115) — 게임 안 HUD 틀. 속이 뚫린 틀 넷: 막대 · 칸 · 스킬 버튼 · 경험치 레일
    ("art/src/ui_hud_sheet.png", ["bar", "slot", "skillframe", "rail"], "green"),
    # 3단계(§116) — 배너 리본 넷. 속이 채워진 판이라 글자가 그 위에 얹힌다
    ("art/src/ui_banner_sheet.png", ["ribbon", "ribbon_faith", "ribbon_blood", "ribbon_thin"], "green"),
    # 4단계(§117) — 지도와 상단. 미니맵 틀(뚫림) · 시계 판(채움) · 방향표 화살촉(뚫림) · 보스 체력바 틀(뚫림)
    ("art/src/ui_map_sheet.png", ["mapframe", "clock", "pointer", "bossbar"], "green"),
    # 5단계(§118) — 카드. 카드 액자 일반·각성(뚫림) · 머리띠(채움) · 초상 창틀(뚫림)
    ("art/src/ui_card_sheet.png", ["card", "card_awaken", "cardhead", "portrait"], "green"),
    # §120 도감 — 걸어 본 칸 액자 · 못 간 칸 액자 · 직업 탭 판 · 「다음」 봉인
    ("art/src/codex_sheet.png", ["codex_cell", "codex_cell_locked", "codex_tab", "codex_mark"], "green"),
    # §121 HUD 작은 칩 — 한 줄 칩 · 신앙 저울 홈 · 단계 점 켜짐 · 꺼짐
    ("art/src/hud_chip_sheet.png", ["chip", "scale", "pip_on", "pip_off"], "green"),
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
    # 아틀라스가 1024 폭이 된 뒤라 한 줄에 둘씩 — 막대와 레일은 삼등분, 칸과 스킬은 아홉 조각
    [("bar", 384, 64, 0), ("rail", 512, 32, 384)],
    [("slot", 128, 128, 0), ("skillframe", 192, 192, 128)],
    # 리본은 그림 비율대로(중립 5.0 · 신앙 3.6 · 핏빛 3.4 · 한 줄 12.7). 신앙·핏빛은 끝 메달이
    # 몸보다 위아래로 튀어나와 상자가 높다 — 몸의 세로 범위는 코드(BANNER_BODY)가 따로 안다
    [("ribbon", 384, 77, 0), ("ribbon_thin", 512, 40, 384)],
    [("ribbon_faith", 512, 141, 0), ("ribbon_blood", 512, 151, 512)],
    [("mapframe", 192, 192, 0), ("clock", 384, 112, 192), ("pointer", 96, 96, 576)],
    [("bossbar", 512, 69, 0)],
    [("card", 240, 304, 0), ("card_awaken", 240, 304, 240), ("portrait", 192, 192, 480), ("cardhead", 320, 61, 672)],
    # 도감 칸은 98×112(폰 167×191)에 아홉 조각으로 늘려 그린다 — 귀는 drawSlice9 의 scale 로 칸에 맞춘다
    [("codex_cell", 224, 276, 0), ("codex_cell_locked", 224, 276, 224), ("codex_tab", 416, 100, 448), ("codex_mark", 100, 160, 864)],
    # 한 줄 칩·저울은 화면에서 240×22 안팎이라 384 폭(dpr2 여유). 점은 13×10 에 그리므로 96 으로 충분하다
    [("chip", 384, 64, 0), ("scale", 384, 63, 384), ("pip_on", 96, 52, 768), ("pip_off", 96, 52, 864)],
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

    # 이미 넣은 적이 있는 줄은 제자리에 덮어쓰고, 처음 넣는 줄만 아래에 덧붙인다.
    # 예전엔 「전부 아는가」 하나로 갈라서, 시트를 하나 더 받으면 아는 열셋까지 다시
    # 아래에 붙였을 것이다(1000줄이 두 번 실린다). 줄 단위로 본다.
    known_row = [all(("ui_" + n) in frames for (n, *_ ) in row) for row in LAYOUT]
    need = sum(max(h for (_, _, h, _) in row) for row, k in zip(LAYOUT, known_row) if not k)
    new = Image.new("RGBA", (AW, AH + need), (0, 0, 0, 0)); new.paste(atlas, (0, 0))

    y = AH
    print(f"\n{'부품':<16}{'원본':>12}{'아틀라스':>12}   자리")
    for row, known in zip(LAYOUT, known_row):
        rh = max(h for (_, _, h, _) in row)
        for (nm, w, h, x) in row:
            fk = "ui_" + nm
            ty = frames[fk]["y"] if known else y
            tx = frames[fk]["x"] if known else x
            src = fitbox(parts[nm], w, h) if nm in FIT else parts[nm].resize((w, h), Image.LANCZOS)
            new.paste(Image.new("RGBA", (w, h), (0, 0, 0, 0)), (tx, ty))
            new.paste(src, (tx, ty), src)
            frames[fk] = {"x": tx, "y": ty, "w": w, "h": h, "n": 1, "fps": 1}
            print(f"{nm:<16}{str(parts[nm].size):>12}{f'{w}x{h}':>12}   x={tx} y={ty}{'' if known else '  (새 줄)'}")
        if not known: y += rh
    new = new.crop((0, 0, AW, max(y, AH)))

    atlaslib.save(html[:a] + json.dumps(frames, separators=(",", ":"), ensure_ascii=False) + html[b:], new)
    print(f"\nUI 부품 {len(parts)}개  아틀라스 {AW}x{AH} → {new.size[0]}x{new.size[1]}   "
          f"game/index.html {os.path.getsize(GAME) / 1024 / 1024:.2f}MB")


if __name__ == "__main__":
    main()

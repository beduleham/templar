#!/usr/bin/env python3
"""이펙트 시트 한 장을 4프레임 스트립 여러 개로 잘라 아틀라스에 넣는다(§127).

사용:  python3 art/fx-sheet.py

■ 왜 따로 있나

`ui-parts.py` 는 **칸 하나에 부품 하나**를 전제한다(n:1). 이펙트는 그렇지 않다 —
가로 한 줄이 이펙트 하나의 4단계이고, 아틀라스에는 그 넷이 옆으로 붙어 `n:4` 인
프레임 하나로 들어간다. 자르는 규칙도 다르다. 이펙트는 **가산 합성**(lighter)으로
그리므로 배경이 초록이 아니라 검정이고, 알파를 밝기에서 뽑는다 —
초록 키는 가장자리에 초록 테를 남기는데 가산 합성에서는 그 테가 초록빛으로 탄다.

■ 어떻게

  1. 어두운 배경 위에서 밝은 덩어리를 찾아 가로 4 · 세로 5 로 가른다.
     빈 줄을 찾는 방식은 ui-parts 와 같되, 「빈 곳」의 뜻이 초록이 아니라 어둠이다.
  2. 칸마다 밝기로 알파를 만든다. RGB 는 건드리지 않는다 — 가산 합성은
     RGB×알파를 더하므로, 어두운 자리는 알파가 낮아 저절로 안 보인다.
  3. 네 칸을 같은 크기 정사각(CELL)에 비율대로 넣어 옆으로 잇는다.
     한 줄 안에서 단계마다 크기가 다르면 애니메이션이 들썩인다 — **한 줄은 한 배율**로
     맞춘다. 그 줄에서 가장 큰 단계를 기준으로 잡고 나머지는 같은 배율로 줄인다.
  4. 아틀라스에 줄 단위로 넣는다. 이미 있는 이름이면 제자리에 덮어쓴다.
"""
import io, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib
import numpy as np
from PIL import Image, ImageFilter

GAME = "game/index.html"
ATLAS = "art/atlas.png"
SHEET = "art/src/fx_shape_sheet.png"
CELL = 128                      # 아틀라스 칸. 화면에서는 90~130px 로 그린다
COLS, ROWS = 4, 5

"""줄 이름 · 넘김 속도 · 알파 기준(§128).

넷이 0.2~0.3초에 지나간다 — 느리면 굼뜨고 빠르면 안 보인다.

**cut** 은 「이 밝기면 알파가 꽉 찬다」는 기준, **glow** 는 그림 뒤에 까는 번짐의 양이다.

처음에는 다섯 줄을 다 cut 190 · 번짐 없이 뽑았다. 화면에서 재 보니(배경보다 30 이상
밝아진 픽셀, 한살이 최댓값) 이랬다 — 참격 1,386 · 쐐기 1,438 · 탄막 950 · 기둥 2,474 ·
붕괴 522. 같은 자리에 띄운 기존 폭발(fx_boom_holy)은 **7,748**. 크기는 같은 급인데
진하기가 1/5에서 1/15이었다.

cut 을 190→82~150 으로 낮춰 다시 재 보니 거의 안 움직였다(참격 1,386→1,468).
막힌 곳이 진하기가 아니었던 것이다 — 이 시트는 **가는 선과 흩뿌린 알갱이**라
알파를 꽉 채워도 칸의 3분의 1만 찬다. 폭발은 속이 찬 덩어리라 안 그렇다.
「안 밝다」를 밝기로 고치려다 한 번 헛짚은 셈이고, 실제 병목은 **덮는 넓이**였다.

그래서 선 그림 뒤에 그 그림을 흐린 것을 깔아 빈 곳을 메운다. 키워서 넓히는 것과는
다르다 — 이펙트가 차지하는 자리는 그대로 두고 그 안만 채우므로, §101 이 눌러 놓은
「화면을 덮는 넓이」는 건드리지 않는다. 번짐은 가산 합성에서 저절로 속불이 된다.
"""
FX = [("fx_pillar",   16, 100, 2.2),   # 내리꽂히는 빛기둥 — 낙뢰(skStrike). 원래도 가장 진했다
      ("fx_crescent", 20, 100, 2.0),   # 앞으로 긋는 참격 — 참격(skSlash). 아래 주석 참고
      ("fx_wedge",    16, 100, 1.7),   # 앞으로 미는 쐐기 — 돌진(skDash)
      ("fx_implode",  18, 100, 2.4),   # 안으로 빨려드는 붕괴 — 순간이동이 떠나는 자리
      ("fx_volley",   20, 100, 2.6)]   # 쏟아져 나가는 발사 — 탄막(skBurst)
"""참격·쐐기만 낮은 이유. 둘은 **한 덩어리로 이어진 면**이라 번짐이 곧장 속을 채워
   흰 덩이가 된다 — 3.6·4.0 으로 구웠더니 화면에서 초승달도 화살도 아닌 흰 얼룩이었다.
   반대로 붕괴·탄막은 흩어진 조각이라 조각 사이가 비어 있고, 그 사이를 메우는 데는
   많이 필요하다. 「성긴 그림에 많이 준다」가 아니라 **「조각난 그림에 많이 준다」** 다."""
GLOW_R = 13                             # 번짐 반지름(칸 128 기준). 크면 덩어리, 작으면 테두리
CORE = 150                              # 이 밝기부터가 「속」 — 여기서만 빛이 번진다


def lumamask(a, cut=26):
    """밝기로 본 내용. 배경이 검정이라 밝기가 곧 알파다."""
    return a[:, :, :3].max(2) > cut


def gaps(mask, lo, hi):
    """[lo, hi) 안의 빈 줄들. ui-parts 의 empty_runs 와 같은 규칙."""
    out = []
    for x in range(lo, hi):
        if mask[x]: continue
        if out and x == out[-1][1] + 1: out[-1][1] = x
        else: out.append([x, x])
    return out


def cut(mask, n, size):
    """n 칸으로 가르는 경계. j/n 자리 ±10% 안에서 가장 넓은 빈 줄(§124 와 같은 규칙)."""
    return [sum(max(gaps(mask, round(size * (j / n - .1)), round(size * (j / n + .1))),
                    key=lambda t: t[1] - t[0])) // 2
            for j in range(1, n)]


def glow(rgb, al, amount):
    """밝은 속에서만 빛을 번지게 해 선 사이를 메운다(실제 블룸과 같은 방식).

    **RGB 와 알파 둘 다에 준다.** 처음에 알파에만 줬다가 값이 꿈쩍도 안 했다 —
    가산 합성이 더하는 것은 RGB×알파인데, 선 사이의 RGB 는 검정이라 거기 알파를
    아무리 올려도 더해지는 빛이 0 이다. 번짐 반지름을 9→16 으로, 양을 .85→4.0 으로
    올려도 「칸당 빛」이 48.8→50.4 밖에 안 움직인 것이 그 증거였다.

    그렇다고 그림 전체를 흐려 더하면 이번엔 **모양이 죽는다** — 쐐기를 그렇게 4.2 로
    올렸더니 화살이 아니라 빛덩어리가 됐다. §127 이 만들려던 것은 갈래마다 다른
    모양이므로 그건 목적을 되돌리는 짓이다. 그래서 **밝은 속(CORE 이상)만** 번지게
    한다. 가는 선과 알갱이는 제 자리에 그대로 남고, 심지 둘레만 부푼다.

    흐리기 전에 반지름만큼 **0 으로 덧댄다**. PIL 의 흐림은 가장자리 값을 밖으로
    늘여 쓰므로, 덧대지 않으면 칸 테두리를 따라 네모난 빛 테가 생긴다(실제로 생겼다).
    """
    if amount <= 0: return rgb, al
    k = GLOW_R * al.shape[0] / 128.0
    pad = int(k * 3) + 2
    pre = rgb * (al[:, :, None] / 255.0)                  # 알파를 미리 곱한 실제 빛
    lum = pre.max(2)
    core = np.clip((lum - CORE) / max(1.0, 255.0 - CORE), 0, 1)[:, :, None]
    def blur(x):
        x = np.pad(x, ((pad, pad), (pad, pad)) + ((0, 0),) * (x.ndim - 2))
        im = Image.fromarray(x.astype(np.uint8), "RGB" if x.ndim == 3 else "L")
        return np.array(im.filter(ImageFilter.GaussianBlur(k))).astype(np.float32)[pad:-pad, pad:-pad]
    gr = blur(np.clip(pre * core, 0, 255))
    ga = blur(np.clip(al * core[:, :, 0], 0, 255))
    return np.clip(rgb + gr * amount, 0, 255), np.clip(al + ga * amount, 0, 255)


def build(fx=None, quiet=False):
    """시트를 잘라 줄마다 4프레임 스트립 하나를 만든다.

    파라미터(cut·glow)를 바꿔 가며 재려면 여기만 부르면 된다 — 자르는 자리와 배율은
    한 곳에만 있어야 잰 값과 구운 값이 같아진다."""
    fx = fx or FX
    im = Image.open(SHEET).convert("RGB")
    a = np.array(im).astype(np.int16)
    H, W = a.shape[:2]
    fg = lumamask(a)
    ys = cut(fg.sum(1) > 0, ROWS, H)
    if not quiet: print(f"  {os.path.basename(SHEET)} {W}x{H}: 가로선 {ys}")

    strips = []
    for r, (y0, y1) in enumerate(zip([0] + ys, ys + [H])):
        band = fg[y0:y1]
        xs = cut(band.sum(0) > 0, COLS, W)
        cells = []
        for x0, x1 in zip([0] + xs, xs + [W]):
            c = a[y0:y1, x0:x1]
            m = lumamask(c)
            if not m.any(): cells.append(None); continue
            yy, xx = np.nonzero(m)
            box = (xx.min(), yy.min(), xx.max() + 1, yy.max() + 1)
            cells.append((c[box[1]:box[3], box[0]:box[2]], box))
        # 한 줄은 한 배율 — 단계마다 배율이 다르면 애니메이션이 들썩인다
        big = max((max(cc[0].shape[0], cc[0].shape[1]) for cc in cells if cc), default=1)
        k = (CELL * .94) / big
        strip = Image.new("RGBA", (CELL * COLS, CELL), (0, 0, 0, 0))
        for i, cc in enumerate(cells):
            if not cc: continue
            src = cc[0]
            lum = src.max(2).astype(np.float32)
            al = np.clip(lum / fx[r][2], 0, 1) ** .85 * 255   # 밝기 = 알파, 기준은 줄마다
            col, al = glow(np.clip(src, 0, 255).astype(np.float32), al, fx[r][3])
            rgba = np.dstack([col, al]).astype(np.uint8)
            ci = Image.fromarray(rgba, "RGBA")
            w, h = max(1, round(ci.width * k)), max(1, round(ci.height * k))
            ci = ci.resize((w, h), Image.LANCZOS)
            strip.alpha_composite(ci, (i * CELL + (CELL - w) // 2, (CELL - h) // 2))
        strips.append(strip)
        if not quiet:
            print(f"  {fx[r][0]:<13} 세로선 {xs}  가장 큰 단계 {big}px → 배율 {k:.3f}")
    return strips


def main():
    strips = build()
    html = io.open(GAME, encoding="utf-8").read()
    frames, aa, bb = atlaslib.frames_of(html)
    atlas = Image.open(ATLAS).convert("RGBA")
    AW, AH = atlas.size
    need = sum(CELL for (k, *_), _ in zip(FX, strips) if k not in frames)
    new = Image.new("RGBA", (AW, AH + need), (0, 0, 0, 0)); new.paste(atlas, (0, 0))

    y = AH
    for (key, fps, *_), strip in zip(FX, strips):
        reuse = key in frames and frames[key]["w"] == CELL
        ty = frames[key]["y"] if reuse else y
        new.paste(Image.new("RGBA", (CELL * COLS, CELL), (0, 0, 0, 0)), (0, ty))
        new.paste(strip, (0, ty), strip)
        frames[key] = {"x": 0, "y": ty, "w": CELL, "h": CELL, "n": COLS, "fps": fps}
        print(f"{key:<14}y={ty:5d}  {COLS}프레임  fps={fps}{'  (제자리)' if reuse else '  (새 줄)'}")
        if not reuse: y += CELL
    new = new.crop((0, 0, AW, max(y, AH)))

    atlaslib.save(atlaslib.put_frames(html, frames, aa, bb), new)
    print(f"\n이펙트 {len(FX)}줄  아틀라스 {AW}x{AH} → {new.size[0]}x{new.size[1]}")


if __name__ == "__main__":
    main()

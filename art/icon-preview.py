#!/usr/bin/env python3
"""16px 메뉴 아이콘 미리보기.

브라우저를 띄우지 않고 ASCII 표를 그대로 그려 본다. 아이콘은 화면에서 16px 로
찍히는 물건이라, 눈으로 확인하지 않고 문자열만 고치면 반드시 어긋난다.
게임과 같은 규칙으로 칠한다 — 0 윤곽 · 1 그늘 · 2 몸통 · 3 빛, 빛은 왼쪽 위.

  python3 art/icon-preview.py out.png            # 파일에 적힌 초안을 전부
  python3 art/icon-preview.py out.png physical   # 하나만
"""
import sys, os
from PIL import Image, ImageDraw

def hx(h):
    h = h.lstrip("#")
    if len(h) == 3: return tuple(int(c * 2, 16) for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def mix(a, b, k):
    return tuple(round(x + (y - x) * k) for x, y in zip(a, b))

def px_pal(col):
    """game/index.html 의 pxPal 과 같은 세 단계 [밝음, 몸통, 바탕]."""
    c = hx(col)
    return [mix(c, (255, 255, 255), .38), c, mix(c, (12, 12, 22), .42)]

def icon_pal(col):
    p = px_pal(col)
    return {"0": mix(p[2], (8, 8, 16), .55), "1": p[2], "2": p[1], "3": p[0]}

def render(rows, col, k=14):
    pal = icon_pal(col)
    h, w = len(rows), len(rows[0])
    im = Image.new("RGB", (w * k, h * k), (18, 18, 28))
    d = ImageDraw.Draw(im)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == ".": continue
            d.rectangle([x*k, y*k, x*k+k-1, y*k+k-1], fill=pal[ch])
    return im

def sheet(items, path, k=14):
    """items = [(name, rows, col)] — 확대판과 실제 크기(16px)를 나란히 놓는다."""
    cols = min(3, len(items))
    rowsn = (len(items) + cols - 1) // cols
    cw, chh = 16 * k + 90, 16 * k + 34
    im = Image.new("RGB", (cw * cols, chh * rowsn), (10, 10, 16))
    d = ImageDraw.Draw(im)
    for i, (name, rows, col) in enumerate(items):
        ox, oy = (i % cols) * cw, (i // cols) * chh
        im.paste(render(rows, col, k), (ox + 8, oy + 26))
        # 실제 크기 — 확대판만 보면 늘 잘 그린 것처럼 보인다
        im.paste(render(rows, col, 1).resize((16, 16), Image.NEAREST), (ox + 16 * k + 26, oy + 30))
        im.paste(render(rows, col, 3), (ox + 16 * k + 26, oy + 56))
        d.text((ox + 8, oy + 8), name, fill=(200, 205, 220))
    im.save(path)
    return im.size


# ---------------------------------------------------------------- 모양 → 글리프
#
# 16칸을 손으로 세면 반드시 틀린다 — 첫 초안에서 여섯 중 둘이 길이가 어긋났다.
# 그래서 '어디가 채워졌나'(mask)만 정하고 윤곽·광·그늘은 규칙으로 입힌다.
# 규칙은 게임의 나머지와 같다: 빛은 왼쪽 위, 윤곽은 바깥으로 한 칸.

class Grid:
    def __init__(self, n=16):
        self.n = n
        self.m = [[False] * n for _ in range(n)]

    def _set(self, x, y):
        if 0 <= x < self.n and 0 <= y < self.n: self.m[y][x] = True

    def rect(self, x, y, w, h):
        for j in range(h):
            for i in range(w): self._set(x + i, y + j)
        return self

    def disc(self, cx, cy, r):
        for y in range(self.n):
            for x in range(self.n):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r: self._set(x, y)
        return self

    def line(self, x0, y0, x1, y1, w=1):
        steps = max(abs(x1 - x0), abs(y1 - y0)) * 4 + 1
        for i in range(steps + 1):
            t = i / steps
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for dy in range(w):
                for dx in range(w):
                    self._set(round(cx) + dx, round(cy) + dy)
        return self

    def poly(self, pts):
        """짝수-홀수 채우기. 칸 한가운데(+.5)를 기준으로 판정한다."""
        for y in range(self.n):
            for x in range(self.n):
                px, py, inside = x + .5, y + .5, False
                for i in range(len(pts)):
                    (ax, ay), (bx, by) = pts[i], pts[(i + 1) % len(pts)]
                    if (ay > py) != (by > py) and px < (bx - ax) * (py - ay) / (by - ay) + ax:
                        inside = not inside
                if inside: self._set(x, y)
        return self

    def sub(self, other):
        for y in range(self.n):
            for x in range(self.n):
                if other.m[y][x]: self.m[y][x] = False
        return self


def to_glyph(g):
    """mask → ['.0123' 문자열 16줄].

       2 몸통이 바탕이고, 위·왼쪽 가장자리는 3(빛), 아래·오른쪽 가장자리는 1(그늘),
       모양 바로 바깥 한 칸은 0(윤곽). 모양이 가장자리에 닿으면 윤곽이 잘리므로
       1..n-2 안에 그려야 한다. """
    n, m = g.n, g.m
    out = []
    for y in range(n):
        row = ""
        for x in range(n):
            if m[y][x]:
                # 빛은 왼쪽 위에서 온다 — 왼위 대각이 비면 광, 오른아래 대각이 비면 그늘.
                # 상하좌우로 보면 오른쪽 위 모서리까지 밝아져 빛이 두 개로 보인다.
                ul = y > 0     and x > 0     and m[y - 1][x - 1]
                dr = y < n - 1 and x < n - 1 and m[y + 1][x + 1]
                row += "3" if not ul else "1" if not dr else "2"
            else:
                near = any(m[y + dy][x + dx]
                           for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                           if 0 <= y + dy < n and 0 <= x + dx < n)
                row += "0" if near else "."
        out.append(row)
    return out


def js(name, rows, indent="  "):
    """game/index.html 의 MENU_ICONS 에 그대로 붙일 수 있는 꼴로 찍는다."""
    pad = " " * (len(indent) + len(name) + 3)
    body = (",\n" + pad).join('"%s"' % r for r in rows)
    return "%s%s: [%s]," % (indent, name, body)

#!/usr/bin/env python3
"""전직 카드 초상 시트를 갈라서 크기를 맞추고 아틀라스에 넣는다.

사용:
  python3 art/adv-sheets.py <시트.png>:<키1,키2,키3,키4> ... <낱장.png>:<키>
      [--sigil key,key]   발밑 문양이 있는 갈래 (4차)
      [--frac-from 시트]  그 시트에서 문양 몫을 재서 쓴다 (아래 조건을 아는 사람이 지정)
      [--sigil-frac 0.93] 문양 몫을 손으로 준다
      [--target 108]      128 칸 안에서 인물이 차지할 세로 px (칸을 넘으면 저절로 줄인다)
      [--dry]             아틀라스를 건드리지 않고 재기만 한다

■ 왜 따로 재야 하는가

성기사(§99)는 시트마다 따로 맞췄다. 시트 안에서는 생성 모델이 카드의 「네 칸의 인물
크기가 같아야 한다」를 잘 지켰지만, **시트끼리는 어긋났다** — 아틀라스에서 재 보니
인물 세로가 102~118px 로 16% 벌어져 있었다. 전직 선택 화면은 같은 차수의 갈래 셋을
나란히 보여주는데 그 셋이 서로 다른 시트에서 오므로, 이 어긋남이 그대로 보인다.

그래서 여기서는 **한 직업의 열일곱 장을 하나의 자로** 맞춘다.

■ 발밑 문양이 자를 망가뜨린다

4차 갈래는 발밑에 문양이 깔린다. 알파 경계상자로 인물 크기를 재면 문양이 아래로
늘려 놓아 4차만 작게 들어간다. 문양을 색이나 모양으로 가려내려 해 봤지만 —
가운데 띠의 굵기로도, 줄 폭의 급변으로도 깨끗한 경계가 안 나온다(문양이 장화 뒤로
지나가 이어져 있다).

대신 **한 번 재서 상수로 못 박는다.** 전사 W4 는 문양 있는 둘(전쟁의 신 · 피의 군주)과
없는 둘(불패의 투사 · 군중의 지배자)이 같이 들었고, 없는 쪽의 장식은 옆으로만 돈다 —
세로를 건드리지 않는다. 거기서 516/555 = 0.930 이 나왔다.

**이 계산은 아무 시트에서나 성립하지 않는다.** 성기사 S4 로 같은 계산을 하면 1.033 이
나온다(문양 570 · 없음 588) — 문양 없는 둘(불의 화신 · 정화의 태양)이 머리 **위로** 도는
불꽃을 달고 있어서, 문양의 몫이 아니라 장식의 차이를 잰 것이다.

성립하는 조건은 하나다: **문양 없는 칸의 장식이 옆으로만 돌아 세로를 안 건드릴 것.**
그건 그림을 봐야 아는 것이라 기계가 판정할 수 없다. 그래서 `--frac-from <시트>` 로
사람이 지정하면 거기서 재고, 아니면 상수를 쓴다. 조건을 만족하는 시트에서도 값은
묶음마다 다르다 — 전사 W4 는 0.930, 추적자 R4 는 0.980 이었다(추적자 쪽 문양이 더
얕게 그려졌다). 그러니 새 직업을 받을 때마다 재는 게 맞다.

■ 배경은 줄이기 **전에** 뺀다

align-frames 의 배경 제거는 남은 한 겹을 침식으로 깎는데(원본 1254px 기준 2px),
줄인 뒤에 걸면 그 2px 이 치명적이다 — 128칸에서 검신의 도는 검과 일섬의 번개가
4~6px 이라 통째로 지워졌다. 원본 해상도에서 빼고, 알파를 곱해 둔 채로 줄인 뒤
되나눈다(그냥 줄이면 투명한 자리에 남은 마젠타가 가장자리로 번진다).

■ 줄이기 전 크기로 맞추면 안 된다

검성의 칼날 관처럼 얇은 것은 600px 원본에서는 경계상자를 위로 늘리지만 128px 로
줄이면 1px 미만이 되어 배경 제거에 통째로 지워진다. 원본 경계상자로 배율을 잡았더니
화면에 보이는 세로가 91~113px 로 오히려 더 벌어졌다(성기사는 102~118).

그래서 **줄이고 배경을 뺀 결과를 다시 재서** 배율을 고친다. 세 번이면 붙는다.
맞추는 것은 '그리기 전의 그림'이 아니라 '화면에 보이는 것'이다.

■ 칸에 들어가야 한다

세로를 맞추면 가로는 따라온다 — 다만 발밑 문양이 넓게 그려진 묶음은 128 칸을 넘는다.
추적자 「천 개의 송곳니」는 목표 108 에서 가로 138px 이었고, 그대로 넣으면 문양 고리가
좌우로 잘려 닫힌 타원이 아니라 끊긴 활로 보인다(실제로 그렇게 나왔다).

그래서 목표를 **그 직업에서 가장 넓은 초상이 칸에 들어가는 값으로** 저절로 내린다.
직업끼리 크기가 조금 달라지지만(전사 108 · 추적자 100) 전직 선택은 늘 한 직업 안의
같은 차수 셋이라 나란히 놓일 일이 없다. 잘린 문양은 바로 보이고, 직업 간 7% 차이는
볼 자리가 없다.

■ 자리

가로는 알파 질량의 축, 세로는 **발 선**을 칸의 같은 높이에 둔다. 발 선은 경계상자
바닥에서 문양이 삐져나온 만큼을 뺀 자리다 — 문양은 발밑에 깔린 것이므로 발이 기준이다.
"""
import io, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib
import numpy as np
from PIL import Image, ImageFilter
from importlib import import_module
key_out = import_module("align-frames").key_out

GAME = "game/index.html"
ATLAS = "art/atlas.png"
CELL = 128
PER_ROW = 4                 # 128 칸을 512 폭 아틀라스에 넷씩
FOOT_Y = 120                # 칸 안에서 발이 놓이는 줄
SIGIL_FRAC = 0.930          # 인물 = 경계상자 × 이 값 (전사 W4 에서 한 번 잰 값)


def mag(a):
    """마젠타 배경 판정 — align-frames 와 같은 규칙(min(R,B) - G)."""
    return (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) <= 55


def empty_runs(flags, lo, hi):
    runs = []
    for x in range(lo, hi):
        if flags[x]: continue
        if runs and x == runs[-1][1] + 1: runs[-1][1] = x
        else: runs.append([x, x])
    return runs


def split(path, n):
    """2×2 시트를 넷으로, 낱장은 하나로. 자르는 선은 빈 띠의 한가운데다."""
    im = Image.open(path).convert("RGBA")
    a = np.array(im).astype(int); fg = mag(a); H, W = fg.shape
    if n == 1:
        ys, xs = np.nonzero(fg)
        boxes = [(xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)]
    else:
        rows = fg.sum(1) > 0
        r = max(empty_runs(rows, H // 3, 2 * H // 3), key=lambda t: t[1] - t[0])
        cy = (r[0] + r[1]) // 2
        cuts = []
        for y0, y1 in ((0, cy), (cy, H)):
            cols = fg[y0:y1].sum(0) > 0
            c = max(empty_runs(cols, W // 4, 3 * W // 4), key=lambda t: t[1] - t[0])
            cuts.append((c[0] + c[1]) // 2)
        boxes = [(0, 0, cuts[0], cy), (cuts[0], 0, W, cy),
                 (0, cy, cuts[1], H), (cuts[1], cy, W, H)]
        print(f"  {os.path.basename(path)}: 가로선 y={cy}, 세로선 위 x={cuts[0]} 아래 x={cuts[1]}")
    out = []
    for x0, y0, x1, y1 in boxes:
        c = im.crop((x0, y0, x1, y1)); w, h = c.size; s = max(w, h)
        sq = Image.new("RGBA", (s, s), (255, 0, 255, 255))
        sq.paste(c, ((s - w) // 2, (s - h) // 2))
        out.append(sq)
    return out


def bbox_of(img):
    a = np.array(img).astype(int); fg = mag(a)
    m = Image.fromarray(fg.astype(np.uint8) * 255)
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))   # 잡티 제거
    ys, xs = np.nonzero(np.array(m) > 0)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def main():
    argv = sys.argv[1:]
    sigil, target, dry, frac, fracFrom = set(), 108, False, SIGIL_FRAC, None
    if "--dry" in argv: dry = True; argv.remove("--dry")
    for flag in ("--sigil", "--target", "--sigil-frac", "--frac-from"):
        if flag in argv:
            i = argv.index(flag); v = argv[i + 1]; del argv[i:i + 2]
            if flag == "--sigil": sigil = set(v.split(","))
            elif flag == "--target": target = int(v)
            elif flag == "--frac-from": fracFrom = v
            else: frac = float(v)
    if not argv:
        raise SystemExit(__doc__)

    # 1. 가른다
    cells = {}                                   # key -> (이미지, 시트이름)
    order = []
    for spec in argv:
        path, keys = spec.rsplit(":", 1)
        ks = keys.split(",")
        for img, k in zip(split(path, len(ks)), ks):
            img.save(f"art/src/adv_{k}.png")
            cells[k] = (img, os.path.basename(path))
            order.append(k)

    # 2. 잰다
    info = {}
    for k in order:
        img, sheet = cells[k]
        x0, y0, x1, y1 = bbox_of(img)
        info[k] = dict(sheet=sheet, x0=x0, y0=y0, x1=x1, y1=y1, h=y1 - y0, w=x1 - x0)

    # 3. 문양이 더하는 몫 — 지정한 시트에서 재거나(머리말의 조건), 상수를 쓴다
    how = "--sigil-frac 로 준 값" if frac != SIGIL_FRAC else "전사 W4 에서 잰 상수"
    for sh in sorted({v["sheet"] for v in info.values()}):
        grp = [k for k in order if info[k]["sheet"] == sh]
        a = [info[k]["h"] for k in grp if k in sigil]
        b = [info[k]["h"] for k in grp if k not in sigil]
        if not (a and b): continue
        v = float(np.median(b)) / float(np.median(a))
        if fracFrom and os.path.basename(fracFrom) == sh:
            frac, how = v, f"{sh} 에서 잼 (문양 {np.median(a):.0f} · 없음 {np.median(b):.0f})"
        else:
            print(f"  참고: {sh} 에서 같은 계산을 하면 {v:.3f} — 조건을 확인하지 않았으므로 쓰지 않는다")
    print(f"\n문양이 더하는 몫: 인물 = 경계상자 × {frac:.3f}   ({how})")

    # 4. 하나의 자로 맞춘다 — 줄이고 배경을 뺀 결과를 재서 배율을 고친다
    cut = {}                                     # 원본 해상도에서 한 번만 배경을 뺀다
    for k in order:
        v = info[k]
        crop = cells[k][0].crop((v["x0"], v["y0"], v["x1"], v["y1"]))
        rgba, _ = key_out(crop, (255, 0, 255), 40)
        cut[k] = rgba

    def render(k, s):
        """배율 s 로 줄인 뒤 실제로 남은 알파를 돌려준다."""
        rgba = cut[k].astype(np.float64)
        h0, w0 = rgba.shape[:2]
        w, h = max(1, int(round(w0 * s))), max(1, int(round(h0 * s)))
        a = rgba[:, :, 3:4] / 255.0
        pm = np.concatenate([rgba[:, :, :3] * a, rgba[:, :, 3:4]], axis=2)   # 알파를 곱해 둔다
        sm = np.array(Image.fromarray(pm.astype(np.uint8), "RGBA").resize((w, h), Image.LANCZOS)).astype(np.float64)
        aa = np.clip(sm[:, :, 3:4], 1e-6, 255) / 255.0
        out = np.concatenate([np.clip(sm[:, :, :3] / aa, 0, 255), sm[:, :, 3:4]], axis=2).astype(np.uint8)
        ys, xs = np.nonzero(out[:, :, 3] > 8)
        if len(ys) == 0: return out, None
        return out, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)

    def build(target):
      strip = []
      for k in order:
        v = info[k]
        f = frac if k in sigil else 1.0
        s = target / (v["h"] * f)
        rgba = box = None
        for _ in range(4):                     # 세 번이면 붙는다. 한 번 더 둔다.
            rgba, box = render(k, s)
            if box is None: break
            vis = (box[3] - box[1]) * f
            if abs(vis - target) < .5: break
            s *= target / vis
        if box is None: raise SystemExit(f"{k}: 배경 제거가 과했다")
        vh = box[3] - box[1]
        over = vh * (1 - f)                    # 문양이 발 아래로 삐져나온 몫
        cellimg = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        sub = Image.fromarray(rgba[box[1]:box[3], box[0]:box[2]])
        cellimg.paste(sub, ((CELL - sub.size[0]) // 2, int(round(FOOT_Y + over - vh))), sub)
        strip.append((k, cellimg, sub.size[0], s, vh))
      return strip

    # 가장 넓은 초상이 칸에 들어갈 때까지 목표를 내린다
    strip = build(target)
    wide = max(w for _, _, w, _, _ in strip)
    if wide > CELL:
        t2 = int(target * CELL / wide)
        print(f"\n가장 넓은 초상이 {wide}px — 칸(128)을 넘는다. 목표 {target} → {t2} 로 내린다")
        target = t2
        strip = build(target)
    print(f"\n{'키':<14}{'시트':>14}{'경계h':>7}{'보인h':>7}{'배율':>7}{'폭':>6}")
    for (k, _, w, s, vh) in strip:
        v = info[k]
        print(f"{k:<14}{v['sheet'][-12:]:>14}{v['h']:>7}{vh:>7}{s:>7.3f}{w:>6}")
    strip = [(k, img) for k, img, _, _, _ in strip]

    if dry:
        print("\n--dry — 아틀라스는 건드리지 않았다")
        return

    # 5. 아틀라스에 넣는다 — 줄당 넷
    html = io.open(GAME, encoding="utf-8").read()
    a = html.index("const ATLAS_FRAMES = ") + len("const ATLAS_FRAMES = ")
    b = html.index("};", a) + 1
    frames = json.loads(html[a:b])
    atlas = Image.open(ATLAS).convert("RGBA")
    AW, AH = atlas.size
    rows_needed = (len(strip) + PER_ROW - 1) // PER_ROW
    # 이미 있는 키는 제자리에 덮어쓴다 — 다시 받아 넣는 일이 당연히 생긴다
    have = [k for k, _ in strip if ("adv_" + k) in frames]
    new = Image.new("RGBA", (AW, AH + (0 if len(have) == len(strip) else rows_needed * CELL)), (0, 0, 0, 0))
    new.paste(atlas, (0, 0))
    y = AH
    placed = {}
    for i, (k, img) in enumerate(strip):
        fk = "adv_" + k
        if fk in frames:
            tx, ty = frames[fk]["x"], frames[fk]["y"]
        else:
            slot = len(placed)
            tx, ty = (slot % PER_ROW) * CELL, y + (slot // PER_ROW) * CELL
        new.paste(Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0)), (tx, ty))
        new.paste(img, (tx, ty), img)
        frames[fk] = {"x": tx, "y": ty, "w": CELL, "h": CELL, "n": 1, "fps": 1}
        placed[k] = (tx, ty)
    used = max((ty for _, ty in placed.values()), default=AH - CELL) + CELL
    new = new.crop((0, 0, AW, max(used, AH)))

    atlaslib.save(html[:a] + json.dumps(frames, separators=(",", ":"), ensure_ascii=False) + html[b:], new)
    print(f"\n초상 {len(strip)}장  아틀라스 {AW}x{AH} → {new.size[0]}x{new.size[1]}   "
          f"game/index.html {os.path.getsize(GAME) / 1024:.0f}KB")


if __name__ == "__main__":
    main()

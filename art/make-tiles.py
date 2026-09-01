#!/usr/bin/env python3
"""바닥 타일 낱장을 이어 붙여도 이음매가 안 보이게 고쳐 아틀라스에 넣는다.

캐릭터 그림은 '잘라내는' 일이고 바닥 타일은 '이어 붙이는' 일이라 도구가 다르다.
align-frames.py 는 배경을 지우고 인물에 맞춰 크롭하는데, 타일은 정사각형을
통째로 쓴다. 바탕(`floor`)은 아예 불투명해 배경조차 없고, 장식(`floordeco*`)은
투명해야 해서 `--alpha` 로 마젠타를 지우되 **크롭은 하지 않는다** — 칸 안에서의
위치가 그림의 일부라, 물건에 맞춰 잘라내면 네 장이 전부 한가운데로 모인다.

바탕 타일에서 신경 쓸 것이 세 가지 있다.

  1. 장마다 밝기가 다르면 바닥이 바둑판처럼 얼룩진다.
     칸마다 0~3 중 하나가 무작위로 깔리므로, 한 장만 밝아도 그 장이 깔린 칸이
     전부 밝은 점으로 보인다. 받은 그림의 안쪽 평균이 38.0~44.2 로 6.2 벌어져
     있었다.

  2. 가장자리가 안쪽보다 어두우면(비네팅) 칸 경계마다 어두운 격자가 생긴다.
     받은 그림 중 셋이 가장자리가 1.5~4 어두웠다.

  3. 1·2 를 고쳐도 낱알 무늬는 여전히 경계에서 어긋난다.
     그래서 바깥 띠를 반대쪽 가장자리와 감아 섞는다(wrap blend).

고쳤는지는 눈이 아니라 숫자로 본다. **같은 타일 안에서 이웃한 두 줄의 밝기
차이**가 '자연스러운 값'이고, 이음매를 가로지르는 차이가 그 값 근처면 눈은
경계를 못 찾는다. 받은 그림은 자연값의 3.7~4.0 배였다.

사용:
  python3 art/make-tiles.py <아틀라스키> <타일1.png> ...
      [--alpha] [--key-black] [--grow 2.2] [--lum 45] [--cap 70] [--cell 128]
      [--no-tone]   밝기를 건드리지 않는다 — UI 에 얹히는 그림용
      [--key-thresh 150]  마젠타로 볼 문턱(기본 55). 그림 제 색이 문턱을 넘을 때만
  예) python3 art/make-tiles.py floor art/src/floor_1.png ...
      python3 art/make-tiles.py floordeco2 art/src/floordeco2_1.png ... --alpha
"""
import sys, os, json, io, base64
import numpy as np
from PIL import Image, ImageFilter

GAME = "game/index.html"
ATLAS = "art/atlas.png"


def natural(t):
    """같은 타일 안에서 이웃한 두 줄의 평균 밝기 차이 — 이음매의 기준선."""
    l = t.mean(axis=2)
    return (np.abs(l[1:] - l[:-1]).mean() + np.abs(l[:, 1:] - l[:, :-1]).mean()) / 2


def seams(T):
    """모든 조합의 이음매 대비 중 최악값. 가로·세로 둘 다 본다."""
    nat = np.mean([natural(t) for t in T])
    wh = wv = 0
    for a in T:
        for b in T:
            la, lb = a.mean(axis=2), b.mean(axis=2)
            wh = max(wh, np.abs(lb[:, 0] - la[:, -1]).mean())
            wv = max(wv, np.abs(lb[0, :] - la[-1, :]).mean())
    return nat, wh, wv


def flatten(t, sigma):
    """저주파(비네팅·전체 기울기)만 걷어낸다. 낱알과 돌판 조각은 남는다.

    sigma 를 작게 잡으면 묻힌 돌판 조각까지 지워진다 — 조각이 타일의 4분의 1쯤
    되므로 그보다 훨씬 큰 규모만 건드려야 한다."""
    im = Image.fromarray(np.clip(t, 0, 255).astype(np.uint8))
    lo = np.asarray(im.filter(ImageFilter.GaussianBlur(sigma))).astype(float)
    return t - lo + lo.mean(axis=(0, 1))


def wrap_blend(t, band):
    """바깥 띠를 반대쪽 가장자리와 감아 섞는다.

    타일 t 의 왼쪽 띠는 '자기 오른쪽 바깥에 이어 붙을 것'과 만난다. 네 장이
    섞여 깔리므로 특정 상대를 알 수 없다 — 대신 자기 자신의 반대쪽과 섞어
    두면 모든 장의 가장자리가 서로 비슷해져 어느 조합이든 맞는다."""
    o = t.copy()
    w = np.linspace(0, .5, band)[:, None, None]          # 가장자리일수록 많이 섞는다
    o[:band] = t[:band] * (1 - w) + t[-band:][::-1] * w
    o[-band:] = t[-band:] * (1 - w[::-1]) + t[:band][::-1] * w[::-1]
    w2 = w.transpose(1, 0, 2)
    o[:, :band] = o[:, :band] * (1 - w2) + o[:, -band:][:, ::-1] * w2
    o[:, -band:] = o[:, -band:] * (1 - w2[:, ::-1]) + o[:, :band][:, ::-1] * w2[:, ::-1]
    return o


def key_out(t, thresh=55, kind="magenta"):
    """배경을 알파로 뺀다. 자리는 그대로 두고 배경만 지운다.

    문턱의 뜻과 침식이 필요한 이유는 align-frames.py 의 같은 함수에 적어 뒀다.
    여기서 다른 점은 크롭을 안 한다는 것 하나다.

    `kind="black"` 은 배경이 순수 검정으로 온 그림용이다. 마젠타를 요구했는데
    검정이 오면 마젠타 키잉은 아무것도 안 지워서 화면에 검은 사각형이 깔린다.
    다행히 검정 배경은 마젠타보다 오히려 깔끔하다 — 실측하니 문턱을 2 에서 8
    까지 올려도 남는 픽셀 수가 한 개도 안 변했다. 경계에 그라데이션이 아예
    없다는 뜻이라, 반쯤 섞인 가장자리를 걱정할 필요가 없다."""
    if kind == "black":
        bg = t.mean(axis=2) <= 6
    else:
        R, G, B = t[:, :, 0], t[:, :, 1], t[:, :, 2]
        bg = (np.minimum(R, B) - G) > thresh
    m = Image.fromarray((~bg).astype(np.uint8) * 255)
    g = max(2, int(t.shape[0] * 0.004))
    if kind != "black":                            # 검정은 경계가 칼같아 깎을 것이 없다
        m = m.filter(ImageFilter.MinFilter(2 * g + 1))
    m = np.asarray(m)
    out = np.dstack([t, m.astype(float)])
    out[:, :, :3][m == 0] = 0                      # 지운 자리는 색까지 비운다
    return out


def grow(t, k):
    """물건을 제 중심을 축으로 키운다.

    이 겹이 저지른 두 번째 잘못이다 — 물건이 너무 작게 왔다. 덮는 넓이가
    0.37~0.68% 로, 이미 잘 쓰고 있는 판석 겹(2.0~5.5%)의 5분의 1이라 화면에서
    티끌로 보인다. 원본이 1254px 이라 물건 자체는 90px 을 넘으므로, 키워서
    128px 로 줄여도 화질에는 손해가 없다.

    중심을 축으로 키우는 이유는 **자리가 카드의 요구사항**이기 때문이다.
    이 넉 장은 네 변의 한가운데에 하나씩 앉아 판석 겹의 네 모퉁이와 엇갈리게
    돼 있다. 캔버스 중심으로 키우면 그 배치가 무너진다.

    키운 상자가 캔버스를 벗어나면 중심을 안쪽으로 밀어 넣는다."""
    m = t[:, :, 3] > 16
    if not m.any():
        return t
    h, w = m.shape
    ys, xs = np.nonzero(m)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    bw, bh = (xs.max() - xs.min() + 1) * k / 2, (ys.max() - ys.min() + 1) * k / 2
    cx = min(max(cx, bw), w - bw)                  # 벗어나면 안쪽으로
    cy = min(max(cy, bh), h - bh)
    big = Image.fromarray(t.astype(np.uint8), "RGBA").resize(
        (int(w * k), int(h * k)), Image.LANCZOS)
    ox, oy = int(cx - cx * k), int(cy - cy * k)    # 중심이 제자리에 오도록 민다
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(big, (ox, oy))
    return np.asarray(out).astype(float)


def tone(t, target, cap):
    """장식 겹의 밝기를 바닥에 맞춰 끌어내린다.

    이 겹이 저지르는 잘못은 늘 하나다 — 바닥보다 밝아서 물건처럼 보인다.
    모양(깨진 판석·웅덩이·널판·마른 덩굴)과 자리(네 모퉁이)는 카드대로 와도
    밝기만 안 지켜지는데, 밝기는 색조나 모양과 달리 **기계로 고칠 수 있다.**
    받은 그림이 평균 59.6(바닥 39.7 대비 +19.9)이라 그대로 넣으면 예전 것보다
    오히려 더 튄다.

    두 단계다. 먼저 불투명한 부분의 평균을 target 으로 옮기고, 그래도 cap 을
    넘는 낱 픽셀은 그 픽셀만 눌러 준다 — 전체를 더 내리면 어두운 웅덩이가
    바닥에 녹아버린다. 실제로 넘는 픽셀은 몇백 개뿐이라 눌러도 티가 안 난다."""
    m = t[:, :, 3] > 16
    if not m.any():
        return t
    rgb = t[:, :, :3]
    cur = rgb[m].mean(axis=1).mean()
    rgb *= target / cur
    lum = rgb.mean(axis=2)
    hot = m & (lum > cap)
    if hot.any():
        rgb[hot] *= (cap / lum[hot])[:, None]
    return np.clip(t, 0, 255)


def foot_align(T, frac):
    """물건의 발밑을 모두 같은 높이로 민다.

    한 화면에 마흔 개 넘게 깔리는 겹이라, 한 장만 몇 픽셀 떠 있으면 그 종류가
    깔린 자리마다 전부 떠 보인다. 받은 넉 장은 바닥선이 77.6~81.2% 로 3.6%
    벌어져 있었다.

    align-frames.py 의 발밑 정렬과 같은 생각이지만, 여기서는 크롭을 하지 않고
    **칸 안의 정해진 높이**로 민다. 그 높이를 알아야 게임이 그리는 그림자와
    발을 맞출 수 있기 때문이다(그림자는 sy + r*0.78 에 있다)."""
    out = []
    for t in T:
        m = t[:, :, 3] > 16
        if not m.any():
            out.append(t); continue
        h = t.shape[0]
        ys, _ = np.nonzero(m)
        dy = int(round(frac * h - 1 - ys.max()))
        o = np.zeros_like(t)
        if dy >= 0: o[dy:] = t[:h - dy] if dy else t
        else:       o[:dy] = t[-dy:]
        out.append(o)
    return out


def desat(t, keep):
    """색을 밝기 쪽으로 당겨 채도를 낮춘다. keep=1 이면 그대로, 0 이면 회색.

    장식 겹에서 반복되는 잘못이다. 물건이 하나만 있으면 따뜻한 흙빛이 예쁘지만
    **한 화면에 마흔 개가 깔리면 노란 얼룩 무더기**가 된다. §74 에서 자연 겹의
    초록이 형광처럼 떴던 것과 같은 자리다.

    채도는 밝기와 마찬가지로 기계로 고칠 수 있다 — 밝기 쪽으로 당기는 것은
    색조를 바꾸지 않고 세기만 줄이므로 그림이 무너지지 않는다. 다만 0 까지
    내리지는 않는다. 구운 흙과 돌은 재질이 다르고, 그 차이는 남는 편이 낫다.

    잣대는 이미 넣은 것이다 — 부서진 기둥이 채도 4.1~9.1 이므로 장식 겹의
    자연스러운 폭은 그 언저리다."""
    a = t[:, :, 3:] if t.shape[2] == 4 else None
    rgb = t[:, :, :3]
    lum = rgb.mean(axis=2, keepdims=True)
    out = lum + (rgb - lum) * keep
    return np.dstack([out, a]) if a is not None else out


def alpha_stats(T, cell, floor_lum=39.7):
    """장식 겹은 '바닥보다 얼마나 튀는가'가 전부다."""
    print(f"\n{'':4}{'덮는 넓이':>10}{'밝기 평균':>10}{'밝기 최대':>10}{'상자 넓이':>11}{'중심':>16}")
    for i, t in enumerate(T):
        m = t[:, :, 3] > 16
        if not m.any():
            print(f"{i+1}번 비어 있음"); continue
        lum = t[:, :, :3][m].mean(axis=1)
        ys, xs = np.nonzero(m)
        box = (xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1)
        px = t[:, :, :3][m]
        sat = (px.max(axis=1) - px.min(axis=1)).mean()
        print(f"{i+1}번 {m.mean()*100:9.1f}%{lum.mean():10.1f}{lum.max():10.1f}"
              f"{box/cell/cell*100:10.1f}%  채도{sat:5.1f}   x {xs.mean()/cell*100:3.0f}% · y {ys.mean()/cell*100:3.0f}%")
    allm = np.concatenate([t[:, :, :3][t[:, :, 3] > 16].mean(axis=1) for t in T])
    print(f"     바닥 바탕 {floor_lum:.1f} 대비 장식 평균 {allm.mean():.1f} "
          f"({allm.mean() - floor_lum:+.1f})   75 넘는 픽셀 {int((allm > 75).sum())}개")


def main():
    argv = sys.argv[1:]
    cell, sigma, band = 128, 40, 8
    alpha = "--alpha" in argv
    if alpha: argv.remove("--alpha")
    target, cap, gk, foot, sval, oyval, keep = 45.0, 70.0, 1.0, 0.0, None, None, 1.0
    """--no-tone : 밝기를 건드리지 않는다.

       기본값(45/70)은 **바닥에 놓이는 물건**의 규칙이다. 배경은 바탕 39.7 부터
       50 사이에 모여 있어야 하고 몹(59~100)보다 어두워야 하므로, 받은 그림이
       얼마나 밝든 그 띠로 끌어내린다.

       UI 에 얹히는 그림은 그 규칙 밖이다. 어두운 메뉴 판 위의 주인공 그림이라
       오히려 밝아야 한다. 문장 넷을 그냥 넣었더니 평균 78 → 41, 최대 255 → 70
       으로 눌려 **금색이 통째로 회색이 됐다.** 세계의 자를 UI 에 대면 그렇게 된다."""
    no_tone = "--no-tone" in argv
    if no_tone: argv.remove("--no-tone")
    """--key-thresh : 마젠타로 볼 문턱.

       기본 55 는 그림의 제 색이 마젠타 쪽으로 안 갈 때의 값이다. 제단의 보라
       구슬(#a86fd8)은 min(R,B)-G = 57 이라 **제 색이 문턱을 넘어 통째로 지워졌다**
       — 파수꾼(§68)과 같은 자리다.

       올려도 되는지는 분포에 골짜기가 있느냐로 정한다. 제단을 세어 보니
       120~219 구간이 칸당 200~300개뿐이고 배경은 240대에 111만 개가 몰려 있었다.
       골짜기 한복판인 150 을 쓴다. 골짜기가 없으면 올리면 안 된다 — 되살아나는
       것이 그림이 아니라 분홍 테가 된다."""
    kthresh = 55.0
    kind = "black" if "--key-black" in argv else "magenta"
    if kind == "black": argv.remove("--key-black")
    for flag in ("--cell", "--sigma", "--band", "--lum", "--cap", "--grow",
                 "--foot", "--s", "--oy", "--sat", "--key-thresh"):
        if flag in argv:
            i = argv.index(flag); v = float(argv[i + 1]); argv = argv[:i] + argv[i + 2:]
            if flag == "--cell": cell = int(v)
            elif flag == "--sigma": sigma = int(v)
            elif flag == "--lum": target = v
            elif flag == "--cap": cap = v
            elif flag == "--grow": gk = v
            elif flag == "--foot": foot = v
            elif flag == "--s": sval = v
            elif flag == "--oy": oyval = v
            elif flag == "--sat": keep = v
            elif flag == "--key-thresh": kthresh = v
            else: band = int(v)
    if len(argv) < 2:
        raise SystemExit(__doc__)
    key, ins = argv[0], argv[1:]

    T = []
    for p in ins:
        if alpha:
            # 원본 크기에서 먼저 지우고 줄인다. 순서를 바꾸면 가장자리의
            # 마젠타가 물감처럼 섞여 들어가 분홍 테가 남는다.
            src = np.asarray(Image.open(p).convert("RGB")).astype(float)
            k = key_out(src, thresh=kthresh, kind=kind)
            if gk != 1.0: k = grow(k, gk)
            im = Image.fromarray(k.astype(np.uint8), "RGBA")
            T.append(np.asarray(im.resize((cell, cell), Image.LANCZOS)).astype(float))
        else:
            im = Image.open(p).convert("RGB").resize((cell, cell), Image.LANCZOS)
            T.append(np.asarray(im).astype(float))
        print(f"  {os.path.basename(p):28} → {cell}x{cell}")

    if alpha:
        """장식 겹에는 이음매 손질을 하지 않는다. 낱개 물건이라 이어 붙지 않고,
           밝기를 평균으로 끌어당기면 웅덩이(어두워야 한다)와 판석(밝아야 한다)이
           같은 회색으로 뭉개진다."""
        alpha_stats(T, cell)
        if foot: T = foot_align(T, foot)
        if keep != 1.0: T = [desat(t, keep) for t in T]
        if no_tone:
            print("\n밝기는 손대지 않는다(--no-tone) — UI 에 얹히는 그림이다")
        else:
            T = [tone(t, target, cap) for t in T]
            print(f"\n밝기를 {target:.0f} 로 끌어내리고 {cap:.0f} 를 넘는 낱 픽셀을 눌렀다")
            alpha_stats(T, cell)
    else:
        nat, wh, wv = seams(T)
        print(f"\n손대기 전  자연값 {nat:.2f}   가로 이음매 {wh:.2f}({wh/nat:.1f}배)   세로 {wv:.2f}({wv/nat:.1f}배)")
        print("장별 안쪽 평균 밝기  " + " · ".join(f"{t[16:-16,16:-16].mean():.1f}" for t in T))

        T = [flatten(t, sigma) for t in T]                    # 1·2 비네팅과 기울기
        tgt = np.mean([t.mean(axis=(0, 1)) for t in T], axis=0)
        T = [t - t.mean(axis=(0, 1)) + tgt for t in T]        # 1 장별 밝기 맞추기
        T = [wrap_blend(t, band) for t in T]                  # 3 낱알 이음매
        T = [np.clip(t, 0, 255) for t in T]

        nat2, wh2, wv2 = seams(T)
        print(f"손댄 뒤    자연값 {nat2:.2f}   가로 이음매 {wh2:.2f}({wh2/nat2:.1f}배)   세로 {wv2:.2f}({wv2/nat2:.1f}배)")
        print("장별 안쪽 평균 밝기  " + " · ".join(f"{t[16:-16,16:-16].mean():.1f}" for t in T))
        lum = np.concatenate([t.mean(axis=2).ravel() for t in T])
        print(f"전체 밝기  평균 {lum.mean():.1f}  최대 {lum.max():.1f}  90 넘는 픽셀 {int((lum>90).sum())}개")

    html = io.open(GAME, encoding="utf-8").read()
    a = html.index("const ATLAS_FRAMES = ") + len("const ATLAS_FRAMES = ")
    b = html.index("};", a) + 1
    frames = json.loads(html[a:b])
    f = frames[key]
    if f["w"] != cell or f["h"] != cell:
        raise SystemExit(f"{key} 의 셀이 {f['w']}x{f['h']} 라 {cell} 과 다르다")

    atlas = Image.open(ATLAS).convert("RGBA")
    """자리를 예약해 둔 줄은 아직 판 밖일 수 있다 — 판을 늘려 준다.
       늘리지 않으면 paste 가 조용히 아무 일도 안 하고, 게임은 '그림 없음'으로
       판단해 계속 안 그린다. 실패가 눈에 안 띄는 종류라 여기서 막는다."""
    need = f["y"] + cell
    if need > atlas.height:
        grown = Image.new("RGBA", (max(atlas.width, cell * f["n"]), need), (0, 0, 0, 0))
        grown.paste(atlas, (0, 0))
        atlas = grown
        print(f"  아틀라스를 {need}px 로 늘렸다")
    for i, t in enumerate(T[:f["n"]]):
        img = (Image.fromarray(t.astype(np.uint8), "RGBA") if alpha
               else Image.fromarray(t.astype(np.uint8)).convert("RGBA"))
        # 알파가 있는 겹은 덮어쓰기 전에 그 자리를 비운다 — 안 그러면 옛 그림이
        # 새 그림의 투명한 자리로 비쳐 나온다.
        atlas.paste(Image.new("RGBA", (cell, cell), (0, 0, 0, 0)), (f["x"] + i * cell, f["y"]))
        atlas.paste(img, (f["x"] + i * cell, f["y"]))
    atlas.save(ATLAS)
    if sval is not None: f["s"] = sval
    if oyval is not None: f["oy"] = int(oyval)
    html = html[:a] + json.dumps(frames, separators=(",", ":"), ensure_ascii=False) + html[b:]
    print(f"\n{key} {f['n']}장 → 아틀라스 (x={f['x']} y={f['y']} s={f.get('s')} oy={f.get('oy')})")

    b64 = base64.b64encode(io.open(ATLAS, "rb").read()).decode()
    io.open("art/atlas.b64", "w").write(b64)
    s = html.index('Sprites.load("data:image/png;base64,') + len('Sprites.load("data:image/png;base64,')
    e = html.index('"', s)
    html = html[:s] + b64 + html[e:]
    io.open(GAME, "w", encoding="utf-8").write(html)
    print(f"game/index.html {len(html)//1024}KB")


main()

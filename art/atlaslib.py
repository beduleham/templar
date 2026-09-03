"""아틀라스를 파일에 심는 한 군데.

넣는 도구가 넷(inject-frames · make-tiles · adv-sheets · ui-parts)인데 넷 다 같은
여섯 줄을 제 손으로 적고 있었다. 그림 형식을 PNG 에서 WebP 로 바꾸는 순간 그게 네
군데를 따로 고쳐야 하는 일이 되므로 여기로 모은다.

■ 왜 WebP 인가

파일의 90% 가 아틀라스 하나였다(9.67MB 중 8.70MB). 잰 값:

    PNG optimize     6.52MB
    WebP 무손실      4.19MB     픽셀은 한 점도 안 바뀐다
    WebP q95         2.10MB     픽셀이 바뀐다

무손실을 쓴다. 픽셀 아트의 딱딱한 경계에 손실 압축이 무엇을 남기는지 눈으로 확인하기
전에는 쓸 이유가 없다 — 어차피 36% 는 공짜로 준다.

■ 한 변 16383 의 벽

WebP 는 한 변이 16383px 을 못 넘는다. 아틀라스는 512×16640 이었다. 그래서 재묶기
(art/repack-atlas.py)와 WebP 는 따로 할 수 있는 일이 아니라 한 덩어리다 — 빈 자리를
걷어내 키를 줄여야 비로소 WebP 가 된다. 여기서는 넘치면 그렇게 말하고 멈춘다.
"""
import io, os, re, json, base64

WEBP_MAX = 16383


def frames_of(html):
    """ATLAS_FRAMES 를 읽는다. (프레임, 시작, 끝) — 끝은 '};' 의 '}' 다음."""
    a = html.index("const ATLAS_FRAMES = ") + len("const ATLAS_FRAMES = ")
    b = html.index("};", a) + 1
    return json.loads(html[a:b]), a, b


def put_frames(html, frames, a, b):
    return html[:a] + json.dumps(frames, separators=(",", ":"), ensure_ascii=False) + html[b:]


def embed(html, atlas, path="art/atlas.b64"):
    """아틀라스 그림을 파일 안의 data URI 로 갈아 끼운다."""
    w, h = atlas.size
    if max(w, h) > WEBP_MAX:
        raise SystemExit(f"아틀라스가 {w}x{h} — WebP 는 한 변 {WEBP_MAX} 까지다.\n"
                         "  python3 art/repack-atlas.py 로 빈 자리를 먼저 걷어내라.")
    buf = io.BytesIO()
    atlas.save(buf, "WEBP", lossless=True, quality=100, method=6)
    b64 = base64.b64encode(buf.getvalue()).decode()
    if path: io.open(path, "w").write(b64)
    m = re.search(r'Sprites\.load\("data:image/(?:png|webp);base64,', html)
    if not m: raise SystemExit("game/index.html 에서 Sprites.load 를 못 찾았다")
    end = html.index('"', m.end())
    return (html[:m.start()] + 'Sprites.load("data:image/webp;base64,' + b64 + html[end:],
            len(buf.getvalue()))


def save(html, atlas, game="game/index.html", atlas_path="art/atlas.png"):
    """아틀라스를 저장하고 파일에 심고, 무엇이 얼마나 되었는지 한 줄로 알린다."""
    atlas.save(atlas_path)
    html, nb = embed(html, atlas)
    io.open(game, "w", encoding="utf-8").write(html)
    print(f"아틀라스 {atlas.size[0]}x{atlas.size[1]} · WebP {nb / 1024 / 1024:.2f}MB   "
          f"{game} {os.path.getsize(game) / 1024 / 1024:.2f}MB")

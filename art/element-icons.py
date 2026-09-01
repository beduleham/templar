import sys; sys.path.insert(0,'/home/user/templar/art')
from importlib import import_module
ip = import_module('icon-preview'); G, to_glyph = ip.Grid, ip.to_glyph

def physical():                      # 교차한 검 두 자루
    # 그냥 X 로 두면 '닫기' 표로 읽힌다. 가로 코등이와 자루가 살아남아야 검이 된다.
    g = G()
    g.line(3, 2, 9, 8, 2); g.line(12, 2, 6, 8, 2)         # 두 날 — 위로 뻗는다
    g.rect(3, 9, 10, 2)                                    # 코등이 — 가로 한 줄
    g.rect(6, 11, 2, 3); g.rect(8, 11, 2, 3)               # 자루 두 개
    return g

def fire():                          # 불꽃 — 아래가 넓고 끝이 왼쪽으로 휜다
    # 첫 판은 옆 갈래가 굵어 큰 화면에서 엄지손가락처럼 보였다. 갈래를 지우고
    # 대신 몸통 왼쪽을 파서 불꽃의 굽이를 만든다.
    # 색을 지우고 재니 핏방울과 실루엣이 90% 같았다 — 둘 다 '위가 뾰족한 덩어리'
    # 였다. 색이 통하지 않는 자리(밝은 이펙트 위, 색약)에서는 같은 표인 셈이다.
    # 끝을 둘로 가른다. 갈라진 혀는 방울이 절대 못 흉내낸다.
    g = G()
    g.poly([(5.5, 2), (7.5, 7), (10, 1.5), (12, 7), (12.5, 11),
            (8, 14.5), (3.5, 11.5), (3.5, 7)])
    return g

def frost():                         # 여섯 갈래 결정
    g = G()
    g.line(7, 2, 7, 13, 2)                                # 세로
    g.line(2, 5, 12, 10, 2); g.line(2, 10, 12, 5, 2)      # 두 대각
    for x, y in ((7, 3), (7, 12), (3, 5), (3, 10), (11, 5), (11, 10)):
        g.rect(x - 1, y, 4, 1) if x == 7 else g.rect(x, y - 1, 1, 3)
    return g

def storm():                         # 번개
    # 첫 판은 획이 두 칸이라 16px 에서 지렁이가 됐다. 두 번째 판은 모양은 잡혔는데
    # 켜지는 칸이 29개로 나머지(61~84)의 절반도 안 됐다 — 같은 자리에 놓으면
    # 혼자 작고 흐리게 보인다. 획을 한 칸씩 더 벌린다.
    g = G()
    g.poly([(13, 1), (2.5, 9), (7, 9), (4.5, 15),
            (13.5, 6.5), (8.5, 6.5), (12.5, 1)])
    return g

def holy():                          # 십자
    # 첫 판은 네 귀퉁이에 빛 점을 찍었는데 16px 에서 점 넷이 티끌로 읽혔다.
    # 끝을 벌린 십자(pattée)도 시도했지만, 이 크기에서 벌림이 한 칸이라
    # 벌어진 게 아니라 한쪽이 어긋난 것처럼 보였다. 반듯한 십자가 제일 잘 읽힌다.
    g = G()
    g.rect(6, 2, 4, 12); g.rect(3, 6, 10, 4)
    return g

def blood():                         # 핏방울
    # 불꽃과 갈리도록 반듯한 좌우대칭으로 둔다 — 끝이 하나, 아래가 둥글다.
    g = G()
    # 삼각을 좁게 잡았더니 목이 잘록한 병이 됐다(이 표 묶음엔 이미 flask 가 있다).
    # 넓게 잡아야 아래 둥근 배와 이어져 한 방울로 읽힌다.
    g.disc(8, 10, 4)
    g.poly([(8, 2), (12.2, 10), (3.8, 10)])
    return g

E = [('physical', '#d8d8e4', physical()), ('fire', '#ff8a3c', fire()),
     ('frost', '#7fd2ff', frost()),       ('storm', '#ffe066', storm()),
     ('holy', '#ffd9a0', holy()),         ('blood', '#e0426a', blood())]

items = []
for name, col, g in E:
    rows = to_glyph(g)
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), name
    assert not (set("".join(rows)) - set(".0123")), name
    items.append((name, rows, col))
ip.sheet(items, '/tmp/claude-0/-home-user-templar/6caea4fd-87aa-5c33-a8d0-f440cccacc4f/scratchpad/elem.png', k=13)
print("16×16 여섯 개 통과")

# 게임에 붙일 꼴로 찍는다
out = []
for name, rows, col in items:
    out.append(ip.js("elem_" + name, rows))
open('/tmp/claude-0/-home-user-templar/6caea4fd-87aa-5c33-a8d0-f440cccacc4f/scratchpad/elem.js.txt','w').write("\n".join(out) + "\n")
print("찍음")

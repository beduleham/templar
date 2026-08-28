# 프레임 원본을 놓는 곳

생성 모델로 뽑은 캐릭터 프레임 낱장(PNG)을 여기에 그대로 올린다.
자르지도, 크기를 맞추지도, 배경을 빼지도 않은 **원본 그대로**가 맞다 —
정렬·크롭·축소·배경 제거는 `art/align-frames.py` 가 기계적으로 한다.
사람이 미리 손대면 오히려 프레임마다 기준이 달라진다.

이름은 재생 순서대로. 예)

    paladin_attack_1.png   준비
    paladin_attack_2.png   타격
    paladin_attack_3.png   마무리
    paladin_attack_4.png   회복

만드는 법:

    python3 art/align-frames.py art/out/paladin_attack.png \
      art/src/paladin_attack_1.png art/src/paladin_attack_2.png \
      art/src/paladin_attack_3.png art/src/paladin_attack_4.png

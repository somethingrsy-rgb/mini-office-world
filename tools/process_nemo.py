"""니모(흰동가리) 그림 네 장(tools/src_art/nemo_*.png, 한 줄짜리 시트: 칸 크기는 시트 크기 ÷ 장수)을 잘라 desktop-betta/frames/n_*.webp 로 만들고 dims.js 에 더해요.
  nemo_swim.png   16장  헤엄(몸은 수평, 꼬리·지느러미만 살짝 움직임)  → n_swim
  nemo_sleep.png  12장  가만히 떠 있을 때            → n_idle
  nemo_happy.png  12장  신나서 꼬리 흔들기(더블클릭)  → n_flare
  nemo_turn.png   16장  방향 바꾸기(오른쪽 → 정면 → 왼쪽) → n_turn
그림마다 몸 넓이·무게중심을 같게 맞춰서(동작이 바뀔 때 커졌다 작아지거나 튀지 않게) 같은 크기의 판에 놓아요. 그림 하나 안의 움직임은 그대로예요.
사용법: python3 tools/process_nemo.py   (다른 베타 프레임은 건드리지 않아요)"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta'); FR = os.path.join(OUT, 'frames')
SHEETS = [('swim', 'swim', 16), ('idle', 'sleep', 12), ('flare', 'happy', 12), ('turn', 'turn', 16)]
MASK_COLS = 56
CW, CH = 249, 166            # 판 크기
TARGET_AREA, CX, CY = 11700.0, 126.0, 84.0   # 모든 그림의 편안한 자세 몸 넓이(px²)·무게중심
D = json.loads(open(os.path.join(OUT, 'dims.js')).read().split('=', 1)[1])
for k in [k for k in D['dim'] if k.startswith('n_')]: D['dim'].pop(k); D['mask'].pop(k)


def stats(cell):
    a = np.asarray(cell)[:, :, 3] > 128; ys, xs = np.nonzero(a)
    return float(a.sum()), xs.mean(), ys.mean()


def cells(src, n):
    im = Image.open(os.path.join(ROOT, f'tools/src_art/nemo_{src}.png')).convert('RGBA')
    w = im.width // n
    return [im.crop((i * w, 0, (i + 1) * w, im.height)) for i in range(n)]


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    rows = max(1, round(h * MASK_COLS / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, MASK_COLS + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(MASK_COLS))
    return [MASK_COLS, rows, '%x' % int(bits, 2), MASK_COLS * rows]


REF = {'swim': None, 'idle': None, 'flare': 2, 'turn': 2}   # 편안한 자세로 재는 장수 (돌기·펼치기는 처음 2장)
for fam, src, n in SHEETS:
    cs = cells(src, n)
    st = [stats(c) for c in cs[:REF[fam]]]
    area, cx, cy = (float(np.median([x[k] for x in st])) for k in range(3))
    b = (TARGET_AREA / area) ** 0.5
    D['count'][f'n_{fam}'] = n
    for i, c in enumerate(cs):
        f = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        f.alpha_composite(c.resize((round(c.width * b), round(c.height * b)), Image.LANCZOS), (round(CX - cx * b), round(CY - cy * b)))
        f.save(os.path.join(FR, f'n_{fam}{i}.webp'), 'WEBP', quality=90, method=6)
        D['dim'][f'n_{fam}{i}'] = {'w': CW, 'h': CH}; D['mask'][f'n_{fam}{i}'] = mask_of(f)
open(os.path.join(OUT, 'dims.js'), 'w').write('window.DIMS = ' + json.dumps(D))
print('니모 프레임', sum(n for *_, n in SHEETS), '장,', CW, 'x', CH)

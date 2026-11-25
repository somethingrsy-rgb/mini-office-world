"""니모(흰동가리) 그림 네 장(tools/src_art/nemo_*.png, 한 줄짜리 시트: 한 칸 384x256)을 잘라 desktop-betta/frames/n_*.webp 로 만들고 dims.js 에 더해요.
  nemo_swim.png   16장  헤엄(위아래로 살짝 기울어짐)  → n_swim
  nemo_sleep.png  12장  가만히 떠 있을 때            → n_idle
  nemo_happy.png  12장  신나서 꼬리 흔들기(더블클릭)  → n_flare
  nemo_turn.png   16장  방향 바꾸기(오른쪽 → 정면 → 왼쪽) → n_turn
칸 안의 위치는 그대로 두고(눈 맞추기 불필요: 칸마다 이미 같은 자리), 모든 칸을 같은 비율로 줄여서 크기가 일정해요.
사용법: python3 tools/process_nemo.py   (다른 베타 프레임은 건드리지 않아요)"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta'); FR = os.path.join(OUT, 'frames')
SHEETS = [('swim', 'swim', 16), ('idle', 'sleep', 12), ('flare', 'happy', 12), ('turn', 'turn', 16)]
CELL_W, CELL_H, FISH_W, MASK_COLS = 384, 256, 200, 56
D = json.loads(open(os.path.join(OUT, 'dims.js')).read().split('=', 1)[1])
for k in [k for k in D['dim'] if k.startswith('n_')]: D['dim'].pop(k); D['mask'].pop(k)

sw = Image.open(os.path.join(ROOT, 'tools/src_art/nemo_swim.png')).convert('RGBA')
widths = [np.ptp(np.nonzero((np.asarray(sw)[:, i * CELL_W:(i + 1) * CELL_W, 3] > 128).any(axis=0))[0]) for i in range(16)]
s = FISH_W / float(np.median(widths))
W, H = round(CELL_W * s), round(CELL_H * s)


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    rows = max(1, round(h * MASK_COLS / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, MASK_COLS + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(MASK_COLS))
    return [MASK_COLS, rows, '%x' % int(bits, 2), MASK_COLS * rows]


def stats(cell):   # 몸 넓이와 무게중심
    a = np.asarray(cell)[:, :, 3] > 128; ys, xs = np.nonzero(a)
    return float(a.sum()), xs.mean(), ys.mean()


def cells(src, n):
    im = Image.open(os.path.join(ROOT, f'tools/src_art/nemo_{src}.png')).convert('RGBA')
    assert im.width == CELL_W * n and im.height == CELL_H, (src, im.size)
    return [im.crop((i * CELL_W, 0, (i + 1) * CELL_W, CELL_H)) for i in range(n)]


# 그림마다 몸 크기·자리가 달라서 헤엄↔쉬기↔돌기가 바뀔 때 몸이 커졌다 작아지거나 튀었어요.
# 그래서 '편안한 자세' 몇 장(헤엄·쉬기는 전체, 돌기·펼치기는 처음 2장)의 몸 넓이를 헤엄 그림과 같게 맞추고, 무게중심도 헤엄 그림 자리에 맞춰요 (그림 하나 안에서는 움직임을 그대로 둬요)
REF = {'swim': None, 'idle': None, 'flare': 2, 'turn': 2}
ref = {}
for fam, src, n in SHEETS:
    st = [stats(c) for c in cells(src, n)[:REF[fam]]]
    ref[fam] = tuple(float(np.median([x[k] for x in st])) for k in range(3))
for fam, src, n in SHEETS:
    cs = cells(src, n)
    D['count'][f'n_{fam}'] = n
    r = (ref['swim'][0] / ref[fam][0]) ** 0.5                       # 몸 크기 배율
    dx = ref['swim'][1] - (CELL_W / 2 + (ref[fam][1] - CELL_W / 2) * r)   # 무게중심을 헤엄 그림 자리로 (칸 가운데 기준)
    dy = ref['swim'][2] - (CELL_H / 2 + (ref[fam][2] - CELL_H / 2) * r)
    for i in range(n):
        sw_, sh_ = round(CELL_W * s * r), round(CELL_H * s * r)
        f = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        f.alpha_composite(cs[i].resize((sw_, sh_), Image.LANCZOS), (round((W - sw_) / 2 + dx * s), round((H - sh_) / 2 + dy * s)))
        f.save(os.path.join(FR, f'n_{fam}{i}.webp'), 'WEBP', quality=90, method=6)
        D['dim'][f'n_{fam}{i}'] = {'w': W, 'h': H}; D['mask'][f'n_{fam}{i}'] = mask_of(f)
open(os.path.join(OUT, 'dims.js'), 'w').write('window.DIMS = ' + json.dumps(D))
print('니모 프레임', sum(n for *_, n in SHEETS), '장,', W, 'x', H)

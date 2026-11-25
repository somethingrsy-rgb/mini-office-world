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


for fam, src, n in SHEETS:
    im = Image.open(os.path.join(ROOT, f'tools/src_art/nemo_{src}.png')).convert('RGBA')
    assert im.width == CELL_W * n and im.height == CELL_H, (src, im.size)
    D['count'][f'n_{fam}'] = n
    for i in range(n):
        f = im.crop((i * CELL_W, 0, (i + 1) * CELL_W, CELL_H)).resize((W, H), Image.LANCZOS)
        f.save(os.path.join(FR, f'n_{fam}{i}.webp'), 'WEBP', quality=90, method=6)
        D['dim'][f'n_{fam}{i}'] = {'w': W, 'h': H}; D['mask'][f'n_{fam}{i}'] = mask_of(f)
open(os.path.join(OUT, 'dims.js'), 'w').write('window.DIMS = ' + json.dumps(D))
print('니모 프레임', sum(n for *_, n in SHEETS), '장,', W, 'x', H)

"""노랑 베타의 쉬기(idle)·헤엄(swim)·위아래 헤엄(swim2) 그림이 장면마다 크기가 달라 '바운스바운스' 해 보이는 것을 줄여요.
눈을 중심으로 장면마다 크기를 살짝 키우거나 줄여요. 두 가지를 함께 봐요.
  몸통 크기(눈 주변 분홍 몸 넓이) : 몸이 커졌다 작아졌다 하지 않게
  전체 윤곽 크기(지느러미·꼬리까지 합친 넓이) : 물고기 전체가 커졌다 작아졌다 하지 않게
  배율 = (몸통 기준 비율)^A × (전체 윤곽 기준 비율)^B  (면적 비율이라 선형 배율은 제곱근)
쉬기는 지느러미가 거의 안 움직여서 윤곽을 거의 그대로 맞추고, 위아래 헤엄은 꼬리가 크게 움직이므로 절반만 맞춰요. 가로 헤엄(swim)은 그대로 두고 기준으로만 써요.
사용법: python3 tools/fix_yellow_stable.py [DRY=1: 저장하지 않고 결과만 보기]  (그림을 제자리에서 고쳐요. 두 번 돌리면 한 번 더 같은 방향으로 맞추니 한 번만 돌리세요)"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta'); FR = os.path.join(OUT, 'frames'); dims_path = os.path.join(OUT, 'dims.js')
D = json.loads(open(dims_path).read().split('=', 1)[1])
DRY = os.environ.get('DRY') == '1'
PRE = 'y_'; MASK_COLS = 56
# 그림 묶음별 (몸통 비중 A, 윤곽 비중 B)
W = {'swim2': (0.5, 0.5), 'idle': (0.4, 0.6)}   # 가로 헤엄(swim)은 이미 안정적이라 건드리지 않고 기준으로만 써요
CLIP = (0.88, 1.12)


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    rows = max(1, round(h * MASK_COLS / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, MASK_COLS + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(MASK_COLS))
    return [MASK_COLS, rows, '%x' % int(bits, 2), MASK_COLS * rows]


def scaled(im, k):
    cx, cy = im.width / 2, im.height / 2
    return im.transform(im.size, Image.AFFINE, (1 / k, 0, cx - cx / k, 0, 1 / k, cy - cy / k), resample=Image.BICUBIC)


def measure(im):
    a = np.asarray(im).astype(int); al = a[:, :, 3] > 128; h, w = al.shape; cx, cy = w // 2, h // 2
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    pink = al & (R > 190) & ((R - G) > 25) & ((B - G) > -6)
    return float(pink[max(0, cy - 120):cy + 120, max(0, cx - 200):cx + 60].sum()), float(al.sum())


load = {f: [Image.open(os.path.join(FR, f'{PRE}{f}{i}.webp')).convert('RGBA') for i in range(D['count'][PRE + f])] for f in W}
M = {f: np.array([measure(im) for im in lst]) for f, lst in load.items()}
# 기준: 헤엄(swim)의 몸통·윤곽 중앙값. 묶음마다 기준이 같아야 그림이 바뀔 때 크기가 튀지 않아요
SW = np.array([measure(Image.open(os.path.join(FR, f'{PRE}swim{i}.webp')).convert('RGBA')) for i in range(D['count'][PRE + 'swim'])])
TB, TS = float(np.median(SW[:, 0])), float(np.median(SW[:, 1]))
swing = lambda x: '%.3f~%.3f' % (x.min(), x.max())
for f, lst in load.items():
    a, b = W[f]; n = len(lst); B_, S_ = M[f][:, 0], M[f][:, 1]
    # 윤곽 기준은 묶음 안에서 중앙값 → 헤엄 그림과 어긋남이 있으면 한 번에 같이 맞춰요
    ratio = np.clip((TB / B_) ** (a / 2) * (TS / S_) ** (b / 2), *CLIP)
    new_b = B_ * ratio ** 2; new_s = S_ * ratio ** 2
    print(f'{f:6s} 배율 {swing(ratio)} | 몸통 선형 {swing(np.sqrt(B_ / TB))} → {swing(np.sqrt(new_b / TB))} | 윤곽 선형 {swing(np.sqrt(S_ / TS))} → {swing(np.sqrt(new_s / TS))}')
    if DRY: continue
    for i, im in enumerate(lst):
        out = scaled(im, float(ratio[i])); out.save(os.path.join(FR, f'{PRE}{f}{i}.webp'), 'WEBP', quality=90, method=6); D['mask'][f'{PRE}{f}{i}'] = mask_of(out)
        al = np.asarray(out.getchannel('A')) > 8
        if al[0].any() or al[-1].any() or al[:, 0].any() or al[:, -1].any(): print('  경고: 가장자리에 닿았어요', f, i)
if not DRY: open(dims_path, 'w').write('window.DIMS = ' + json.dumps(D, ensure_ascii=False) + '\n')

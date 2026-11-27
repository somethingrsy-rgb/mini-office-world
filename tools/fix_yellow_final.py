"""노랑 베타 마무리 보정: 가로 헤엄(swim)·위아래 헤엄(swim2)·쉬기(idle)에서 장면마다 남아 있는 '살짝 커졌다 작아졌다'를 줄여요.
세 가지 크기(길이·머리·넓이)를 재서 길이와 머리를 반반으로 한꺼번에 가장 덜 어긋나게 맞춰요 (눈을 중심으로 장면마다 키우거나 줄임):
  몸통 길이(꼬리 제외, 가장 길게 뻗은 방향) · 머리 크기 · 몸통 넓이(눈 주변 분홍 몸)  → 기준은 가로 헤엄 그림의 중앙값
배율은 순환하는 장면 순서에서 이웃 장면과 부드럽게 이어지게 살짝 평균내요.
사용법: python3 tools/fix_yellow_final.py   (DRY=1: 저장 없이 결과만. 제자리에서 고치니 한 번만 돌리세요)"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta'); FR = os.path.join(OUT, 'frames'); dims_path = os.path.join(OUT, 'dims.js')
D = json.loads(open(dims_path).read().split('=', 1)[1])
DRY = os.environ.get('DRY') == '1'; MASK_COLS = 56; CLIP = (0.9, 1.1)
WT = np.array([0.5, 0.5, 0.0])   # 몸통 길이, 머리, 몸통 넓이의 비중 (몸통 넓이는 길이·머리와 거의 겹쳐서 뺐어요)
FAMILIES = ('swim2',)            # 보정할 그림 묶음. 가로 헤엄(swim)과 쉬기(idle)는 이미 안정적이라 기준으로만 써요


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
    p = al & (R > 190) & ((R - G) > 25) & ((B - G) > -6)
    win = np.zeros_like(p); win[max(0, cy - 130):cy + 130, max(0, cx - 230):cx + 70] = True
    ys, xs = np.where(p & win); pts = np.c_[xs, ys].astype(float); c = pts.mean(0)
    proj = (pts - c) @ np.linalg.svd(pts - c, full_matrices=False)[2][0]
    L = np.percentile(proj, 99) - np.percentile(proj, 1)
    head = np.sqrt(float(p[cy - 45:cy + 40, cx - 75:cx + 45].sum()))
    body = np.sqrt(float(p[max(0, cy - 120):cy + 120, max(0, cx - 200):cx + 60].sum()))
    return np.array([L, head, body])


ld = lambda f, i: Image.open(os.path.join(FR, f'y_{f}{i}.webp')).convert('RGBA')
M = {f: np.array([measure(ld(f, i)) for i in range(D['count']['y_' + f])]) for f in ('swim', 'swim2', 'idle')}
T = np.median(M['swim'], axis=0)
rng = lambda x: '%.3f~%.3f' % (x.min(), x.max())
for f in FAMILIES:
    m = M[f] / T                                   # 기준 대비 (선형)
    logk = -(np.log(m) @ WT)                       # 세 가지를 함께 가장 덜 어긋나게 하는 배율
    logk = 0.25 * np.roll(logk, 1) + 0.5 * logk + 0.25 * np.roll(logk, -1)   # 순환하는 이웃 장면과 부드럽게
    k = np.clip(np.exp(logk), *CLIP); after = m * k[:, None]
    print(f'{f:6s} 배율 {rng(k)} | 몸통길이 {rng(m[:, 0])}→{rng(after[:, 0])} | 머리 {rng(m[:, 1])}→{rng(after[:, 1])} | 몸통넓이 {rng(m[:, 2])}→{rng(after[:, 2])}')
    if DRY: continue
    for i in range(len(k)):
        out = scaled(ld(f, i), float(k[i])); out.save(os.path.join(FR, f'y_{f}{i}.webp'), 'WEBP', quality=90, method=6); D['mask'][f'y_{f}{i}'] = mask_of(out)
        al = np.asarray(out.getchannel('A')) > 8
        if al[0].any() or al[-1].any() or al[:, 0].any() or al[:, -1].any(): print('  경고: 가장자리에 닿았어요', f, i)
if not DRY: open(dims_path, 'w').write('window.DIMS = ' + json.dumps(D, ensure_ascii=False) + '\n')

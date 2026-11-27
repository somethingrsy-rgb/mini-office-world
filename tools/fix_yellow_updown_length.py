"""노랑 베타 위·아래 헤엄(swim2)의 '꼬리를 뺀 몸통 길이'를 장면마다 같게 맞춰요 (위로 갈 때·내려갈 때 몸이 길어졌다 짧아졌다 해서 바운스처럼 보였어요).
몸통 = 눈 주변의 분홍색 몸(꼬리의 살구색 줄무늬와 하늘색 지느러미는 빠져요). 몸을 가장 길게 뻗은 방향(주축)의 길이를 재서,
가로 헤엄(swim) 그림의 몸통 길이(중앙값)와 같아지게 눈을 중심으로 장면마다 키우거나 줄여요.
사용법: python3 tools/fix_yellow_updown_length.py   (DRY=1 이면 저장하지 않고 결과만 보여 줘요. 그림을 제자리에서 고치니 한 번만 돌리세요)"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta'); FR = os.path.join(OUT, 'frames'); dims_path = os.path.join(OUT, 'dims.js')
D = json.loads(open(dims_path).read().split('=', 1)[1])
DRY = os.environ.get('DRY') == '1'; MASK_COLS = 56; CLIP = (0.85, 1.15)


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    rows = max(1, round(h * MASK_COLS / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, MASK_COLS + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(MASK_COLS))
    return [MASK_COLS, rows, '%x' % int(bits, 2), MASK_COLS * rows]


def scaled(im, k):
    cx, cy = im.width / 2, im.height / 2
    return im.transform(im.size, Image.AFFINE, (1 / k, 0, cx - cx / k, 0, 1 / k, cy - cy / k), resample=Image.BICUBIC)


def body_len(im):
    a = np.asarray(im).astype(int); al = a[:, :, 3] > 128; h, w = al.shape; cx, cy = w // 2, h // 2
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    p = al & (R > 190) & ((R - G) > 25) & ((B - G) > -6)
    win = np.zeros_like(p); win[max(0, cy - 130):cy + 130, max(0, cx - 230):cx + 70] = True
    ys, xs = np.where(p & win); pts = np.c_[xs, ys].astype(float); c = pts.mean(0)
    proj = (pts - c) @ np.linalg.svd(pts - c, full_matrices=False)[2][0]
    return float(np.percentile(proj, 99) - np.percentile(proj, 1))


ld = lambda f, i: Image.open(os.path.join(FR, f'y_{f}{i}.webp')).convert('RGBA')
LT = float(np.median([body_len(ld('swim', i)) for i in range(D['count']['y_swim'])]))
ims = [ld('swim2', i) for i in range(D['count']['y_swim2'])]; L = np.array([body_len(im) for im in ims])
k = np.clip(LT / L, *CLIP)
print('기준(가로 헤엄 몸통 길이) %.0f' % LT, '| 위아래 헤엄 몸통 길이(기준 대비) %.2f~%.2f → %.2f~%.2f' % (*(L / LT).take([L.argmin(), L.argmax()]), *((L * k / LT).take([(L * k).argmin(), (L * k).argmax()]))))
print('배율', np.round(k, 2).tolist())
if not DRY:
    for i, im in enumerate(ims):
        out = scaled(im, float(k[i])); out.save(os.path.join(FR, f'y_swim2{i}.webp'), 'WEBP', quality=90, method=6); D['mask'][f'y_swim2{i}'] = mask_of(out)
        al = np.asarray(out.getchannel('A')) > 8
        if al[0].any() or al[-1].any() or al[:, 0].any() or al[:, -1].any(): print('경고: 가장자리에 닿았어요', i)
    open(dims_path, 'w').write('window.DIMS = ' + json.dumps(D, ensure_ascii=False) + '\n')

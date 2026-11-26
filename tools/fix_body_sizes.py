"""노랑 베타(y_)의 모든 그림에서 '눈 기준 몸통(분홍색 몸) 크기'를 똑같이 맞춰요.
눈이 판 가운데에 있으니, 눈 주변의 분홍색 몸 넓이(body_area)를 재서 헤엄 그림의 중앙값과 같아지게 장면마다 눈을 중심으로 키우거나 줄여요.
들쭉날쭉한 장면은 앞뒤 2장의 중앙값으로 부드럽게 하고, 돌기는 옆모습인 처음 3장·끝 3장(거울)으로 한 번에 맞춰요.
사용법: ONLY=y_ python3 tools/fix_body_sizes.py   (프레임을 제자리에서 바꿔요: 같은 프레임에 두 번 실행하지 말고, process_betta.py yellow 로 다시 만든 뒤 한 번만 실행하세요)"""
import json, os
import numpy as np
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta'); FR = os.path.join(OUT, 'frames')
dims_path = os.path.join(OUT, 'dims.js')
D = json.loads(open(dims_path).read().split('=', 1)[1])
ONLY = os.environ.get('ONLY', 'y_')
MASK_COLS = 56


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    rows = max(1, round(h * MASK_COLS / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, MASK_COLS + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(MASK_COLS))
    return [MASK_COLS, rows, '%x' % int(bits, 2), MASK_COLS * rows]


def scaled(im, k):
    cx, cy = im.width / 2, im.height / 2
    return im.transform(im.size, Image.AFFINE, (1 / k, 0, cx - cx / k, 0, 1 / k, cy - cy / k), resample=Image.BICUBIC)


def body_area(im):
    """눈을 중심으로 한 큰 창(왼쪽 200px~오른쪽 60px, 위아래 120px) 안의 '분홍색 몸' 넓이. 꼬리의 살구색 줄무늬는 파랑이 초록보다 작아서(B<G) 빠지고, 몸의 분홍은 B>=G 예요.
    창이 몸 전체를 담을 만큼 커서 크기를 키우거나 줄여도 넓이가 배율의 제곱에 비례해요."""
    a = np.asarray(im).astype(int); al = a[:, :, 3] > 128; h, w = al.shape; cx, cy = w // 2, h // 2
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    pink = al & (R > 190) & ((R - G) > 25) & ((B - G) > -6)
    return float(pink[max(0, cy - 120):cy + 120, max(0, cx - 200):cx + 60].sum())


pre = ONLY
fams = [f for f in ('swim', 'swim2', 'idle', 'flare', 'turn') if D['count'].get(pre + f)]
load = {f: [Image.open(os.path.join(FR, f'{pre}{f}{i}.webp')).convert('RGBA') for i in range(D['count'][pre + f])] for f in fams}
A = {f: [body_area(im) for im in lst] for f, lst in load.items()}
T = float(np.median(A['swim']))
print('기준(헤엄 중앙값) 분홍 몸 넓이', int(T))
for f, lst in load.items():
    n = len(lst)
    if f == 'turn':
        ref = A[f][:3] + [body_area(ImageOps.mirror(lst[i])) for i in range(n - 3, n)]
        s = float(np.clip((T / np.median(ref)) ** 0.5, 0.7, 1.4)); ratio = [s] * n
    else:
        ratio = []
        for i in range(n):
            win = [A[f][(i + o) % n] for o in (-2, -1, 0, 1, 2)]; m = float(np.median(win))
            ratio.append(float(np.clip((T / max(m, 1)) ** 0.5, 0.75, 1.35)))
    for i, im in enumerate(lst):
        out = scaled(im, ratio[i]); out.save(os.path.join(FR, f'{pre}{f}{i}.webp'), 'WEBP', quality=90, method=6); D['mask'][f'{pre}{f}{i}'] = mask_of(out)
    print(f, '배율 평균 %.2f (%.2f~%.2f)' % (np.mean(ratio), min(ratio), max(ratio)))

# 가장자리에 닿아 잘리면 모든 그림을 더 큰 판에 옮겨 담아요
names = [f'{pre}{f}{i}' for f in fams for i in range(D['count'][pre + f])]
ims = {k: Image.open(os.path.join(FR, k + '.webp')).convert('RGBA') for k in names}
touch = lambda im: (lambda a: a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any())(np.asarray(im.getchannel('A')) > 8)
if any(touch(im) for im in ims.values()):
    W0, H0 = next(iter(ims.values())).size; W1, H1 = int(W0 * 1.2) // 2 * 2, int(H0 * 1.2) // 2 * 2
    for k, im in ims.items():
        c = Image.new('RGBA', (W1, H1), (0, 0, 0, 0)); c.alpha_composite(im, ((W1 - W0) // 2, (H1 - H0) // 2))
        c.save(os.path.join(FR, k + '.webp'), 'WEBP', quality=90, method=6); D['dim'][k] = {'w': W1, 'h': H1}; D['mask'][k] = mask_of(c)
    print('가장자리에 닿아서 판을 키웠어요:', (W0, H0), '->', (W1, H1))
open(dims_path, 'w').write('window.DIMS = ' + json.dumps(D, ensure_ascii=False) + '\n')

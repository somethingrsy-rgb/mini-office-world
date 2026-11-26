"""꼬리 펼치기(flare) 그림의 몸 크기를 헤엄 그림과 맞춰요.
펼치기는 꼬리를 접은 채 시작해서 활짝 펴고 다시 접는데, 접힌 장면(처음·끝)이 헤엄 그림보다 눈에 띄게 작아서 더블클릭하면 몸이 순간 작아졌다 커졌어요.
눈 뒤쪽 몸통·꼬리 부분의 세로 두께(눈에서 왼쪽으로 40~90px 구간, 알파 기준)를 재서, 헤엄 그림의 중앙값보다 작은 장면만 눈을 중심으로 키워요 (최대 1.3배: 머리가 너무 커져 보이지 않게).
사용법: python3 tools/fix_flare_sizes.py   (분홍·주황·보라 모두. 이미 키운 프레임에 또 실행하면 한 번 더 커지니, git 의 원본 프레임에서 한 번만 실행하세요)"""
import json, os
ONLY = os.environ.get('ONLY')   # 예: ONLY=y_ 이면 노랑 베타만
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta'); FR = os.path.join(OUT, 'frames')
dims_path = os.path.join(OUT, 'dims.js')
D = json.loads(open(dims_path).read().split('=', 1)[1])
MASK_COLS = 56
MAXS = 1.3


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    rows = max(1, round(h * MASK_COLS / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, MASK_COLS + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(MASK_COLS))
    return [MASK_COLS, rows, '%x' % int(bits, 2), MASK_COLS * rows]


def scaled(im, k):
    cx, cy = im.width / 2, im.height / 2
    return im.transform(im.size, Image.AFFINE, (1 / k, 0, cx - cx / k, 0, 1 / k, cy - cy / k), resample=Image.BICUBIC)


def thick(im):
    a = np.asarray(im.getchannel('A')) > 128; cx = im.width // 2; v = []
    for dx in range(-90, -35, 10):
        ys = np.nonzero(a[:, cx + dx])[0]; v.append(ys.max() - ys.min() if len(ys) else 0)
    return float(np.median(v))


for pre in [p for p in ('', 'o_', 'p_', 'y_') if not ONLY or p == ONLY]:
    nf = D['count'].get(pre + 'flare', 0)
    if not nf: continue
    swim = [Image.open(os.path.join(FR, f'{pre}swim{i}.webp')).convert('RGBA') for i in range(D['count'][pre + 'swim'])]
    M = float(np.median([thick(im) for im in swim]))
    sc = []
    for i in range(nf):
        p = os.path.join(FR, f'{pre}flare{i}.webp'); im = Image.open(p).convert('RGBA')
        m = thick(im); s = min(MAXS, M / m) if 0 < m < M * 0.97 else 1.0
        sc.append(s)
        if s > 1.001:
            out = scaled(im, s); out.save(p, 'WEBP', quality=90, method=6); D['mask'][f'{pre}flare{i}'] = mask_of(out)
    print(repr(pre), '펼치기 배율 (최대 %.2f, 키운 장수 %d/%d)' % (max(sc), sum(1 for s in sc if s > 1.001), nf))
    # 가장자리에 닿아 잘렸으면 그 물고기의 모든 그림을 더 큰 판에 옮겨 담아요
    names = [f'{pre}{f}{i}' for f in ('swim', 'swim2', 'idle', 'turn', 'flare') for i in range(D['count'].get(pre + f, 0))]
    ims = {k: Image.open(os.path.join(FR, k + '.webp')).convert('RGBA') for k in names}
    def touches(im):
        a = np.asarray(im.getchannel('A')) > 8
        return a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any()
    if any(touches(im) for im in ims.values()):
        W0, H0 = next(iter(ims.values())).size; W1, H1 = int(W0 * 1.3) // 2 * 2, int(H0 * 1.3) // 2 * 2
        for k, im in ims.items():
            c = Image.new('RGBA', (W1, H1), (0, 0, 0, 0)); c.alpha_composite(im, ((W1 - W0) // 2, (H1 - H0) // 2))
            c.save(os.path.join(FR, k + '.webp'), 'WEBP', quality=90, method=6)
            D['dim'][k] = {'w': W1, 'h': H1}; D['mask'][k] = mask_of(c)
        print(repr(pre), '가장자리에 닿아서 판을 키웠어요:', (W0, H0), '->', (W1, H1))
open(dims_path, 'w').write('window.DIMS = ' + json.dumps(D, ensure_ascii=False) + '\n')

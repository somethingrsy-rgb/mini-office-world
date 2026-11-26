"""베타 프레임의 머리 크기를 맞춰요. 눈에서 코끝까지의 거리를 재서, 같은 물고기의 모든 프레임이 헤엄 그림과 같은 머리 크기가 되도록
눈(판 가운데)을 중심으로 키우거나 줄여요. 이웃 프레임의 중앙값으로 부드럽게 해서 프레임마다 크기가 들쭉날쭉하지 않게 해요.
사용법: python3 tools/fix_betta_sizes.py  (tools/process_betta.py 로 프레임을 만든 다음에 실행)"""
import json, os
ONLY = os.environ.get('ONLY')   # 예: ONLY=y_ python3 tools/fix_betta_sizes.py → 노랑 베타 프레임만 고쳐요
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta'); FR = os.path.join(OUT, 'frames')
dims_path = os.path.join(OUT, 'dims.js')
D = json.loads(open(dims_path).read().split('=', 1)[1])
FAM = {'swim': 16, 'idle': 8, 'flare': 24, 'turn': 12}
MASK_COLS = 56


def nose(img):
    a = np.asarray(img.getchannel('A')) > 128; h, w = a.shape
    rows = a[h // 2 - 4:h // 2 + 5, :].any(axis=0); xs = np.nonzero(rows)[0]
    return float(xs.max() - w // 2) if len(xs) else None


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    cols = MASK_COLS; rows = max(1, round(h * cols / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, cols + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(cols))
    return [cols, rows, '%x' % int(bits, 2), cols * rows]


def scaled(im, k):
    cx, cy = im.width / 2, im.height / 2
    return im.transform(im.size, Image.AFFINE, (1 / k, 0, cx - cx / k, 0, 1 / k, cy - cy / k), resample=Image.BICUBIC)


for pre in [p for p in ('', 'o_', 'y_') if not ONLY or p == ONLY]:   # 보라 베타는 process_betta.py 에서 이미 눈~코끝 기준으로 맞춰서 여기서는 건드리지 않아요
    FAMP = dict(FAM, swim2=16) if pre == 'y_' else FAM   # 노랑 베타는 위·아래 헤엄(swim2) 한 벌이 더 있어요
    ims = {f: [Image.open(os.path.join(FR, f'{pre}{f}{i}.webp')).convert('RGBA') for i in range(n)] for f, n in FAMP.items()}
    d = {f: [nose(im) for im in lst] for f, lst in ims.items()}
    target = float(np.median([x for x in d['swim'] if x]))
    for f, lst in ims.items():
        n = len(lst); right = list(range(4)) if f == 'turn' else list(range(n))        # 돌기는 오른쪽을 보는 앞 4장만 재요
        meas = {i: d[f][i] for i in right if d[f][i]}
        fam_ratio = target / float(np.median(list(meas.values())))
        ratio = []
        for i in range(n):
            if f == 'turn' or i not in meas: ratio.append(fam_ratio); continue
            win = [meas[(i + o) % n] for o in (-2, -1, 0, 1, 2) if ((i + o) % n) in meas]   # 앞뒤 프레임(순환)의 중앙값으로 부드럽게
            ratio.append(target / float(np.median(win)))
        ratio = np.clip(ratio, 0.7, 1.4)
        for i, im in enumerate(lst):
            out = scaled(im, float(ratio[i]))
            out.save(os.path.join(FR, f'{pre}{f}{i}.webp'), 'WEBP', quality=90, method=6)
            D['mask'][f'{pre}{f}{i}'] = mask_of(out)
        print(repr(pre), f, '배율 평균 %.2f (%.2f~%.2f)' % (np.mean(ratio), min(ratio), max(ratio)))
open(dims_path, 'w').write('window.DIMS = ' + json.dumps(D, ensure_ascii=False) + '\n')

# 크기를 키운 프레임이 가장자리에서 잘리면, 그 물고기의 모든 프레임을 같은 비율로 더 큰 판(눈이 정중앙)에 옮겨 담아요
for pre in [p for p in ('', 'o_', 'p_', 'y_') if not ONLY or p == ONLY]:
    names = [f'{pre}{f}{i}' for f, n in (dict(FAM, swim2=16) if pre == 'y_' else FAM).items() for i in range(n)]
    ims = {k: Image.open(os.path.join(FR, k + '.webp')).convert('RGBA') for k in names}
    def touches(im):
        a = np.asarray(im.getchannel('A')) > 8
        return a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any()
    if not any(touches(im) for im in ims.values()): continue
    W0, H0 = next(iter(ims.values())).size; W1, H1 = int(W0 * 1.3) // 2 * 2, int(H0 * 1.3) // 2 * 2
    for k, im in ims.items():
        c = Image.new('RGBA', (W1, H1), (0, 0, 0, 0)); c.alpha_composite(im, ((W1 - W0) // 2, (H1 - H0) // 2))
        c.save(os.path.join(FR, k + '.webp'), 'WEBP', quality=90, method=6)
        D['dim'][k] = {'w': W1, 'h': H1}; D['mask'][k] = mask_of(c)
    print(repr(pre), '가장자리에 닿아서 판을 키웠어요:', (W0, H0), '->', (W1, H1))
open(dims_path, 'w').write('window.DIMS = ' + json.dumps(D, ensure_ascii=False) + '\n')

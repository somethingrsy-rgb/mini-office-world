"""고양이 그림 두 장(tools/src_art/catsA.png, catsB.png: 각각 3줄 x 8장)에서 필요한 그림을 골라
public/assets/cats/*.webp 와 src/cats.gen.ts 를 만들어요.  사용법: python3 tools/process_cats.py
  A 위: 웅크리고 뛰어오르기 / A 가운데: 서기·기지개·하품 / A 아래: 자기·세수·애교
  B 위: 점프(공중·착지) / B 가운데: 웅크려 앉기 / B 아래: 걷기"""
import json, os
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAND_PX = 130  # A 가운데 첫 그림(서 있기)의 높이(px). 나머지는 이 크기에 맞춰요.

# 동작 이름 -> [(그림 파일, 줄, 칸), ...]   mode 'T0' = 서 있는 모습과 같은 몸 크기, 'own' = 그 동작끼리만 크기를 맞춰요
PLAN = {
    'walk':    ('T0',  [('B', 2, i) for i in range(8)]),
    'jump':    ('T0',  [('A', 0, i) for i in range(1, 7)] + [('B', 0, i) for i in range(8)]),
    'stand':   ('own', [('A', 1, 0), ('A', 0, 0), ('A', 1, 4)]),
    'sit':     ('T0',  [('B', 1, 3), ('B', 1, 4), ('B', 1, 7)]),
    'stretch': ('own', [('A', 1, 1), ('A', 1, 2), ('A', 1, 3)]),
    'sleep':   ('own', [('A', 2, 0), ('A', 2, 1)]),
    'groom':   ('own', [('A', 2, 2), ('A', 2, 3)]),
    'aegyo':   ('own', [('A', 2, 4), ('A', 2, 5), ('A', 2, 6), ('A', 2, 7)]),
}


def extract(path):
    im = Image.open(path).convert('RGBA')
    rgb = np.asarray(im)[:, :, :3]; a = np.asarray(im)[:, :, 3]
    lab, n = ndi.label(a > 200)
    objs = ndi.find_objects(lab); sizes = ndi.sum(a > 200, lab, range(1, n + 1))
    cs = [(i, sl, (sl[0].start + sl[0].stop) // 2, (sl[1].start + sl[1].stop) // 2) for i, (sl, s) in enumerate(zip(objs, sizes), start=1) if s > 6000]
    rows = [[], [], []]
    for c in cs: rows[min(2, c[2] * 3 // im.height)].append(c)
    out = []
    for r in rows:
        r.sort(key=lambda c: c[3])
        assert len(r) == 8, len(r)
        line = []
        for i, sl, _, _ in r:
            pad = 12
            y0, y1 = max(sl[0].start - pad, 0), min(sl[0].stop + pad, a.shape[0]); x0, x1 = max(sl[1].start - pad, 0), min(sl[1].stop + pad, a.shape[1])
            keep = ndi.binary_dilation(lab[y0:y1, x0:x1] == i, iterations=5)           # 고양이 덩어리 + 털 가장자리
            al = np.where(keep & (a[y0:y1, x0:x1] >= 12), a[y0:y1, x0:x1], 0).astype(np.uint8)  # 번진 색 얼룩 제거
            sp = Image.fromarray(np.dstack([rgb[y0:y1, x0:x1], al]), 'RGBA')
            line.append(sp.crop(sp.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()))
        out.append(line)
    return out


def area(img):
    return float((np.asarray(img.getchannel('A')) > 128).sum())


SHEETS = {k: extract(os.path.join(ROOT, f'tools/src_art/cats{k}.png')) for k in ('A', 'B')}
pick = lambda t: SHEETS[t[0]][t[1]][t[2]]
scaleA = STAND_PX / pick(('A', 1, 0)).height
T0 = float(np.mean([area(pick(t)) for t in PLAN['stand'][1]])) * scaleA ** 2   # 서 있는 모습의 몸 크기(면적)

out = os.path.join(ROOT, 'public/assets/cats')
os.makedirs(out, exist_ok=True)
for f in os.listdir(out): os.remove(os.path.join(out, f))
meta = {}
names = []
for g, (mode, items) in PLAN.items():
    imgs = [pick(t) for t in items]
    mean_a = float(np.mean([area(i) for i in imgs]))
    scaled = []
    for img in imgs:
        # 같은 동작의 그림끼리 몸 크기를 맞춰요 (그림마다 크기가 달라 보이면 걸을 때 커졌다 작아져 보여요)
        f = (T0 / area(img)) ** 0.5 if mode == 'T0' else scaleA * (mean_a / area(img)) ** 0.5
        scaled.append(img.resize((max(1, round(img.width * f)), max(1, round(img.height * f))), Image.LANCZOS))
    cw = max(v.width for v in scaled); ch = max(v.height for v in scaled)
    for k, v in enumerate(scaled):
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(v, ((cw - v.width) // 2, ch - v.height))   # 같은 칸에 발 높이·가운데를 맞춰 담아요
        canvas.save(os.path.join(out, f'{g}{k}.webp'), 'WEBP', quality=90, method=6)
        meta[f'{g}{k}'] = {'w': cw, 'h': ch}; names.append(f'{g}{k}')
with open(os.path.join(ROOT, 'src/cats.gen.ts'), 'w') as f:
    f.write('// tools/process_cats.py 가 만든 파일이에요. 직접 고치지 마세요.\nexport const CAT_DIM: Record<string, { w: number; h: number }> = ' + json.dumps(meta, indent=1) + '\n'
            + 'export const CAT_COUNT: Record<string, number> = ' + json.dumps({g: len(items) for g, (_, items) in PLAN.items()}) + '\n')
mp = os.path.join(ROOT, 'public/assets/manifest.json')
m = [x for x in json.load(open(mp)) if not x.startswith('cats/')] + [f'cats/{n}.webp' for n in names]
json.dump(sorted(m), open(mp, 'w'))
print(len(names), 'cats')

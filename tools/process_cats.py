"""고양이 그림(tools/src_art/cats2.png: 위 줄 걷기 8장, 가운데 줄 앉기 3·기지개 3, 아래 줄 자기 2·세수 2·애교 3)을
한 마리씩 잘라 public/assets/cats/*.webp 와 src/cats.gen.ts 로 만들어요.  사용법: python3 tools/process_cats.py"""
import json, os
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROWS = [  # 위에서 아래로, 각 줄은 왼쪽에서 오른쪽 순서
    [f'walk{i}' for i in range(8)],
    ['sit0', 'sit1', 'sit2', 'stretch0', 'stretch1', 'stretch2'],
    ['sleep0', 'sleep1', 'groom0', 'groom1', 'aegyo0', 'aegyo1', 'aegyo2'],
]
STAND_PX = 130  # 걷기 첫 그림의 높이(px). 모든 그림을 같은 배율로 줄여요.

im = Image.open(os.path.join(ROOT, 'tools/src_art/cats2.png')).convert('RGBA')
rgb = np.asarray(im)[:, :, :3]
a = np.asarray(im)[:, :, 3]
lab, n = ndi.label(a > 120)
objs = ndi.find_objects(lab)
sizes = ndi.sum(a > 120, lab, range(1, n + 1))
cats = []
for i, (sl, s) in enumerate(zip(objs, sizes), start=1):
    if s > 4000:  # 큰 덩어리만 고양이 (색 얼룩은 작아요)
        cats.append((i, sl, (sl[0].start + sl[0].stop) // 2, (sl[1].start + sl[1].stop) // 2))
rows = [[], [], []]
for c in cats:
    rows[0 if c[2] < 300 else 1 if c[2] < 600 else 2].append(c)
imgs = {}
for names, row in zip(ROWS, rows):
    row.sort(key=lambda c: c[3])
    assert len(row) == len(names), (len(row), len(names))
    for name, (i, sl, _, _) in zip(names, row):
        pad = 12
        y0, y1 = max(sl[0].start - pad, 0), min(sl[0].stop + pad, a.shape[0])
        x0, x1 = max(sl[1].start - pad, 0), min(sl[1].stop + pad, a.shape[1])
        keep = ndi.binary_dilation(lab[y0:y1, x0:x1] == i, iterations=5)
        al = np.where(keep & (a[y0:y1, x0:x1] >= 12), a[y0:y1, x0:x1], 0).astype(np.uint8)
        sp = Image.fromarray(np.dstack([rgb[y0:y1, x0:x1], al]), 'RGBA')
        imgs[name] = sp.crop(sp.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())

# 뛰는 그림(tools/src_art/cats_jump.png: 2줄 x 6장, 순서대로 이어서 한 번의 점프): 층과 층 사이를 뛸 때 써요
jim = Image.open(os.path.join(ROOT, 'tools/src_art/cats_jump.png')).convert('RGBA')
jrgb = np.asarray(jim)[:, :, :3]; ja = np.asarray(jim)[:, :, 3]
jl, jn = ndi.label(ja > 200)
jobjs = ndi.find_objects(jl); jsizes = ndi.sum(ja > 200, jl, range(1, jn + 1))
jc = [(i, sl, (sl[0].start + sl[0].stop) // 2, (sl[1].start + sl[1].stop) // 2) for i, (sl, sz) in enumerate(zip(jobjs, jsizes), start=1) if sz > 8000]
jc.sort(key=lambda c: (0 if c[2] < 360 else 1, c[3]))
assert len(jc) == 12, len(jc)
JUMP_SRC = {}
for k, (i, sl, _, _) in enumerate(jc):
    pad = 12
    y0, y1 = max(sl[0].start - pad, 0), min(sl[0].stop + pad, ja.shape[0]); x0, x1 = max(sl[1].start - pad, 0), min(sl[1].stop + pad, ja.shape[1])
    keep = ndi.binary_dilation(jl[y0:y1, x0:x1] == i, iterations=5)
    al = np.where(keep & (ja[y0:y1, x0:x1] >= 12), ja[y0:y1, x0:x1], 0).astype(np.uint8)
    sp = Image.fromarray(np.dstack([jrgb[y0:y1, x0:x1], al]), 'RGBA')
    JUMP_SRC[f'jump{k}'] = sp.crop(sp.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
imgs.update(JUMP_SRC)

scale = STAND_PX / imgs['walk0'].height
GROUPS = ['walk', 'sit', 'stretch', 'sleep', 'groom', 'aegyo', 'jump']
# 같은 동작의 그림끼리는 몸 크기(면적)를 맞추고, 같은 크기의 빈 캔버스에 발 높이·가운데를 맞춰 담아요.
# (그림마다 따로 잘라 쓰면 걸을 때마다 고양이가 커졌다 작아졌다 해 보여요)
def area(img):
    return float((np.asarray(img.getchannel('A')) > 128).sum())
out = os.path.join(ROOT, 'public/assets/cats')
os.makedirs(out, exist_ok=True)
for f in os.listdir(out): os.remove(os.path.join(out, f))
meta = {}
for g in GROUPS:
    names = [n for n in imgs if n.startswith(g)]
    mean_a = np.mean([area(imgs[n]) for n in names])
    if g == 'jump': mean_a = np.mean([area(imgs[n]) for n in imgs if n.startswith('walk')])  # 걷는 모습과 같은 몸 크기로
    scaled = {}
    for n in names:
        f = scale * (mean_a / area(imgs[n])) ** 0.5
        im2 = imgs[n]
        scaled[n] = im2.resize((max(1, round(im2.width * f)), max(1, round(im2.height * f))), Image.LANCZOS)
    cw = max(v.width for v in scaled.values()); ch = max(v.height for v in scaled.values())
    for n, v in scaled.items():
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(v, ((cw - v.width) // 2, ch - v.height))
        canvas.save(os.path.join(out, f'{n}.webp'), 'WEBP', quality=90, method=6)
        meta[n] = {'w': cw, 'h': ch}
with open(os.path.join(ROOT, 'src/cats.gen.ts'), 'w') as f:
    f.write('// tools/process_cats.py 가 만든 파일이에요. 직접 고치지 마세요.\nexport const CAT_DIM: Record<string, { w: number; h: number }> = ' + json.dumps(meta, indent=1) + '\n')
mp = os.path.join(ROOT, 'public/assets/manifest.json')
m = [x for x in json.load(open(mp)) if not x.startswith('cats/')] + [f'cats/{n}.webp' for n in imgs]
json.dump(sorted(m), open(mp, 'w'))
print(len(imgs), 'cats', {g: meta[[n for n in meta if n.startswith(g)][0]] for g in GROUPS})

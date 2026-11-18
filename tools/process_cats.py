"""고양이 그림 네 장(tools/src_art/*.png, 각 6칸 x 2줄 = 12프레임)을 잘라 public/assets/cats/*.webp 와 src/cats.gen.ts 를 만들어요.
  walkR.png: 오른쪽으로 걷기 / walkL.png: 왼쪽으로 걷기 / jumpup.png: 위층으로 뛰기 / jumpdown.png: 아래층으로 뛰기
사용법: python3 tools/process_cats.py"""
import json, os
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = {'walkR': 'walkR', 'walkL': 'walkL', 'up': 'jumpup', 'down': 'jumpdown'}
STAND_PX = 130  # 걷기 그림의 평균 몸 크기가 이 키(px)쯤 되도록 줄여요


def extract(path):
    im = Image.open(path).convert('RGBA')
    rgb = np.asarray(im)[:, :, :3]; a = np.asarray(im)[:, :, 3]
    lab, n = ndi.label(a > 200)
    objs = ndi.find_objects(lab); sizes = ndi.sum(a > 200, lab, range(1, n + 1))
    cs = [(i, sl, (sl[0].start + sl[0].stop) // 2, (sl[1].start + sl[1].stop) // 2) for i, (sl, s) in enumerate(zip(objs, sizes), start=1) if s > 6000]
    rows = [[], []]
    for c in cs: rows[min(1, c[2] * 2 // im.height)].append(c)
    frames = []
    for r in rows:
        r.sort(key=lambda c: c[3])
        assert len(r) == 6, len(r)
        for i, sl, _, _ in r:
            pad = 12
            y0, y1 = max(sl[0].start - pad, 0), min(sl[0].stop + pad, a.shape[0]); x0, x1 = max(sl[1].start - pad, 0), min(sl[1].stop + pad, a.shape[1])
            keep = ndi.binary_dilation(lab[y0:y1, x0:x1] == i, iterations=5)                      # 고양이 덩어리 + 털 가장자리
            al = np.where(keep & (a[y0:y1, x0:x1] >= 12), a[y0:y1, x0:x1], 0).astype(np.uint8)  # 번진 색 얼룩 제거
            sp = Image.fromarray(np.dstack([rgb[y0:y1, x0:x1], al]), 'RGBA')
            frames.append(sp.crop(sp.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()))
    return frames


area = lambda img: float((np.asarray(img.getchannel('A')) > 128).sum())
cx = lambda v: float((np.asarray(v.getchannel('A')).astype(np.float64).sum(axis=0) * np.arange(v.width)).sum() / max(np.asarray(v.getchannel('A')).astype(np.float64).sum(), 1))

raw = {k: extract(os.path.join(ROOT, f'tools/src_art/{f}.png')) for k, f in SHEETS.items()}
# 네 장의 고양이 크기가 서로 달라서, 걷기 그림의 평균 몸 크기를 기준으로 장마다 한 배율을 정해 모든 프레임에 똑같이 적용해요
# (프레임마다 따로 맞추면 걸을 때 커졌다 작아졌다 해요)
ref = float(np.mean([area(i) for i in raw['walkR'] + raw['walkL']]))
base = STAND_PX / float(np.mean([i.height for i in raw['walkR']])) * (1.0)
tgt = ref * base ** 2   # 목표 몸 크기(면적)
out = os.path.join(ROOT, 'public/assets/cats')
os.makedirs(out, exist_ok=True)
for f in os.listdir(out): os.remove(os.path.join(out, f))
meta, names = {}, []
for g, imgs in raw.items():
    f = (tgt / float(np.mean([area(i) for i in imgs]))) ** 0.5
    scaled = [i.resize((max(1, round(i.width * f)), max(1, round(i.height * f))), Image.LANCZOS) for i in imgs]
    cxs = [cx(v) for v in scaled]
    half = max(max(c, v.width - c) for c, v in zip(cxs, scaled))
    cw = int(np.ceil(half * 2)) + 2; ch = max(v.height for v in scaled)
    for k, (v, c) in enumerate(zip(scaled, cxs)):
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(v, (int(round(cw / 2 - c)), ch - v.height))   # 발은 아래, 몸 무게중심은 가운데
        canvas.save(os.path.join(out, f'{g}{k}.webp'), 'WEBP', quality=90, method=6)
        meta[f'{g}{k}'] = {'w': cw, 'h': ch}; names.append(f'{g}{k}')
with open(os.path.join(ROOT, 'src/cats.gen.ts'), 'w') as fh:
    fh.write('// tools/process_cats.py 가 만든 파일이에요. 직접 고치지 마세요.\nexport const CAT_DIM: Record<string, { w: number; h: number }> = ' + json.dumps(meta, indent=1) + '\n'
             + 'export const CAT_COUNT: Record<string, number> = ' + json.dumps({g: len(i) for g, i in raw.items()}) + '\n')
mp = os.path.join(ROOT, 'public/assets/manifest.json')
m = [x for x in json.load(open(mp)) if not x.startswith('cats/')] + [f'cats/{n}.webp' for n in names]
json.dump(sorted(m), open(mp, 'w'))
print(len(names), 'frames', {g: (meta[g + '0']['w'], meta[g + '0']['h']) for g in raw})

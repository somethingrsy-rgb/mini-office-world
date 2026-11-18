"""고양이 그림(tools/src_art/cats.png, 4x2 격자의 8자세)을 잘라 public/assets/cats/*.webp 와 src/cats.gen.ts 로 만들어요.
사용법: python3 tools/process_cats.py"""
import json, os
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSES = ['stand', 'walkA', 'walkB', 'sit', 'sleep', 'groom', 'aegyo1', 'aegyo2']
STAND_PX = 130  # 서 있는 모습의 높이(px). 모든 자세를 같은 배율로 줄여요.

im = Image.open(os.path.join(ROOT, 'tools/src_art/cats.png')).convert('RGBA')
W, H = im.size
cells = {}
for i, name in enumerate(POSES):
    r, c = divmod(i, 4)
    cell = im.crop((c * W // 4, r * H // 2, (c + 1) * W // 4, (r + 1) * H // 2))
    a = np.asarray(cell)[:, :, 3].astype(np.float32)
    hard = a > 40
    lab, n = ndi.label(hard)
    sizes = ndi.sum(hard, lab, range(1, n + 1))
    keep = np.isin(lab, [k + 1 for k, s in enumerate(sizes) if s >= 0.05 * sizes.max()])   # 큰 덩어리(고양이)만
    keep = ndi.binary_dilation(keep, iterations=5)                                           # 털 가장자리까지
    al = np.where(keep & (a >= 12), a, 0)                                                    # 번진 색 얼룩 제거
    rgba = Image.fromarray(np.dstack([np.asarray(cell)[:, :, :3], al.astype(np.uint8)]), 'RGBA')
    bb = rgba.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    cells[name] = rgba.crop(bb)

scale = STAND_PX / cells['stand'].height
out = os.path.join(ROOT, 'public/assets/cats')
os.makedirs(out, exist_ok=True)
meta = {}
for name, img in cells.items():
    sp = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    sp.save(os.path.join(out, f'{name}.webp'), 'WEBP', quality=90, method=6)
    meta[name] = {'w': sp.width, 'h': sp.height}
with open(os.path.join(ROOT, 'src/cats.gen.ts'), 'w') as f:
    f.write('// tools/process_cats.py 가 만든 파일이에요. 직접 고치지 마세요.\nexport const CAT_DIM = ' + json.dumps(meta, indent=1) + ' as const\n')
mp = os.path.join(ROOT, 'public/assets/manifest.json')
m = json.load(open(mp))
for name in POSES:
    p = f'cats/{name}.webp'
    if p not in m: m.append(p)
json.dump(sorted(m), open(mp, 'w'))
print(meta)

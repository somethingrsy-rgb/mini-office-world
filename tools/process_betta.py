"""베타 물고기 그림(tools/src_art/betta_swim.webp 4x5=20장, betta_flare.webp 4x3 두 덩어리=24장)을 잘라
desktop-betta/frames/*.webp 와 desktop-betta/dims.js(그림 크기·클릭 판정용 모양 지도)를 만들어요.
사용법: python3 tools/process_betta.py"""
import json, os
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta')
SWIM_W = 190            # 헤엄치는 베타의 가로 크기(px, 보통 크기)
MASK_COLS = 48


def extract(path, cols, rows, order):
    im = Image.open(path).convert('RGBA'); rgb = np.asarray(im)[:, :, :3]; a = np.asarray(im)[:, :, 3]; H, W = a.shape
    lab, n = ndi.label(a > 128); sizes = ndi.sum(a > 128, lab, range(1, n + 1))
    items = []
    for i in range(1, n + 1):
        if sizes[i - 1] < 4000: continue
        cy, cx = ndi.center_of_mass(lab == i)
        items.append((i, int(cy * rows / H), int(cx * cols / W)))
    assert len(items) == cols * rows, (path, len(items))
    items.sort(key=order)
    frames = []
    for i, r, c in items:
        m = ndi.binary_dilation(lab == i, iterations=3)
        al = np.where(m & (a >= 40), a, 0).astype(np.uint8)
        frames.append((Image.fromarray(np.dstack([rgb, al]), 'RGBA'), (r, c)))
    return frames, (W, H, cols, rows)


def to_sheet(frames, dims, scale):
    """칸 안의 위치를 지킨 채 같은 크기 판에 담고, 몸 무게중심이 판 가운데에 오게 맞춰요"""
    W, H, cols, rows = dims
    boxes, cents = [], []
    for im, (r, c) in frames:
        al = np.asarray(im.getchannel('A')); bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        ox, oy = c * W // cols, r * H // rows
        boxes.append((bb[0] - ox, bb[1] - oy, bb[2] - ox, bb[3] - oy))
        ys, xs = np.nonzero(al > 40); cents.append((xs.mean() - ox, ys.mean() - oy))
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    mx = float(np.mean([c[0] for c in cents])); my = float(np.mean([c[1] for c in cents]))
    hw = max(mx - x0, x1 - mx); hh = max(my - y0, y1 - my)
    cw, ch = int(np.ceil(hw * 2)) + 2, int(np.ceil(hh * 2)) + 2
    out = []
    for im, (r, c) in frames:
        ox, oy = c * W // cols, r * H // rows
        crop = im.crop((ox + int(x0), oy + int(y0), ox + int(x1) + 1, oy + int(y1) + 1))
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(crop, (int(round(cw / 2 - (mx - int(x0)))), int(round(ch / 2 - (my - int(y0))))))
        out.append(canvas.resize((max(1, round(cw * scale)), max(1, round(ch * scale))), Image.LANCZOS))
    return out


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    cols = MASK_COLS; rows = max(1, round(h * cols / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, cols + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(cols))
    return [cols, rows, '%x' % int(bits, 2), cols * rows]


swim, sd = extract(os.path.join(ROOT, 'tools/src_art/betta_swim.webp'), 4, 5, lambda t: (t[1], t[2]))
flare, fd = extract(os.path.join(ROOT, 'tools/src_art/betta_flare.webp'), 8, 3, lambda t: (t[2] // 4, t[1], t[2] % 4))   # 앞 덩어리 12장 → 뒤 덩어리 12장
# 그림마다 고양이처럼 크기가 달라서, 첫 장의 몸 면적이 같아지게 두 그림의 배율을 맞춰요
area = lambda im: float((np.asarray(im.getchannel('A')) > 128).sum())
s1 = SWIM_W / (max(b for b in [np.asarray(f[0].getchannel('A')).nonzero()[1].max() - np.asarray(f[0].getchannel('A')).nonzero()[1].min() for f in swim]))
s2 = s1 * (area(swim[0][0]) / area(flare[0][0])) ** 0.5
sw = to_sheet(swim, sd, s1); fl = to_sheet(flare, fd, s2)
os.makedirs(os.path.join(OUT, 'frames'), exist_ok=True)
for f in os.listdir(os.path.join(OUT, 'frames')): os.remove(os.path.join(OUT, 'frames', f))
dim, mask, count = {}, {}, {'swim': len(sw), 'flare': len(fl)}
for g, lst in (('swim', sw), ('flare', fl)):
    for k, im in enumerate(lst):
        im.save(os.path.join(OUT, 'frames', f'{g}{k}.webp'), 'WEBP', quality=90, method=6)
        dim[f'{g}{k}'] = {'w': im.width, 'h': im.height}; mask[f'{g}{k}'] = mask_of(im)
open(os.path.join(OUT, 'dims.js'), 'w').write('window.DIMS = ' + json.dumps({'dim': dim, 'count': count, 'mask': mask}, ensure_ascii=False) + '\n')
sw[0].save(os.path.join(OUT, 'icon.png'))
print('swim', sw[0].size, 'flare', fl[0].size, 'scales', round(s1, 3), round(s2, 3))

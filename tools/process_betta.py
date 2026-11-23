"""베타 물고기 그림 네 장(tools/src_art/betta_*.png)을 잘라 desktop-betta/frames/*.webp 와 dims.js 를 만들어요.
  betta_swim.png  4x4=16장  헤엄 순환 (몸 고정, 지느러미만 움직임)
  betta_turn.png  4x3=12장  방향 바꾸기 (오른쪽 → 정면 → 왼쪽)
  betta_flare.png 6x4=24장  꼬리 펼치기 (접힘 → 활짝 → 유지 → 접힘)
  betta_idle.png  4x2=8장   가만히 떠 있을 때의 살랑거림
눈(검은 점)을 기준점으로 맞춰서 프레임이 바뀌어도 몸이 튀지 않고, 네 그림 모두 같은 크기의 판 가운데에 눈이 오게 해요.
사용법: python3 tools/process_betta.py"""
import json, os
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta')
SHEETS = [('swim', 4, 4), ('turn', 4, 3), ('flare', 6, 4), ('idle', 4, 2)]
FISH_W = 200            # 헤엄 그림에서 물고기(지느러미 포함) 가로 크기 목표(px, 보통 크기)
MASK_COLS = 56


def extract(name, cols, rows):
    im = Image.open(os.path.join(ROOT, f'tools/src_art/betta_{name}.png')).convert('RGBA')
    rgb = np.asarray(im)[:, :, :3].astype(int); a = np.asarray(im)[:, :, 3]; H, W = a.shape
    lab, n = ndi.label(a > 128); sizes = ndi.sum(a > 128, lab, range(1, n + 1))
    items = []
    for i in range(1, n + 1):
        if sizes[i - 1] < 4000: continue          # 배경 얼룩(작은 덩어리) 제외
        cy, cx = ndi.center_of_mass(lab == i)
        items.append((min(rows - 1, int(cy * rows / H)), min(cols - 1, int(cx * cols / W)), i))
    assert len(items) == cols * rows, (name, len(items))
    items.sort()
    frames = []
    for r, c, i in items:
        body = lab == i
        m = ndi.binary_dilation(body, iterations=3)
        al = np.where(m & (a >= 40), a, 0).astype(np.uint8)
        # 눈: 몸 안의 아주 어두운 점들 중 큰 것들의 평균 위치
        dark = body & (rgb.max(axis=2) < 70)
        dl, dn = ndi.label(dark)
        if dn:
            ds = ndi.sum(dark, dl, range(1, dn + 1)); keep = [k + 1 for k, s in enumerate(ds) if s >= 0.4 * ds.max() and s >= 25]
            ys, xs = np.nonzero(np.isin(dl, keep)); eye = (xs.mean(), ys.mean())
        else:
            ys, xs = np.nonzero(body); eye = (xs.mean(), ys.mean())
        pink = body & (rgb[:, :, 0] > 200) & (rgb[:, :, 0] - rgb[:, :, 1] > 45)
        ys2, xs2 = np.nonzero(body); bb = (xs2.min(), ys2.min(), xs2.max() + 1, ys2.max() + 1)
        frames.append({'img': Image.fromarray(np.dstack([rgb.astype(np.uint8), al]), 'RGBA'), 'eye': eye, 'bbox': bb, 'pink': int(pink.sum()), 'area': int(body.sum())})
    return frames


raw = {n: extract(n, c, r) for n, c, r in SHEETS}
# 몸 크기를 맞춰요: 그림마다 고양이처럼 그려진 크기가 달라서, 오른쪽을 보는 처음 몇 장의 분홍 몸(머리·몸통) 넓이가 헤엄 그림과 같아지게 배율을 정해요
ref_n = {'swim': 16, 'turn': 3, 'flare': 2, 'idle': 8}
pink_ref = float(np.median([f['pink'] for f in raw['swim']]))
swim_w = float(np.median([f['bbox'][2] - f['bbox'][0] for f in raw['swim']]))
s0 = FISH_W / swim_w
scale = {n: s0 * (pink_ref / float(np.median([f['pink'] for f in raw[n][:ref_n[n]]]))) ** 0.5 for n in raw}

# 눈을 기준으로 한 모든 프레임의 가장 큰 범위 → 모든 그림이 같은 크기의 판을 써요 (좌우로 뒤집어도 몸이 제자리)
hw = hh = 0
for n, lst in raw.items():
    for f in lst:
        ex, ey = f['eye']; b = f['bbox']; s = scale[n]
        hw = max(hw, (ex - b[0]) * s, (b[2] - ex) * s); hh = max(hh, (ey - b[1]) * s, (b[3] - ey) * s)
CW, CH = int(np.ceil(hw)) * 2 + 4, int(np.ceil(hh)) * 2 + 4


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    cols = MASK_COLS; rows = max(1, round(h * cols / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, cols + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(cols))
    return [cols, rows, '%x' % int(bits, 2), cols * rows]


os.makedirs(os.path.join(OUT, 'frames'), exist_ok=True)
for f in os.listdir(os.path.join(OUT, 'frames')): os.remove(os.path.join(OUT, 'frames', f))
dim, mask, count = {}, {}, {}
for n, lst in raw.items():
    count[n] = len(lst); s = scale[n]
    for k, f in enumerate(lst):
        b = f['bbox']; crop = f['img'].crop(b)
        crop = crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.LANCZOS)
        ex, ey = (f['eye'][0] - b[0]) * s, (f['eye'][1] - b[1]) * s
        canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        canvas.alpha_composite(crop, (int(round(CW / 2 - ex)), int(round(CH / 2 - ey))))
        canvas.save(os.path.join(OUT, 'frames', f'{n}{k}.webp'), 'WEBP', quality=90, method=6)
        dim[f'{n}{k}'] = {'w': CW, 'h': CH}; mask[f'{n}{k}'] = mask_of(canvas)
open(os.path.join(OUT, 'dims.js'), 'w').write('window.DIMS = ' + json.dumps({'dim': dim, 'count': count, 'mask': mask}, ensure_ascii=False) + '\n')
ic = Image.open(os.path.join(OUT, 'frames', 'swim0.webp')); ic = ic.crop(ic.getchannel('A').getbbox())
k = 440 / max(ic.size); ic = ic.resize((round(ic.width * k), round(ic.height * k)), Image.LANCZOS)
icon = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); icon.alpha_composite(ic, ((512 - ic.width) // 2, (512 - ic.height) // 2)); icon.save(os.path.join(OUT, 'icon.png'))
print('판 크기', CW, CH, '배율', {n: round(v, 3) for n, v in scale.items()}, '장수', count)

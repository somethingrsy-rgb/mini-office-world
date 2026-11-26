"""눈 내리는 오르골(desktop-snowglobe) 그림 만들기.
원본(tools/src_art/snowglobe_*.png)  →  desktop-snowglobe/art/ (불꺼짐 off.webp, 불켜짐 on.webp, 눈 snow_off.png, snow_on.png, geom.js/json) + icon.png
 - 오르골 두 장은 같은 영역으로 잘라서(위치가 어긋나지 않게) 작게 줄이고, 구슬·받침 바깥에 떨어진 부스러기는 지워요
 - 눈 그림은 연두색 배경(#00FF00)을 투명으로 바꿔요 (위아래·좌우로 이어 붙여도 티가 안 나는 그림)
사용: python3 tools/process_snowglobe.py
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'src_art')
OUT = os.path.join(ROOT, 'desktop-snowglobe', 'art')
os.makedirs(OUT, exist_ok=True)
W = 700   # 저장하는 가로 크기(px). 화면에서는 이보다 작게 보여요


def load(n): return Image.open(os.path.join(SRC, n)).convert('RGBA')


def clean_specks(im, min_area=1500):
    """오르골 본체와 떨어진 작은 부스러기(배경 제거 때 남은 점들)를 지워요."""
    a = np.array(im)
    lab, n = ndi.label(a[:, :, 3] > 6, structure=np.ones((3, 3)))
    if n == 0: return im
    area = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    drop = np.isin(lab, [i + 1 for i, s in enumerate(area) if s < min_area])
    a[drop, 3] = 0
    return Image.fromarray(a)


off, on = clean_specks(load('snowglobe_off.png')), clean_specks(load('snowglobe_on.png'))
bb = None
for im in (off, on):
    b = Image.fromarray(np.array(im)[:, :, 3]).point(lambda v: 255 if v > 6 else 0).getbbox()
    bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
pad = 4
bb = (bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad)
s = W / (bb[2] - bb[0]); H = round((bb[3] - bb[1]) * s)
for n, im in (('off', off), ('on', on)):
    c = im.crop(bb).resize((W, H), Image.LANCZOS)
    c.save(os.path.join(OUT, n + '.webp'), quality=94, method=6)

# 구슬 모양(눈이 보일 영역): 불켜짐 그림에서 유리 안쪽이 불투명하게 채워져 있어서 거기서 원을 맞춰요
a = np.array(on.crop(bb).resize((W, H), Image.LANCZOS))[:, :, 3]
top = np.where(a.max(axis=1) > 128)[0][0]
xs = np.where(a[int(top + 0.45 * W)] > 128)[0]     # 구슬 가운데쯤 높이의 좌우 끝
cx = (xs[0] + xs[-1]) / 2; r = (xs[-1] - xs[0]) / 2
cy = top + r
# 누를 수 있는 곳(눌림 판정용 격자): 오르골 그림이 있는 칸은 1. 여백(PAD)을 포함한 전체 화면 기준이고, 윈도우에서 그림을 읽지 않고도 판정할 수 있게 미리 만들어 둬요
PAD = 42; CW, CH = W + 2 * PAD, H + 2 * PAD; GW = 96; GH = round(GW * CH / CW)
full = Image.new('RGBA', (CW, CH)); full.paste(Image.open(os.path.join(OUT, 'off.webp')).convert('RGBA'), (PAD, PAD))
ga = np.array(full.resize((GW, GH), Image.BOX))[:, :, 3] > 24
grid = [''.join('1' if v else '0' for v in row) for row in ga]
geom = {'w': W, 'h': H, 'cx': round(float(cx), 1), 'cy': round(float(cy), 1), 'r': round(float(r * 0.965), 1), 'floorY': round(float(cy + r * 0.72), 1), 'mask': grid}
open(os.path.join(OUT, 'geom.js'), 'w').write('window.GLOBE = ' + json.dumps(geom) + '\n')   # 화면(renderer)용
open(os.path.join(OUT, 'geom.json'), 'w').write(json.dumps(geom) + '\n')   # 창 크기 계산(main)용
print('오르골', W, 'x', H, geom)

# 앱 아이콘 (정사각형)
ic = Image.open(os.path.join(OUT, 'on.webp')).convert('RGBA'); sq = Image.new('RGBA', (H, H)); sq.paste(ic, ((H - W) // 2, 0))
sq.resize((512, 512), Image.LANCZOS).save(os.path.join(ROOT, 'desktop-snowglobe', 'icon.png'))

# 눈: 연두색 배경 → 투명 (눈알갱이 색이 연두와 섞인 가장자리는 알파를 계산해서 색을 되살려요)
for n in ('snow_off', 'snow_on'):
    rgb = np.array(Image.open(os.path.join(SRC, f'snowglobe_{n}.png')).convert('RGB')).astype(np.float32)
    r_, g_, b_ = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    alpha = np.clip(np.maximum(r_, b_) / 235.0, 0, 1)
    k = np.maximum(alpha, 1e-3)[:, :, None]
    col = rgb.copy(); col[:, :, 1] = g_ - (1 - alpha) * 255
    col = np.clip(col / k, 0, 255)
    alpha[alpha < 0.04] = 0
    out = np.dstack([col, alpha * 255]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(os.path.join(OUT, n + '.png'), optimize=True)
    print(n, 'alpha>0 비율', round(float((alpha > 0).mean()) * 100, 2), '%')

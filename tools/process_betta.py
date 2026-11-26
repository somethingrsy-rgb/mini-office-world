"""베타 물고기 그림 네 장(tools/src_art/betta_*.png)을 잘라 desktop-betta/frames/*.webp 와 dims.js 를 만들어요.
  betta_swim.png  4x4=16장  헤엄 순환 (몸 고정, 지느러미만 움직임)
  betta_turn.png  4x3=12장  방향 바꾸기 (오른쪽 → 정면 → 왼쪽)
  betta_flare.png 6x4=24장  꼬리 펼치기 (접힘 → 활짝 → 유지 → 접힘)
  betta_idle.png  4x2=8장   가만히 떠 있을 때의 살랑거림
눈(검은 점)을 기준점으로 맞춰서 프레임이 바뀌어도 몸이 튀지 않고, 네 그림 모두 같은 크기의 판 가운데에 눈이 오게 해요.
사용법: python3 tools/process_betta.py [orange|purple|yellow]   (인자 없으면 분홍 베타, orange면 주황 베타: tools/src_art/betta_o_*.png → 프레임 이름 앞에 o_)"""
import json, os, sys, re
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta')
PRE = {'orange': 'o_', 'purple': 'p_', 'yellow': 'y_'}.get(sys.argv[1] if sys.argv[1:] else '', '')   # 주황 베타는 그림 이름 앞에 o_ 가 붙어요
SHEETS = [('swim', 4, 4), ('turn', 4, 3), ('flare', 6, 4), ('idle', 4, 2)]
if PRE == 'y_': SHEETS.append(('swim2', 4, 4))   # 노랑(연파랑·분홍) 베타: 위·아래로 갈 때 쓰는 헤엄 그림 한 벌이 더 있어요
FISH_W = 200            # 헤엄 그림에서 물고기(지느러미 포함) 가로 크기 목표(px, 보통 크기)
MASK_COLS = 56


def extract(name, cols, rows):
    im = Image.open(os.path.join(ROOT, f'tools/src_art/betta_{PRE}{name}.png')).convert('RGBA')
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
    for fi_, (r, c, i) in enumerate(items):
        body = lab == i
        m = ndi.binary_dilation(body, iterations=3)
        al = np.where(m & (a >= 40), a, 0).astype(np.uint8)
        # 눈: 몸 안의 아주 어두운 점들 중 큰 것들의 평균 위치
        dark = body & (rgb.max(axis=2) < 70)
        dl, dn = ndi.label(dark)
        en = None
        if dn and PRE == 'p_':   # 보라 베타: 어두운 점 중 가장 큰 덩어리가 눈이에요 (턱 밑 검은 선은 더 작아요). 눈에서 코끝까지의 거리도 재요
            ds = ndi.sum(dark, dl, range(1, dn + 1)); j = int(np.argmax(ds)) + 1
            # 눈은 머리에서 가장 위에 있는 어두운 점이에요. 가장 큰 점은 아가미·턱 밑 선일 수 있어서 크기로 고르지 않아요
            # (오른쪽을 볼 때는 몸의 오른쪽 끝 쪽, 왼쪽을 볼 때는 왼쪽 끝 쪽, 정면일 때는 가운데 쪽 두 점의 가운데)
            ys_b, xs_b = np.nonzero(body); xl, xr = xs_b.min(), xs_b.max(); wd = xr - xl
            look = 'R'
            if name == 'turn':
                look = 'R' if fi_ < 4 else 'F' if fi_ < 8 else 'L'
            cands = []
            for kk in range(1, dn + 1):
                if ds[kk - 1] < max(20, 0.15 * ds.max()): continue
                cy_k, cx_k = ndi.center_of_mass(dl == kk)
                if look == 'R' and cx_k < xl + 0.55 * wd: continue
                if look == 'L' and cx_k > xl + 0.45 * wd: continue
                if look == 'F' and not (xl + 0.2 * wd < cx_k < xl + 0.8 * wd): continue
                cands.append((cy_k, cx_k, kk))
            cands.sort()
            if look == 'F' and len(cands) >= 2:
                eye = ((cands[0][1] + cands[1][1]) / 2, (cands[0][0] + cands[1][0]) / 2); j = cands[0][2]
                ys, xs = np.nonzero(dl == j)
            else:
                j = cands[0][2] if cands else j
                ys, xs = np.nonzero(dl == j); eye = (xs.mean(), ys.mean())
        elif dn:
            ds = ndi.sum(dark, dl, range(1, dn + 1)); keep = [k + 1 for k, s in enumerate(ds) if s >= 0.4 * ds.max() and s >= 25]
            ys, xs = np.nonzero(np.isin(dl, keep)); eye = (xs.mean(), ys.mean())
        else:
            ys, xs = np.nonzero(body); eye = (xs.mean(), ys.mean())
        pink = body & (rgb[:, :, 0] > 200) & (rgb[:, :, 0] - rgb[:, :, 1] > 45)
        ys2, xs2 = np.nonzero(body); bb = (xs2.min(), ys2.min(), xs2.max() + 1, ys2.max() + 1)
        frames.append({'img': Image.fromarray(np.dstack([rgb.astype(np.uint8), al]), 'RGBA'), 'eye': eye, 'bbox': bb, 'pink': int(pink.sum()), 'area': int(body.sum()), 'en': en})
    return frames


raw = {n: extract(n, c, r) for n, c, r in SHEETS}
# 몸 크기를 맞춰요: 그림마다 고양이처럼 그려진 크기가 달라서, 오른쪽을 보는 처음 몇 장의 분홍 몸(머리·몸통) 넓이가 헤엄 그림과 같아지게 배율을 정해요
ref_n = {'swim': 16, 'turn': 3, 'flare': 2, 'idle': 8, 'swim2': 16}
K = 'area' if PRE == 'p_' else 'pink'   # 보라 베타는 몸이 흰빛이라 분홍 픽셀로 크기를 못 재서, 전체 넓이로 재요
pink_ref = float(np.median([f[K] for f in raw['swim']]))
swim_w = float(np.median([f['bbox'][2] - f['bbox'][0] for f in raw['swim']]))
s0 = FISH_W / swim_w
scale = {n: s0 * (pink_ref / float(np.median([f[K] for f in raw[n][:ref_n[n]]]))) ** 0.5 for n in raw}

fscale = {n: [scale[n]] * len(lst) for n, lst in raw.items()}
# 보라 베타도 그림마다 몸 전체 넓이(지느러미 포함, 편안한 자세 기준)로 크기를 맞춰요. 머리만 맞추면 쉬기·돌기에서 몸이 훨씬 커 보였어요.

# 눈을 기준으로 한 모든 프레임의 가장 큰 범위 → 모든 그림이 같은 크기의 판을 써요 (좌우로 뒤집어도 몸이 제자리)
hw = hh = 0
for n, lst in raw.items():
    for fi, f in enumerate(lst):
        ex, ey = f['eye']; b = f['bbox']; s = fscale[n][fi]
        hw = max(hw, (ex - b[0]) * s, (b[2] - ex) * s); hh = max(hh, (ey - b[1]) * s, (b[3] - ey) * s)
CW, CH = int(np.ceil(hw * 1.12)) * 2 + 8, int(np.ceil(hh * 1.12)) * 2 + 8   # 머리 크기·위치 보정으로 커질 몫까지 여유를 둬요 (안 그러면 가장자리가 잘려요)


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    cols = MASK_COLS; rows = max(1, round(h * cols / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, cols + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(cols))
    return [cols, rows, '%x' % int(bits, 2), cols * rows]


canv = {}
for n, lst in raw.items():
    for k, f in enumerate(lst):
        s = fscale[n][k]
        b = f['bbox']; crop = f['img'].crop(b)
        crop = crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.LANCZOS)
        ex, ey = (f['eye'][0] - b[0]) * s, (f['eye'][1] - b[1]) * s
        canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        canvas.alpha_composite(crop, (int(round(CW / 2 - ex)), int(round(CH / 2 - ey))))
        canv[(n, k)] = canvas


# ── 머리 모양으로 한 번 더 맞춰요: 눈 점 하나만으로는 프레임마다 몇 px씩 흔들려서 '지진 난 것처럼' 보여서,
#    기준 프레임(swim0)의 머리·앞몸통 모양과 가장 잘 겹치는 위치로 미세하게 옮겨요 ──
def feat(img, roi):
    a = np.asarray(img.crop(roi)).astype(float); al = a[:, :, 3] > 128
    pinkness = np.clip(a[:, :, 0] - a[:, :, 1], 0, 80); dark = np.clip(170 - a[:, :, :3].max(axis=2), 0, 120) * 0.7
    return np.where(al, pinkness + dark, 0.0)


def best_shift(ref, img, rad=12):
    f1 = ref - ref.mean(); f2 = img - img.mean()
    h, w = ref.shape
    corr = np.fft.irfft2(np.fft.rfft2(f1, s=(2 * h, 2 * w)) * np.conj(np.fft.rfft2(f2, s=(2 * h, 2 * w))), s=(2 * h, 2 * w))
    sub_c = corr[np.arange(-rad, rad + 1)[:, None] % (2 * h), np.arange(-rad, rad + 1)[None, :] % (2 * w)]
    iy, ix = np.unravel_index(np.argmax(sub_c), sub_c.shape); dy, dx = iy - rad, ix - rad; score = float(sub_c[iy, ix]) / (np.linalg.norm(f1) * np.linalg.norm(f2) + 1e-9)
    def sub(c0, c1, c2): d = c0 - 2 * c1 + c2; return 0.0 if abs(d) < 1e-9 else 0.5 * (c0 - c2) / d
    cx = lambda x, y: corr[y % (2 * h), x % (2 * w)]
    return dx + sub(cx(dx - 1, dy), cx(dx, dy), cx(dx + 1, dy)), dy + sub(cx(dx, dy - 1), cx(dx, dy), cx(dx, dy + 1)), score


def scaled(im, k):
    """눈 자리(판 가운데)를 중심으로 k배 키우거나 줄여요"""
    cx, cy = CW / 2, CH / 2
    return im.transform(im.size, Image.AFFINE, (1 / k, 0, cx - cx / k, 0, 1 / k, cy - cy / k), resample=Image.BICUBIC)


from PIL import ImageOps
ROI = (CW // 2 - 80, CH // 2 - 62, CW // 2 + 60, CH // 2 + 62)   # 눈에서 몸 쪽(왼쪽)으로 조금 더 넓게
ROI_M = (CW - ROI[2], ROI[1], CW - ROI[0], ROI[3])               # 거울에 비친 구역
ref = feat(canv[('swim', 0)], ROI); refm = feat(ImageOps.mirror(canv[('swim', 0)]), ROI_M)
shifts, ks = {}, {}
for (n, k), im in list(canv.items()):
    if PRE == 'p_': continue                                    # 보라 베타: 눈 기준 + 눈~코끝 배율만 써요 (머리 모양 맞춤은 흰 몸에서 오히려 흔들려요)
    if n == 'turn' and 4 <= k <= 7: continue                    # 몸이 정면·옆을 향한 장면은 모양이 달라서 눈 위치만 믿어요
    left = n == 'turn' and k >= 8                               # 왼쪽을 보는 장면은 거울 상과 맞춰요
    best = None
    for kk in [0.80 + 0.02 * i for i in range(24)]:             # 머리 크기도 맞춰요 (그림마다 몸이 조금씩 커졌다 작아져서 크기가 막 바뀌어 보였어요)
        dx, dy, sc = best_shift(refm if left else ref, feat(scaled(im, kk), ROI_M if left else ROI))
        if best is None or sc > best[0]: best = (sc, kk, dx, dy)
    sc, kk, dx, dy = best
    if PRE == 'p_': dx = dy = 0.0                               # 보라 베타: 머리 크기만 맞추고 위치는 눈 기준 그대로 (머리 모양 맞춤으로 옮기면 오히려 흔들려요)
    shifts[(n, k)] = (round(dx, 1), round(dy, 1)); ks[(n, k)] = kk
    out = scaled(im, kk)
    canv[(n, k)] = out.transform(out.size, Image.AFFINE, (1, 0, -dx, 0, 1, -dy), resample=Image.BICUBIC)
print('머리 크기 보정 범위:', (round(min(ks.values()), 2), round(max(ks.values()), 2)) if ks else '없음(눈 위치로만 맞춤)')

os.makedirs(os.path.join(OUT, 'frames'), exist_ok=True)
mine = re.compile(rf'^{PRE}(swim2|swim|turn|flare|idle)\d+\.webp$' if PRE else r'^(swim|turn|flare|idle)\d+\.webp$')
for f in os.listdir(os.path.join(OUT, 'frames')):
    if mine.match(f): os.remove(os.path.join(OUT, 'frames', f))
dims_path = os.path.join(OUT, 'dims.js')
old = json.loads(open(dims_path).read().split('=', 1)[1]) if os.path.exists(dims_path) else {'dim': {}, 'count': {}, 'mask': {}}
for sec in old.values():
    for k in [k for k in sec if (k.startswith(PRE) if PRE else not k.startswith(('o_', 'p_')))]: del sec[k]
dim, mask, count = old['dim'], old['mask'], old['count']
for n, l in raw.items(): count[PRE + n] = len(l)
for (n, k), canvas in canv.items():
    canvas.save(os.path.join(OUT, 'frames', f'{PRE}{n}{k}.webp'), 'WEBP', quality=90, method=6)
    dim[f'{PRE}{n}{k}'] = {'w': CW, 'h': CH}; mask[f'{PRE}{n}{k}'] = mask_of(canvas)
open(dims_path, 'w').write('window.DIMS = ' + json.dumps({'dim': dim, 'count': count, 'mask': mask}, ensure_ascii=False) + '\n')
if PRE: sys.exit(print('판 크기', CW, CH, '배율', {n: round(v, 3) for n, v in scale.items()}))
ic = Image.open(os.path.join(OUT, 'frames', 'swim0.webp')); ic = ic.crop(ic.getchannel('A').getbbox())
k = 440 / max(ic.size); ic = ic.resize((round(ic.width * k), round(ic.height * k)), Image.LANCZOS)
icon = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); icon.alpha_composite(ic, ((512 - ic.width) // 2, (512 - ic.height) // 2)); icon.save(os.path.join(OUT, 'icon.png'))
print('판 크기', CW, CH, '배율', {n: round(v, 3) for n, v in scale.items()}, '장수', count)

"""새 구피(하얀 몸·파란 꼬리) 헤엄 그림 한 장(tools/src_art/guppy2_swim.png, 한 줄 16장)을 잘라 desktop-betta/frames/g2_*.webp 로 만들고 dims.js 에 더해요.
  g2_swim, g2_idle : 꼬리가 크게 휘지 않는 장면들만 골라 부드럽게 이어지는 순서로 써요 (꼬리가 크게 휘면 몸이 오뚜기처럼 위아래로 흔들려 보여요)
  g2_turn, g2_flare: 기존 구피(g_)의 돌기·펼치기 그림을 그대로 써요 (같은 크기의 판이라 바뀔 때 튀지 않아요)
크기·무게중심은 기존 구피에 맞춰요: 판 300x190, 물고기 길이 약 192px(기존 200px, 몸·꼬리가 풍성한 만큼 4% 줄임), 장면마다 몸 무게중심 높이를 같게.
사용법: python3 tools/process_guppy2.py   (다른 물고기 그림은 건드리지 않아요. 기존 구피 그림 g_* 가 먼저 있어야 해요)"""
import itertools, json, os, shutil
import numpy as np
from PIL import Image, ImageOps
import scipy.ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta'); FR = os.path.join(OUT, 'frames')
MASK_COLS = 56; CW, CH = 300, 190; TARGET_W, CX, CY = 200.0, 128.5, 95.0
D = json.loads(open(os.path.join(OUT, 'dims.js')).read().split('=', 1)[1])
for k in [k for k in D['dim'] if k.startswith('g2_')]: D['dim'].pop(k); D['mask'].pop(k)
for f in os.listdir(FR):
    if f.startswith('g2_'): os.remove(os.path.join(FR, f))


def stats(im):
    a = np.asarray(im)[:, :, 3] > 128; ys, xs = np.nonzero(a)
    return float(xs.max() - xs.min() + 1), xs.mean(), ys.mean()


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    rows = max(1, round(h * MASK_COLS / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, MASK_COLS + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(MASK_COLS))
    return [MASK_COLS, rows, '%x' % int(bits, 2), MASK_COLS * rows]


# 1) 한 줄 시트에서 물고기 16마리를 왼쪽부터 차례로 잘라요 (칸 폭이 정수가 아니라서 덩어리로 찾아요)
sheet = Image.open(os.path.join(ROOT, 'tools/src_art/guppy2_swim.png')).convert('RGBA')
a = np.asarray(sheet)[:, :, 3] > 128
lab, n = ndi.label(ndi.binary_dilation(a, iterations=6)); assert n == 16, f'물고기 덩어리가 {n}개예요 (16개여야 해요)'
boxes = sorted(ndi.find_objects(lab), key=lambda s: s[1].start)
cells = []
for sl in boxes:   # 구피 그림은 머리가 왼쪽을 보고 있어서 모두 좌우를 뒤집어 오른쪽을 보게 해요 (다른 물고기와 같은 규칙)
    m = np.zeros(a.shape, bool); m[sl] = a[sl]
    c = np.array(sheet); c[~(ndi.binary_dilation(m, iterations=2))] = 0
    cells.append(ImageOps.mirror(Image.fromarray(c).crop((sl[1].start - 3, sl[0].start - 3, sl[1].stop + 3, sl[0].stop + 3))))

# 2) 편안한 자세의 길이로 크기를 맞춰요 (기존 구피와 같은 기준: 모든 장면 길이의 중앙값 → 200px)
# 새 구피는 몸·꼬리가 기존 구피보다 풍성해서(같은 길이일 때 전체 넓이가 약 18% 커요) 길이를 그대로 맞추면 더 커 보여요. 길이 기준과 넓이 기준의 가운데로 맞춰요(길이 4% 줄임)
FIT = 0.96
length = float(np.median([stats(c)[0] for c in cells])); b = TARGET_W * FIT / length


HEAD = 0.22   # 머리 쪽 22%


def head_pos(im):   # 코끝 x, 머리 부분 무게중심 y
    al = np.asarray(im.getchannel('A')) > 128; ys, xs = np.nonzero(al); snout = xs.max(); L = snout - xs.min()
    sel = al.copy(); sel[:, :int(snout - HEAD * L)] = False; hy, _ = np.nonzero(sel)
    return float(snout), float(hy.mean())


# 기존 구피의 헤엄 그림에서 코끝과 머리 높이를 읽어서, 새 구피도 같은 자리에 오게 해요 (헤엄에서 돌기로 바뀔 때 머리가 튀지 않게)
old = [head_pos(Image.open(os.path.join(FR, f'g_swim{i}.webp')).convert('RGBA')) for i in range(D['count']['g_swim'])]
SNOUT, HEADY = float(np.median([o[0] for o in old])), float(np.median([o[1] for o in old]))


def place(c):   # 머리(코끝 x·머리 높이)를 기준으로 놓아요: 꼬리가 크게 움직이는 그림은 몸 전체 무게중심으로 맞추면 머리가 따라 움직여서 울렁거려 보여요
    r = c.resize((round(c.width * b), round(c.height * b)), Image.LANCZOS); sx, hy = head_pos(r)
    f = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); f.alpha_composite(r, (round(SNOUT - sx), round(HEADY - hy))); return f


full = [place(c) for c in cells]
A = [np.asarray(f.getchannel('A')).astype(float) / 255 for f in full]
diff = lambda i, j: float(np.abs(A[i] - A[j]).sum() / max(1.0, A[i].sum()))   # 두 장면이 얼마나 다른가 (겹치지 않는 넓이 비율)
# 3) 서로 가장 비슷한 K장을 골라요: 꼬리가 크게 휘는 장면을 섞으면 앞뒤 장면이 많이 달라 몸이 울렁거려 보여요 (기존 구피 12장 사이 최대 차이는 0.067)
K = 5
low = list(min(itertools.combinations(range(16), K), key=lambda s: max(diff(i, j) for i in s for j in s)))
print('고른 장면', low, '| 서로 가장 다른 쌍 %.3f' % max(diff(i, j) for i in low for j in low))


# 4) 고른 장면을 이웃끼리 모양이 가장 비슷하게 이어지는 순서로 늘어놓고, 앞뒤로 오가요 (끝에서 처음으로 튀지 않게)
best = min(itertools.permutations(low), key=lambda p: sum(diff(p[k], p[k + 1]) for k in range(len(p) - 1)))
seq = list(best) + list(best[-2:0:-1])
print('순서', seq, '| 이웃 장면 사이 변화 최대 %.3f' % max(diff(seq[k], seq[(k + 1) % len(seq)]) for k in range(len(seq))))
for fam in ('swim', 'idle'):
    D['count'][f'g2_{fam}'] = len(seq)
    for k, i in enumerate(seq):
        full[i].save(os.path.join(FR, f'g2_{fam}{k}.webp'), 'WEBP', quality=90, method=6)
        D['dim'][f'g2_{fam}{k}'] = {'w': CW, 'h': CH}; D['mask'][f'g2_{fam}{k}'] = mask_of(full[i])
# 5) 돌기·펼치기는 기존 구피 것을 그대로 써요
for fam in ('turn', 'flare'):
    cnt = D['count'][f'g_{fam}']; D['count'][f'g2_{fam}'] = cnt
    for k in range(cnt):
        shutil.copy(os.path.join(FR, f'g_{fam}{k}.webp'), os.path.join(FR, f'g2_{fam}{k}.webp'))
        D['dim'][f'g2_{fam}{k}'] = dict(D['dim'][f'g_{fam}{k}']); D['mask'][f'g2_{fam}{k}'] = D['mask'][f'g_{fam}{k}']
if 'g_turn' in D.get('pace', {}): D['pace']['g2_turn'] = list(D['pace']['g_turn'])
open(os.path.join(OUT, 'dims.js'), 'w').write('window.DIMS = ' + json.dumps(D, ensure_ascii=False) + '\n')
print('새 구피 프레임: 헤엄·쉬기 각', len(seq), '장 + 돌기', D['count']['g2_turn'], '+ 펼치기', D['count']['g2_flare'], '| 배율', round(b, 3))

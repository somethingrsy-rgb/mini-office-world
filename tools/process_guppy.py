"""구피(파란 꼬리 구피) 그림 네 장(tools/src_art/guppy_*.png, 한 줄짜리 시트: 칸 크기는 시트 크기 ÷ 장수)을 잘라 desktop-betta/frames/g_*.webp 로 만들고 dims.js 에 더해요.
  guppy_swim.png   16장  헤엄(몸은 수평, 꼬리·지느러미만 살짝 움직임)  → g_swim
  guppy_turn.png   16장  방향 바꾸기(오른쪽 → 정면 → 왼쪽) → g_turn
  (쉬기 g_idle 은 guppy_swim.png 를 그대로 써요)
  guppy_flare.png  12장  등지느러미·꼬리를 펼치며 몸을 휘는 동작(더블클릭·가끔 저절로) → g_flare
그림마다 몸 넓이·무게중심을 같게 맞춰서(동작이 바뀔 때 커졌다 작아지거나 튀지 않게) 같은 크기의 판에 놓아요. 그림 하나 안의 움직임은 그대로예요.
사용법: python3 tools/process_guppy.py   (다른 베타 프레임은 건드리지 않아요)"""
import json, os
import numpy as np
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'desktop-betta'); FR = os.path.join(OUT, 'frames')
SHEETS = [('swim', 'swim', 16), ('idle', 'swim', 16), ('flare', 'flare', 16), ('turn', 'turn', 16)]   # 쉬기는 헤엄 그림을 그대로 써요: 멈췄다 출발할 때 그림이 달라 튀는 일이 없어요
MASK_COLS = 56
CW, CH = 300, 190            # 판 크기 (구피는 꼬리가 커서 세로를 조금 더 길게)
TARGET_W, CX, CY = 200.0, 128.5, 95.0   # 모든 그림의 편안한 자세 물고기 길이(코끝~꼬리 끝, px)·무게중심
D = json.loads(open(os.path.join(OUT, 'dims.js')).read().split('=', 1)[1])
for k in [k for k in D['dim'] if k.startswith('g_')]: D['dim'].pop(k); D['mask'].pop(k)
for f in os.listdir(FR):
    if f.startswith('g_'): os.remove(os.path.join(FR, f))


def stats(cell):
    a = np.asarray(cell)[:, :, 3] > 128; ys, xs = np.nonzero(a)
    return float(xs.max() - xs.min() + 1), xs.mean(), ys.mean()   # (물고기 길이, 무게중심 x, y)


def cells(src, n):
    im = Image.open(os.path.join(ROOT, f'tools/src_art/guppy_{src}.png')).convert('RGBA')
    w = im.width // n
    # 구피 그림은 머리가 왼쪽을 보고 있어서, 모두 좌우를 뒤집어 오른쪽을 보게 해요 (다른 물고기와 같은 규칙)
    return [ImageOps.mirror(im.crop((i * w, 0, (i + 1) * w, im.height))) for i in range(n)]


def mask_of(img):
    a = np.asarray(img.getchannel('A')) > 40; h, w = a.shape
    rows = max(1, round(h * MASK_COLS / w))
    ys = np.linspace(0, h, rows + 1).astype(int); xs = np.linspace(0, w, MASK_COLS + 1).astype(int)
    bits = ''.join('1' if a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].any() else '0' for r in range(rows) for c in range(MASK_COLS))
    return [MASK_COLS, rows, '%x' % int(bits, 2), MASK_COLS * rows]


REF = {'swim': None, 'idle': None, 'flare': 2, 'turn': 2}   # 편안한 자세로 재는 장수 (돌기·펼치기는 처음 2장)
for fam, src, n in SHEETS:
    cs = cells(src, n)
    # 편안한 자세(옆모습) 장들의 물고기 길이가 모든 그림에서 같아지게 크기를 맞춰요 (돌기·펼치기는 처음 2장과 끝 2장)
    ref_cells = cs if REF[fam] is None else cs[:REF[fam]] + cs[-REF[fam]:]
    st = [stats(c) for c in ref_cells]
    length, cx, cy = (float(np.median([x[k] for x in st])) for k in range(3))
    b = TARGET_W / length
    D['count'][f'g_{fam}'] = n
    rs = [c.resize((round(c.width * b), round(c.height * b)), Image.LANCZOS) for c in cs]
    txs = [stats(r)[1] for r in rs]
    for i, c in enumerate(cs):
        f = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        r = rs[i]
        ox, oy = CX - cx * b, CY - cy * b
        if fam in ('swim', 'idle'):   # 구피는 꼬리가 크고 무거워서 꼬리가 아래로 휘면 몸 전체가 오뚜기처럼 위아래로 흔들려 보였어요. 프레임마다 몸 전체의 무게중심 높이를 같게 맞춰서, 꼬리는 움직이되 몸이 시소처럼 흔들리지 않게 해요
            oy = CY - stats(r)[2]
        if fam == 'turn':   # 돌기: 몸 모양이 바뀌면서 무게중심이 위아래로 흔들려 튀었어요. 가로는 시작 자리에서 끝 자리(좌우 반대)로 부드럽게, 세로는 항상 같은 높이에 두어요
            _, tx, ty = stats(r)
            t = i / (len(rs) - 1); want_x = CX + (CW - CX - CX) * (t * t * (3 - 2 * t))
            ox, oy = want_x - tx, CY - ty
        if fam == 'flare':   # 펼치기 그림은 찍히는 동안 몸이 앞으로 쭉 밀려 나가요(끝 장면이 처음보다 약 10px 앞). 그대로 쓰면 끝나고 헤엄 그림으로 돌아갈 때 앞으로 튀어서, 처음→끝으로 일정하게 밀려 나가는 몫은 빼고 지느러미를 펼치는 움직임만 남겨요
            lin = txs[0] + (txs[-1] - txs[0]) * i / (len(txs) - 1)
            ox = CX - lin
        if fam == 'turn':   # 돌기: 몸 모양이 바뀌면서 무게중심이 위아래로 흔들려 방향을 바꿀 때 튀었어요. 가로는 시작 자리에서 끝 자리(좌우 반대)로 부드럽게, 세로는 항상 같은 높이에 두어요
            _, tx, ty = stats(c.resize(r.size, Image.LANCZOS))
            t = i / (n - 1); want_x = CX + (CW - CX - CX) * (t * t * (3 - 2 * t))   # 시작: CX, 끝: 거울 위치(CW-CX)
            ox, oy = want_x - tx, CY - ty
        f.alpha_composite(r, (round(ox), round(oy)))
        f.save(os.path.join(FR, f'g_{fam}{i}.webp'), 'WEBP', quality=90, method=6)
        D['dim'][f'g_{fam}{i}'] = {'w': CW, 'h': CH}; D['mask'][f'g_{fam}{i}'] = mask_of(f)
# 돌기 속도 조절: 앞뒤 장 사이에 모양이 많이 바뀌는 곳(몸을 휙 돌리는 구간)은 오래, 조금 바뀌는 곳은 짧게 보여 줘서 '뚝뚝' 끊기지 않게 해요 (장마다 머무는 시간 배율)
tf = [np.asarray(Image.open(os.path.join(FR, f'g_turn{i}.webp')).convert('RGBA').getchannel('A')).astype(float) / 255 for i in range(D['count']['g_turn'])]
df = [np.abs(tf[i + 1] - tf[i]).sum() / max(1.0, tf[i].sum()) for i in range(len(tf) - 1)]
med = float(np.median(df))
D.setdefault('pace', {})['g_turn'] = [round(min(3.0, max(0.8, d / med)), 2) for d in df] + [1.0]
open(os.path.join(OUT, 'dims.js'), 'w').write('window.DIMS = ' + json.dumps(D))
print('구피 프레임', sum(n for *_, n in SHEETS), '장,', CW, 'x', CH)

"""고양이 그림 네 장(tools/src_art/*.png, 각 6칸 x 2줄 = 12프레임)을 잘라 public/assets/cats/*.webp 와 src/cats.gen.ts 를 만들어요.
  walkR.png: 오른쪽으로 걷기 / walkL.png: 왼쪽으로 걷기 / jumpup.png: 위층으로 뛰기 / jumpdown.png: 아래층으로 뛰기
  catsRest.png: 4칸 x 2줄 (서기·걷기·걷기·앉기 / 자기·세수·애교·애교구르기) 중 앉기, 자기, 세수, 애교(구르기)를 한 장씩 써요
사용법: python3 tools/process_cats.py"""
import json, os
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = {'walkR': 'walkR', 'walkL': 'walkL', 'up': 'jumpup', 'down': 'jumpdown', 'pounce': 'pounce'}  # pounce: 손가락·마우스를 잡으려는 동작
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


def extract_rest(path, thr=120):
    """4x2 격자 그림에서 칸마다 고양이를 한 마리씩 잘라요 (왼쪽→오른쪽, 위→아래)"""
    im = Image.open(path).convert('RGBA')
    rgb = np.asarray(im)[:, :, :3]; a = np.asarray(im)[:, :, 3]
    lab, n = ndi.label(a > thr)
    objs = ndi.find_objects(lab); sizes = ndi.sum(a > thr, lab, range(1, n + 1))
    cs = [(i, sl, (sl[0].start + sl[0].stop) // 2, (sl[1].start + sl[1].stop) // 2) for i, (sl, s) in enumerate(zip(objs, sizes), start=1) if s > 20000]
    rows = [[], []]
    for c in cs: rows[min(1, c[2] * 2 // im.height)].append(c)
    out = []
    for r in rows:
        r.sort(key=lambda c: c[3])
        assert len(r) == 4, len(r)
        for i, sl, _, _ in r:
            pad = 12
            y0, y1 = max(sl[0].start - pad, 0), min(sl[0].stop + pad, a.shape[0]); x0, x1 = max(sl[1].start - pad, 0), min(sl[1].stop + pad, a.shape[1])
            keep = ndi.binary_dilation(lab[y0:y1, x0:x1] == i, iterations=5)
            al = np.where(keep & (a[y0:y1, x0:x1] >= 12), a[y0:y1, x0:x1], 0).astype(np.uint8)
            sp = Image.fromarray(np.dstack([rgb[y0:y1, x0:x1], al]), 'RGBA')
            out.append(sp.crop(sp.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()))
    return out


rest = extract_rest(os.path.join(ROOT, 'tools/src_art/catsRest.png'))
# 같은 그림의 서 있는 모습 3장(0~2번 칸)이 걷기 그림과 같은 몸 크기가 되도록 배율을 정해요 → 앉기·자기·세수·애교도 걷기와 같은 크기예요
REST_PICK = {'sit': 3, 'sleep': 4, 'groom': 5, 'aegyo': 7}
raw_rest = {g: [rest[i]] for g, i in REST_PICK.items()}
rest_ref = [rest[0], rest[1], rest[2]]
# 네 장의 고양이 크기가 서로 달라서, 걷기 그림의 평균 몸 크기를 기준으로 장마다 한 배율을 정해 모든 프레임에 똑같이 적용해요
# (프레임마다 따로 맞추면 걸을 때 커졌다 작아졌다 해요)
ref = float(np.mean([area(i) for i in raw['walkR'] + raw['walkL']]))
base = STAND_PX / float(np.mean([i.height for i in raw['walkR']])) * (1.0)
tgt = ref * base ** 2   # 목표 몸 크기(면적)
out = os.path.join(ROOT, 'public/assets/cats')
os.makedirs(out, exist_ok=True)
for f in os.listdir(out): os.remove(os.path.join(out, f))
meta, names = {}, []
rest_f = (tgt / float(np.mean([area(i) for i in rest_ref]))) ** 0.5
for g, imgs in list(raw.items()) + list(raw_rest.items()):
    f = rest_f if g in raw_rest else (tgt / float(np.mean([area(i) for i in imgs]))) ** 0.5
    scaled = [i.resize((max(1, round(i.width * f)), max(1, round(i.height * f))), Image.LANCZOS) for i in imgs]
    cxs = [cx(v) for v in scaled]
    half = max(max(c, v.width - c) for c, v in zip(cxs, scaled))
    cw = int(np.ceil(half * 2)) + 2; ch = max(v.height for v in scaled)
    for k, (v, c) in enumerate(zip(scaled, cxs)):
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(v, (int(round(cw / 2 - c)), ch - v.height))   # 발은 아래, 몸 무게중심은 가운데
        canvas.save(os.path.join(out, f'{g}{k}.webp'), 'WEBP', quality=90, method=6)
        meta[f'{g}{k}'] = {'w': cw, 'h': ch}; names.append(f'{g}{k}')

# ── 두 번째 고양이(흰 고양이): 루비와 같은 이름 규칙으로 앞에 wh_ 를 붙여요 ──
# 걷는 그림이 따로 없어서 쉬는 동작 그림의 걷기 두 장(+서 있기)으로 걷고, 왼쪽 걷기는 좌우로 뒤집은 그림이에요. 위·아래 점프는 같은 점프 그림을 써요.
from PIL import ImageOps
wj = extract(os.path.join(ROOT, 'tools/src_art/whiteJump.png'))
wp = extract(os.path.join(ROOT, 'tools/src_art/whitePounce.png'))
wr = extract_rest(os.path.join(ROOT, 'tools/src_art/whiteRest.png'), 200)
wr_ref = [wr[0], wr[1], wr[2]]
white_groups = {
    'walkR': [wr[1], wr[0], wr[2], wr[0]],
    'walkL': [ImageOps.mirror(i) for i in [wr[1], wr[0], wr[2], wr[0]]],
    'up': wj, 'down': wj, 'pounce': wp,
    'sit': [wr[3]], 'sleep': [wr[4]], 'groom': [wr[5]], 'aegyo': [wr[7]],
}
white_f = {g: (tgt / float(np.mean([area(i) for i in (wr_ref if g in ('walkR', 'walkL', 'sit', 'sleep', 'groom', 'aegyo') else imgs)]))) ** 0.5 for g, imgs in white_groups.items()}
for g, imgs in white_groups.items():
    f = white_f[g]
    scaled = [i.resize((max(1, round(i.width * f)), max(1, round(i.height * f))), Image.LANCZOS) for i in imgs]
    cxs = [cx(v) for v in scaled]
    half = max(max(c, v.width - c) for c, v in zip(cxs, scaled))
    cw = int(np.ceil(half * 2)) + 2; ch = max(v.height for v in scaled)
    for k, (v, c) in enumerate(zip(scaled, cxs)):
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(v, (int(round(cw / 2 - c)), ch - v.height))
        canvas.save(os.path.join(out, f'wh_{g}{k}.webp'), 'WEBP', quality=90, method=6)
        meta[f'wh_{g}{k}'] = {'w': cw, 'h': ch}; names.append(f'wh_{g}{k}')
counts = {g: len(i) for g, i in list(raw.items()) + list(raw_rest.items())}
counts.update({f'wh_{g}': len(i) for g, i in white_groups.items()})
with open(os.path.join(ROOT, 'src/cats.gen.ts'), 'w') as fh:
    fh.write('// tools/process_cats.py 가 만든 파일이에요. 직접 고치지 마세요.\nexport const CAT_DIM: Record<string, { w: number; h: number }> = ' + json.dumps(meta, indent=1) + '\n'
             + 'export const CAT_COUNT: Record<string, number> = ' + json.dumps(counts) + '\n')
mp = os.path.join(ROOT, 'public/assets/manifest.json')
m = [x for x in json.load(open(mp)) if not x.startswith('cats/')] + [f'cats/{n}.webp' for n in names]
json.dump(sorted(m), open(mp, 'w'))
print(len(names), 'frames', {g: (meta[g + '0']['w'], meta[g + '0']['h']) for g in list(raw) + list(raw_rest)})

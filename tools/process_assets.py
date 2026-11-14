#!/usr/bin/env python3
"""디자인 원본 이미지(AI 생성)를 앱에서 쓰는 투명 배경 WebP로 잘라 내는 스크립트.

사용법:  python3 tools/process_assets.py <원본 폴더>
원본 폴더에는 아래 SOURCES의 파일명(확장자 제외)대로 이미지가 있어야 해요.
결과는 public/assets/ 와 src/assets.gen.ts 로 저장돼요.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets')

SOURCES = {  # 이름 -> 원본 파일명(확장자 제외)
    'house': 'house', 'bg': 'bg', 'icon': 'icon', 'props': 'props', 'effects': 'effects',
    'momo': 'avatar-momo', 'luna': 'avatar-luna', 'coco': 'avatar-coco', 'mimi': 'avatar-mimi', 'user': 'avatar-user',
    'reception': 'room-reception', 'office': 'room-office', 'result': 'room-result',
    'library': 'room-library', 'writing': 'room-writing', 'cafe': 'room-cafe', 'garden': 'room-garden',
}

POSES = ['stand', 'walk', 'work1', 'work2', 'coffee', 'cheer']  # 3x2 칸 순서(왼→오, 위→아래)
STAND_PX = 300  # 서 있는 모습의 높이(px). 모든 아바타를 이 크기로 맞춰 앱에서 같은 배율로 그려요.
PROPS = ['desk', 'monitor', 'bookshelf', 'sofa', 'coffee-table', 'mailbox', 'calendar', 'plant', 'lamp', 'trophy', 'cake', 'tree']
FX = (['star-l', 'star-m', 'star-s', 'flower-l', 'flower-m', 'flower-s', 'heart-l', 'heart-m', 'heart-s', 'spark-l', 'spark-m', 'spark-s'] +
      ['bubble-book', 'bubble-search', 'bubble-calendar', 'bubble-check', 'bubble-coffee'] +
      ['bubble-food', 'bubble-chat', 'bubble-music', 'bubble-inbox', 'badge-yellow', 'badge-red'])


def load(src, name):
    for ext in ('png', 'jpg', 'jpeg', 'webp'):
        p = os.path.join(src, f'{SOURCES[name]}.{ext}')
        if os.path.exists(p):
            return Image.open(p).convert('RGB')
    raise SystemExit(f'원본이 없어요: {SOURCES[name]}')


def border_connected(cand, erode=1):
    """cand(참/거짓 배열) 중 가장자리와 이어진 덩어리만 돌려줌"""
    c = ndi.binary_erosion(cand, iterations=erode, border_value=1) if erode else cand
    lab, n = ndi.label(c)
    if n == 0:
        return np.zeros_like(cand)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    m = np.isin(lab, list(edge))
    if erode:
        m = ndi.binary_dilation(m, iterations=erode) & cand
    return m


def to_rgba(img, fg):
    """전경 마스크 fg로 알파를 만들어 가장자리를 부드럽게"""
    fg = ndi.binary_fill_holes(fg)
    core = ndi.binary_erosion(fg, iterations=1)
    a = ndi.gaussian_filter(core.astype(np.float32), 0.9)
    a = np.clip((a - 0.15) / 0.7, 0, 1)
    rgba = np.dstack([np.asarray(img), (a * 255).astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')


def white_fg(img, thr=247):
    a = np.asarray(img).astype(np.int16)
    cand = a.min(axis=2) >= thr
    return ~border_connected(cand, erode=2)


def color_fg(img, tol):
    a = np.asarray(img).astype(np.int16)
    h, w, _ = a.shape
    corners = np.concatenate([a[:20, :20].reshape(-1, 3), a[:20, -20:].reshape(-1, 3), a[-20:, :20].reshape(-1, 3), a[-20:, -20:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    cand = np.abs(a - bg).max(axis=2) <= tol
    return ~border_connected(cand, erode=2)


def bbox(mask):
    ys, xs = np.where(mask)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def trim(rgba):
    a = np.asarray(rgba)[:, :, 3]
    x0, y0, x1, y1 = bbox(a > 8)
    return rgba.crop((x0, y0, x1, y1))


def save(im, path, q=88):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=q, method=6)


def components(fg, min_area=60, close=0):
    m = ndi.binary_dilation(fg, iterations=close) if close else fg
    lab, n = ndi.label(m)
    objs = ndi.find_objects(lab)
    out = []
    for i, sl in enumerate(objs, start=1):
        area = int(((lab[sl] == i) & fg[sl]).sum())
        if area >= min_area:
            cy, cx = ndi.center_of_mass(lab == i)
            out.append(dict(sl=sl, cx=cx, cy=cy, area=area, id=i))
    return lab, out


def crop_rgba(rgba, boxes, pad=4):
    x0 = max(min(b[0] for b in boxes) - pad, 0); y0 = max(min(b[1] for b in boxes) - pad, 0)
    x1 = min(max(b[2] for b in boxes) + pad, rgba.width); y1 = min(max(b[3] for b in boxes) + pad, rgba.height)
    return rgba.crop((x0, y0, x1, y1))


def main(src):
    meta = {'avatars': {}}
    # 하우스와 방: 배경색 제거
    house = trim(to_rgba(load(src, 'house'), color_fg(load(src, 'house'), 14)))
    house = house.resize((1000, round(house.height * 1000 / house.width)), Image.LANCZOS)
    house = house.crop((0, 0, house.width, min(house.height, 1272)))  # 바닥 아래 그림자 잔여물 제거
    save(house, f'{OUT}/house.webp', 90)
    meta['house'] = {'w': house.width, 'h': house.height}
    for r in ['reception', 'office', 'result', 'library', 'writing', 'cafe', 'garden']:
        im = load(src, r)
        rg = trim(to_rgba(im, color_fg(im, 12)))
        wmax = 900
        rg = rg.resize((wmax, round(rg.height * wmax / rg.width)), Image.LANCZOS)
        save(rg, f'{OUT}/rooms/{r}.webp', 86)
        meta.setdefault('rooms', {})[r] = {'w': rg.width, 'h': rg.height}
    # 배경: 그대로 (불투명)
    bg = load(src, 'bg'); bg = bg.resize((900, round(bg.height * 900 / bg.width)), Image.LANCZOS)
    save(bg, f'{OUT}/bg.webp', 82)

    # 아바타 6자세
    for av in ['momo', 'luna', 'coco', 'mimi', 'user']:
        im = load(src, av)
        rgba = to_rgba(im, white_fg(im))
        fg = np.asarray(rgba)[:, :, 3] > 8
        _, comps = components(fg, min_area=120)
        W, H = im.size
        cells = {}
        for c in comps:
            col = min(int(c['cx'] // (W / 3)), 2); row = min(int(c['cy'] // (H / 2)), 1)
            cells.setdefault(row * 3 + col, []).append((c['sl'][1].start, c['sl'][0].start, c['sl'][1].stop, c['sl'][0].stop))
        assert len(cells) == 6, (av, sorted(cells))
        sprites = {p: crop_rgba(rgba, cells[i]) for i, p in enumerate(POSES)}
        # 서 있는 모습의 몸 높이(깃털 같은 효과 제외)를 기준으로 배율 결정
        s = STAND_PX / sprites['stand'].height
        meta['avatars'][av] = {}
        for p, sp in sprites.items():
            sp = trim(sp)
            sp = sp.resize((max(1, round(sp.width * s)), max(1, round(sp.height * s))), Image.LANCZOS)
            save(sp, f'{OUT}/avatars/{av}-{p}.webp', 88)
            meta['avatars'][av][p] = {'w': sp.width, 'h': sp.height}

    # 소품 4x3
    im = load(src, 'props'); rgba = to_rgba(im, white_fg(im)); fg = np.asarray(rgba)[:, :, 3] > 8
    _, comps = components(fg, min_area=300)
    W, H = im.size; cells = {}
    for c in comps:
        col = min(int(c['cx'] // (W / 4)), 3); row = min(int(c['cy'] // (H / 3)), 2)
        cells.setdefault(row * 4 + col, []).append((c['sl'][1].start, c['sl'][0].start, c['sl'][1].stop, c['sl'][0].stop))
    assert len(cells) == 12, sorted(cells)
    meta['props'] = {}
    for i, name in enumerate(PROPS):
        sp = trim(crop_rgba(rgba, cells[i]))
        sp = sp.resize((round(sp.width * 200 / sp.height), 200), Image.LANCZOS)
        save(sp, f'{OUT}/props/{name}.webp', 88); meta['props'][name] = {'w': sp.width, 'h': sp.height}

    # 효과 23개 (행 순서대로, 각 행은 왼쪽부터)
    im = load(src, 'effects'); a = np.asarray(im).astype(np.int16)
    fg = (a.min(axis=2) < 246)
    fg = ndi.binary_fill_holes(ndi.binary_closing(fg, iterations=3))
    rgba = to_rgba(im, fg); fgm = np.asarray(rgba)[:, :, 3] > 8
    lab, comps = components(fgm, min_area=200, close=2)
    comps = [c for c in comps]
    H = im.height
    rows = [[], [], []]
    for c in comps:
        rows[0 if c['cy'] < H * 0.30 else 1 if c['cy'] < H * 0.62 else 2].append(c)
    ordered = [c for r in rows for c in sorted(r, key=lambda c: c['cx'])]
    assert len(ordered) == len(FX), (len(ordered), [len(r) for r in rows])
    meta['fx'] = {}
    for c, name in zip(ordered, FX):
        sl = c['sl']
        sp = trim(rgba.crop((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop)))
        tgt = 120 if name.startswith('bubble') else 80
        sp = sp.resize((round(sp.width * tgt / max(sp.size)), round(sp.height * tgt / max(sp.size))), Image.LANCZOS)
        save(sp, f'{OUT}/fx/{name}.webp', 90); meta['fx'][name] = {'w': sp.width, 'h': sp.height}

    # 앱 아이콘: 둥근 사각형 안쪽만 잘라 모서리를 채운 정사각형으로
    ic = load(src, 'icon'); n = ic.width
    box = (150, 150, n - 150, n - 150)
    sq = ic.crop(box).convert('RGB'); arr = np.asarray(sq).astype(np.int16)
    white = (arr.min(axis=2) >= 240)
    white = border_connected(white, erode=0)
    fill = np.median(arr[40:60, arr.shape[1] // 2 - 20: arr.shape[1] // 2 + 20].reshape(-1, 3), axis=0)
    arr[white] = fill
    sq = Image.fromarray(arr.astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)
    for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png'), (64, 'favicon.png')]:
        os.makedirs(f'{ROOT}/public', exist_ok=True)
        sq.resize((size, size), Image.LANCZOS).save(f'{ROOT}/public/{name}', optimize=True)

    files = sorted(os.path.relpath(os.path.join(d, f), OUT).replace(os.sep, '/') for d, _, fs in os.walk(OUT) for f in fs if f.endswith('.webp'))
    with open(f'{OUT}/manifest.json', 'w') as f:
        json.dump(files, f)
    with open(f'{ROOT}/src/assets.gen.ts', 'w') as f:
        f.write('// tools/process_assets.py 가 만든 파일이에요. 직접 고치지 마세요.\n')
        f.write('export const ASSET_META = ' + json.dumps(meta, ensure_ascii=False, indent=1) + ' as const\n')
    print('완료', OUT)


if __name__ == '__main__':
    main(sys.argv[1])

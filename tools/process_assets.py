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
    'momo': 'avatar-momo', 'luna': 'avatar-luna', 'coco': 'avatar-coco', 'mimi': 'avatar-mimi', 'kiki': 'avatar-kiki', 'user': 'avatar-user',
    'housewood': 'house-wood', 'housesea': 'house-sea', 'housewedding': 'house-wedding',
    'bgdark': 'bg-dark', 'housedark': 'house-dark', 'boxdark': 'intro-box-dark',
    'pinbtn': 'pin-button', 'listicon': 'list-icon', 'logo': 'logo', 'logodark': 'logo-dark', 'box': 'intro-box', 'settings': 'settings-button', 'counter': 'reception-counter', 'userdesk': 'avatar-user-desk',
    'reception': 'room-reception', 'office': 'room-office', 'result': 'room-result',
    'officedark': 'room-office-dark', 'receptiondark': 'room-reception-dark', 'resultdark': 'room-result-dark', 'writingdark': 'room-writing-dark', 'librarydark': 'room-library-dark', 'cafedark': 'room-cafe-dark',
    'library': 'room-library', 'writing': 'room-writing', 'cafe': 'room-cafe', 'garden': 'room-garden',
}

ROOM_TOL = {'reception': 28}  # 배경 색이 고르지 않은 그림은 허용치를 높여서 지워요
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


def load_alpha(src, name):
    """투명 배경 PNG를 읽어서 알파 얼룩을 정리해 (RGB 이미지, RGBA 이미지)로 돌려줘요."""
    p = os.path.join(src, f'{SOURCES[name]}.png')
    if not os.path.exists(p):
        raise SystemExit(f'투명 배경 PNG가 없어요: {SOURCES[name]}.png')
    im = Image.open(p).convert('RGBA')
    a = np.asarray(im)[:, :, 3]
    if (a < 255).mean() < 0.05:
        raise SystemExit(f'{SOURCES[name]}.png 는 배경이 투명하지 않아요 (투명 PNG로 다시 저장해 주세요)')
    hard = a > 60                                    # 옅은 번짐(알파 60 이하)은 배경으로 봐요
    lab, n = ndi.label(hard)
    sizes = ndi.sum(hard, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z >= 300])  # 작은 점 얼룩 제거
    core = ndi.binary_erosion(keep, iterations=1)    # 가장자리 색 번짐 제거
    al = ndi.gaussian_filter(core.astype(np.float32), 0.8)
    al = np.clip((al - 0.1) / 0.8, 0, 1)
    rgba = Image.fromarray(np.dstack([np.asarray(im)[:, :, :3], (al * 255).astype(np.uint8)]), 'RGBA')
    return im.convert('RGB'), rgba


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


def to_rgba(img, fg, fill=True):
    """전경 마스크 fg로 알파를 만들어 가장자리를 부드럽게"""
    if fill:
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


# 다크 하우스는 층 바닥이 라이트보다 아래에 있어요. 바닥 높이(라이트 기준 y)마다 얼마나 올려야 라이트와 같아지는지
DARK_FLOOR_SHIFT = [(0, 0), (408, 10), (690, 24), (1002, 26), (1212, 14)]


def align_floors(img, shifts, out_h):
    """그림을 세로로 부드럽게 늘이고 줄여서, 층 바닥이 shifts가 말하는 만큼 위로 올라가게 해요.
    출력 y 줄은 입력 y + shift(y) 줄에서 가져와요 (사이는 직선으로 이어서 층 사이가 울퉁불퉁하지 않게)."""
    a = np.asarray(img.convert('RGBA')).astype(np.float32)
    ys = np.array([p[0] for p in shifts], dtype=np.float32)
    sh = np.array([p[1] for p in shifts], dtype=np.float32)
    out = np.zeros((out_h, a.shape[1], 4), dtype=np.float32)
    for y in range(out_h):
        src = y + float(np.interp(y, ys, sh))
        src = min(max(src, 0), a.shape[0] - 1)
        i0 = int(np.floor(src)); i1 = min(i0 + 1, a.shape[0] - 1); t = src - i0
        out[y] = a[i0] * (1 - t) + a[i1] * t
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


# 라이트 하우스 바꿔 입기(나무·바다): 카펫(아바타가 서는 바닥)의 아래쪽 끝이 기본 하우스와 같은 높이에 오게 늘이고 줄여요.
# 기본 하우스의 카펫 아래 끝: 다락 418 · 2층 718 · 1층 1037 (1000폭, 높이 1272 기준)
_RUG_Y = (418, 718, 1037)
# 처음 맞춤(층 바닥 높이)과, 그 결과에서 카펫 끝을 기본 하우스에 맞추려고 더 움직여야 하는 만큼 (출력에서 결과 그림 y까지의 차이)
_OLD_SHIFT = {
    'wood': [(0, 0), (408, 9), (690, 14), (1002, -17), (1212, -62), (1272, -22)],
    'sea': [(0, 0), (408, -11), (690, -8), (1002, -17), (1212, -62), (1272, -22)],
}
_RUG_MOVE = {'wood': (-42, -33, -24), 'sea': (-16, -21, -27)}


def _skin_shift(key):
    old = _OLD_SHIFT[key]
    oy = [p[0] for p in old]; os_ = [p[1] for p in old]
    pts = [(0, 0)] + list(zip(_RUG_Y, _RUG_MOVE[key])) + [(1272, 0)]
    xs = [p[0] for p in pts]; ds = [p[1] for p in pts]
    out = []
    for y in range(0, 1273, 24):
        cur = y + float(np.interp(y, xs, ds))
        out.append((y, round(cur + float(np.interp(cur, oy, os_)) - y, 1)))
    if out[-1][0] != 1272:
        out.append((1272, out[-1][1]))
    return out


SKIN_FLOOR_SHIFT = {k: _skin_shift(k) for k in ('wood', 'sea')}


def skin_house(src, key):
    """투명 PNG 하우스: 흐릿한 가장자리(옛 배경색이 섞인 부분)를 2px 깎아 깨끗하게 하고 1000폭으로 줄여요"""
    im = Image.open(os.path.join(src, f'{SOURCES["house" + key]}.png')).convert('RGBA')
    a = np.asarray(im)[:, :, 3]
    hard = a > 200
    lab, n = ndi.label(hard)
    sizes = ndi.sum(hard, lab, range(1, n + 1))
    keep = ndi.binary_fill_holes(lab == (int(np.argmax(sizes)) + 1))
    core = ndi.binary_erosion(keep, iterations=3)
    al = np.clip((ndi.gaussian_filter(core.astype(np.float32), 1.0) - 0.15) / 0.7, 0, 1)
    rgba = Image.fromarray(np.dstack([np.asarray(im)[:, :, :3], (al * 255).astype(np.uint8)]), 'RGBA')
    rgba = trim(rgba)
    rgba = rgba.resize((1000, round(rgba.height * 1000 / rgba.width)), Image.LANCZOS)
    if key in ('wedding', 'wood'):
        # 그림이 더 길어서 위에서 아래로 전체를 1272에 맞춰 넣어요. 카펫 중앙이 아바타 발 아래 10쯤 (418·700·1012)에 오게
        # (원본 1000폭 기준 카펫 중앙: 다락 453 · 2층 765 · 1층 1090)
        H = rgba.height
        src_rug = {'wedding': (453, 765, 1090), 'wood': (405, 685, 945)}[key]  # 원본(1000폭)에서 층 카펫 중앙의 높이
        pts = [(0, 0), (418, src_rug[0] - 418), (700, src_rug[1] - 700), (1012, src_rug[2] - 1012), (1272, H - 1272)]
        return align_floors(rgba.crop((0, 0, 1000, H)).resize((1000, H)), pts, 1272)
    return align_floors(rgba, SKIN_FLOOR_SHIFT[key], 1272)


def main(src):
    meta = {'avatars': {}}
    # 하우스와 방: 배경색 제거
    _, house = load_alpha(src, 'house')  # 투명 PNG: 알파 얼룩 정리
    house = trim(house)
    house = house.resize((1000, round(house.height * 1000 / house.width)), Image.LANCZOS)
    house = house.crop((0, 0, house.width, min(house.height, 1272)))  # 바닥 아래 그림자 잔여물 제거
    save(house, f'{OUT}/house.webp', 90)
    meta['house'] = {'w': house.width, 'h': house.height}
    for r in ['reception', 'office', 'result', 'library', 'writing', 'cafe', 'garden']:
        if r in ('office', 'result', 'library', 'writing', 'cafe', 'reception'):  # 투명 PNG로 받은 방: 알파 얼룩 정리
            _, rg = load_alpha(src, r); rg = trim(rg)
        else:
            im = load(src, r)
            rg = trim(to_rgba(im, color_fg(im, ROOM_TOL.get(r, 12))))
        wmax = 900
        rg = rg.resize((wmax, round(rg.height * wmax / rg.width)), Image.LANCZOS)
        save(rg, f'{OUT}/rooms/{r}.webp', 86)
        meta.setdefault('rooms', {})[r] = {'w': rg.width, 'h': rg.height}
    # 다크 모드 방 6개 (투명 PNG): rooms/<방>-dark.webp, 크기는 meta['roomsDark']
    meta['roomsDark'] = {}
    for r in ['reception', 'office', 'result', 'library', 'writing', 'cafe']:
        _, rg = load_alpha(src, r + 'dark'); rg = trim(rg)
        rg = rg.resize((900, round(rg.height * 900 / rg.width)), Image.LANCZOS)
        save(rg, f'{OUT}/rooms/{r}-dark.webp', 86)
        meta['roomsDark'][r] = {'w': rg.width, 'h': rg.height}
    # 배경: 그대로 (불투명)
    for nm in ('lavender', 'peach', 'rose'):
        if os.path.exists(os.path.join(src, f'bg-{nm}.png')):
            bl = Image.open(os.path.join(src, f'bg-{nm}.png')).convert('RGB'); bl = bl.resize((900, round(bl.height * 900 / bl.width)), Image.LANCZOS)
            save(bl, f'{OUT}/bg-{nm}.webp', 82)
    bg = load(src, 'bg'); bg = bg.resize((900, round(bg.height * 900 / bg.width)), Image.LANCZOS)
    save(bg, f'{OUT}/bg.webp', 82)

    # 아바타 6자세 (투명 배경 PNG만 받아요. 알파의 옅은 얼룩·테두리 번짐은 지워요)
    for av in ['momo', 'luna', 'coco', 'mimi', 'kiki', 'user']:
        im, rgba = load_alpha(src, av)
        fg = np.asarray(rgba)[:, :, 3] > 8
        _, comps = components(fg, min_area=300)
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
        if av == 'user':
            user_ref = {'sprite': trim(sprites['stand']), 'scale': s}
        for p, sp in sprites.items():
            sp = trim(sp)
            sp = sp.resize((max(1, round(sp.width * s)), max(1, round(sp.height * s))), Image.LANCZOS)
            save(sp, f'{OUT}/avatars/{av}-{p}.webp', 88)
            meta['avatars'][av][p] = {'w': sp.width, 'h': sp.height}

    # 로고와 인트로 상자(투명 PNG): 알파 얼룩을 지우고 화면에서 쓰는 크기로 줄여요
    for key, width, out in (('logo', 760, 'logo'), ('logodark', 760, 'logo-dark'), ('box', 720, 'box')):
        _, rg = load_alpha(src, key)
        rg = trim(rg)
        rg = rg.resize((width, round(rg.height * width / rg.width)), Image.LANCZOS)
        save(rg, f'{OUT}/ui/{out}.webp', 92)
        meta[out.replace('-d', 'D')] = {'w': rg.width, 'h': rg.height}

    # 다크 모드 그림: 밤하늘 배경(불투명), 어두운 하우스·상자(투명 PNG)
    bgd = load(src, 'bgdark'); bgd = bgd.resize((900, round(bgd.height * 900 / bgd.width)), Image.LANCZOS)
    save(bgd, f'{OUT}/bg-dark.webp', 82)
    _, hd = load_alpha(src, 'housedark')
    hd = trim(hd); hd = hd.resize((1000, round(hd.height * 1000 / hd.width)), Image.LANCZOS)
    hd = align_floors(hd, DARK_FLOOR_SHIFT, 1272)  # 층 바닥 높이를 라이트 하우스와 똑같이 맞춰요
    save(hd, f'{OUT}/house-dark.webp', 90)
    meta['houseDark'] = {'w': hd.width, 'h': hd.height}
    meta['houseSkins'] = {}
    for key in ('wood', 'sea', 'wedding'):
        hs = skin_house(src, key)
        save(hs, f'{OUT}/house-{key}.webp', 90)
        meta['houseSkins'][key] = {'w': hs.width, 'h': hs.height}
    _, bd = load_alpha(src, 'boxdark')
    bd = trim(bd); bd = bd.resize((720, round(bd.height * 720 / bd.width)), Image.LANCZOS)
    save(bd, f'{OUT}/ui/box-dark.webp', 92)
    meta['boxDark'] = {'w': bd.width, 'h': bd.height}

    # 항상 위 작은 창 버튼(투명 PNG): 가장 큰 덩어리만 남겨 번진 가장자리 얼룩을 지우고 화면에서 쓰는 크기(2배)로 줄여요
    im = Image.open(os.path.join(src, 'pin-button.png')).convert('RGBA')
    al = np.asarray(im)[:, :, 3].astype(np.float32)
    lab, n = ndi.label(al > 40)
    sizes = ndi.sum(al > 40, lab, range(1, n + 1))
    keep = ndi.binary_dilation(lab == (int(np.argmax(sizes)) + 1), iterations=6)
    al = np.where(keep & (al >= 24), al, 0)
    pn = trim(Image.fromarray(np.dstack([np.asarray(im)[:, :, :3], al.astype(np.uint8)]), 'RGBA'))
    pn = pn.resize((192, round(pn.height * 192 / pn.width)), Image.LANCZOS)
    save(pn, f'{OUT}/ui/pin.webp', 92)

    # 업무 목록 버튼 아이콘(투명 PNG)
    _, li = load_alpha(src, 'listicon')
    li = trim(li); li = li.resize((round(li.width * 192 / li.height), 192), Image.LANCZOS)
    save(li, f'{OUT}/ui/list.webp', 92)

    # 담당 업무 아이콘 4개(국회·예산·법·민원): 한 장에 가로로 나란히 있는 그림에서 아이콘 본체만 잘라 각 아바타의 이모지로 써요.
    # 아래의 이름표와 주황색 반짝이(작은 조각)는 빼요.
    im = Image.open(os.path.join(src, 'role-icons.png')).convert('RGBA')
    al = np.asarray(im)[:, :, 3]
    top = int(im.height * 0.82)                     # 이름표(국회·예산…)는 맨 아래쪽이라 잘라 내요
    mask = al > 8; mask[top:] = False
    lab, n = ndi.label(ndi.binary_dilation(mask, iterations=3))
    objs = ndi.find_objects(lab)
    comps = []
    for i, sl in enumerate(objs, start=1):
        area = int(((lab[sl] == i) & mask[sl]).sum())
        cx = (sl[1].start + sl[1].stop) / 2
        comps.append((area, cx, sl, i))
    big = max(c[0] for c in comps)
    for col, key in enumerate(['momo', 'luna', 'coco', 'mimi']):    # 왼쪽부터 국회·예산·법·민원
        lo, hi = im.width * col / 4, im.width * (col + 1) / 4
        mine = [c for c in comps if lo <= c[1] < hi and c[0] >= big * 0.06]   # 작은 조각(반짝이)은 제외
        x0 = min(c[2][1].start for c in mine); x1 = max(c[2][1].stop for c in mine)
        y0 = min(c[2][0].start for c in mine); y1 = max(c[2][0].stop for c in mine)
        ic = im.crop((x0, y0, x1, y1))
        # 잘라 낸 영역 안에서도 반짝이 조각이 걸쳤다면 지워요
        a2 = np.asarray(ic).copy()
        keep = np.zeros(a2.shape[:2], bool)
        for c in mine:
            sl = c[2]; keep[sl[0].start - y0:sl[0].stop - y0, sl[1].start - x0:sl[1].stop - x0] |= (lab[sl] == c[3])  # 그 조각 자신의 픽셀만
        a2[~ndi.binary_dilation(keep, iterations=2), 3] = 0
        ic = trim(Image.fromarray(a2, 'RGBA'))
        ic = ic.resize((round(ic.width * 96 / ic.height), 96), Image.LANCZOS)
        save(ic, f'{OUT}/ui/role-{key}.webp', 92)

    # 설정 버튼(투명 PNG): 가장 큰 덩어리만 남겨 알파 얼룩을 지우고, 화면에서 쓰는 크기(2배)로 줄여요
    im = Image.open(os.path.join(src, 'settings-button.png')).convert('RGBA')
    al = np.asarray(im)[:, :, 3].astype(np.float32)
    lab, n = ndi.label(al > 8)
    sizes = ndi.sum(al > 8, lab, range(1, n + 1))
    keep = ndi.binary_dilation(lab == (int(np.argmax(sizes)) + 1), iterations=2)
    al = np.where(keep & (al >= 12), al, 0)
    st = trim(Image.fromarray(np.dstack([np.asarray(im)[:, :, :3], al.astype(np.uint8)]), 'RGBA'))
    st = st.resize((192, round(st.height * 192 / st.width)), Image.LANCZOS)
    save(st, f'{OUT}/ui/settings.webp', 92)

    # 접수대 카운터(우체통 포함): 투명 배경 PNG를 쓰고, 투명 영역의 옅은 얼룩 점은 지워요.
    alpha_path = os.path.join(src, 'reception-counter.png')
    im = Image.open(alpha_path).convert('RGBA')
    al = np.asarray(im)[:, :, 3].astype(np.float32)
    lab, n = ndi.label(al > 8)
    sizes = ndi.sum(al > 8, lab, range(1, n + 1))
    keep = lab == (int(np.argmax(sizes)) + 1)
    keep = ndi.binary_dilation(keep, iterations=2)  # 가장자리 부드러운 부분은 살림
    al = np.where(keep, al, 0)
    al = np.where(al < 12, 0, al)
    ct = trim(Image.fromarray(np.dstack([np.asarray(im)[:, :, :3], al.astype(np.uint8)]), 'RGBA'))
    ct = ct.resize((700, round(ct.height * 700 / ct.width)), Image.LANCZOS)
    save(ct, f'{OUT}/counter.webp', 92)
    meta['counter'] = {'w': ct.width, 'h': ct.height}
    # 다크 하우스용 카운터: 분홍을 크림·골드 톤으로 바꿔요 (밝기는 살리고 색만 바꿈)
    a_ = np.asarray(ct).astype(np.float32)
    lum = (a_[:, :, 0] * .3 + a_[:, :, 1] * .59 + a_[:, :, 2] * .11) / 255.0
    lo, mid, hi = np.array([46, 34, 24]), np.array([226, 208, 168]), np.array([255, 246, 222])
    t = np.clip(lum, 0, 1)[..., None]
    duo = np.where(t < .6, lo + (mid - lo) * (t / .6), mid + (hi - mid) * ((t - .6) / .4))
    r_, g_, b_ = a_[:, :, 0], a_[:, :, 1], a_[:, :, 2]
    gold = np.clip((0.45 - b_ / (r_ + 1)) * 5, 0, 1)                          # 금색: 파랑이 아주 적음 → 그대로 살려요
    green = np.clip((g_ - np.maximum(r_, b_) - 8) / 30, 0, 1)                   # 초록 잎도 그대로
    keep = np.maximum(gold, green)[..., None]
    out = duo * (1 - keep) + a_[:, :, :3] * keep
    cd = Image.fromarray(np.dstack([np.clip(out, 0, 255), a_[:, :, 3]]).astype(np.uint8), 'RGBA')
    save(cd, f'{OUT}/counter-dark.webp', 92)

    # 카운터 뒤에 선 나(허리 위) 6자세. 머리 크기가 서 있는 그림과 같아지게 배율을 맞춰요
    im = load(src, 'userdesk'); rgba = to_rgba(im, white_fg(im)); fg = np.asarray(rgba)[:, :, 3] > 8
    _, comps = components(fg, min_area=120)
    W, H = im.size; cells = {}
    for c in comps:
        col = min(int(c['cx'] // (W / 3)), 2); row = min(int(c['cy'] // (H / 2)), 1)
        cells.setdefault(row * 3 + col, []).append((c['sl'][1].start, c['sl'][0].start, c['sl'][1].stop, c['sl'][0].stop))
    assert len(cells) == 6, sorted(cells)
    DESK = ['idle', 'receive', 'hand', 'stamp', 'wave', 'cheer']
    desk = {n: trim(crop_rgba(rgba, cells[i])) for i, n in enumerate(DESK)}

    def head_width(sp, frac):
        a = np.asarray(sp)[:, :, 3] > 8
        rows = a[: int(a.shape[0] * frac)]
        return max((np.ptp(np.where(r)[0]) for r in rows if r.any()), default=1)
    ratio = head_width(user_ref['sprite'], 0.55) / head_width(desk['idle'], 0.72)
    ds = user_ref['scale'] * ratio
    print('나 머리 크기 배율', round(ratio, 3))
    for n, sp in desk.items():
        sp = sp.resize((max(1, round(sp.width * ds)), max(1, round(sp.height * ds))), Image.LANCZOS)
        save(sp, f'{OUT}/avatars/user-desk-{n}.webp', 88)
        meta['avatars']['user'][f'desk-{n}'] = {'w': sp.width, 'h': sp.height}

    # 소품 4x3
    im, rgba = load_alpha(src, 'props'); fg = np.asarray(rgba)[:, :, 3] > 8
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
    im, rgba = load_alpha(src, 'effects'); fgm = np.asarray(rgba)[:, :, 3] > 8
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

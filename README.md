# 🏠 MINI OFFICE WORLD

나만의 작은 세상, 아바타들이 일하는 미니 회사 (개인용 업무관리 PWA)

## 개발

```bash
npm install
npm run dev     # 개발 서버
npm run build   # 빌드
```

## 진행 상황

- [x] 1단계: 파스텔 2층 미니어처 하우스 + SVG 아바타 5명 + 모바일 화면
- [x] 2단계: 아바타 이동 및 생활 기능
- [x] 3단계: 업무 등록 시스템
- [x] 4단계: 아바타 업무 연동
- [x] 5단계: 일정관리 시스템
- [x] 6단계(기능): 데이터 백업·복원, 설정(시간표·아바타 이름), 오프라인 지원
- [x] 6단계(디자인): 3D 파스텔 디자인 적용 (하우스·배경·아바타 5명 6자세·방 7곳 확대·소품·효과·앱 아이콘)

## 배포 (GitHub Pages)

`main`에 push하면 `.github/workflows/pages.yml`이 자동으로 빌드·배포해요.
저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 한 번만 바꿔 주세요.
배포 주소(`https://<아이디>.github.io/mini-office-world/`)를 아이폰 Safari로 열고 **공유 → 홈 화면에 추가**하면 앱처럼 쓸 수 있어요.

## 데이터

업무는 사용자의 기기(IndexedDB)에만 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우면 사라지므로 설정 ⚙️ 에서 가끔 백업하세요.

## 디자인 이미지 작업

AI로 만든 원본 이미지를 앱용 투명 WebP로 자르는 스크립트가 `tools/process_assets.py`예요.
원본이 바뀌면 `pip install numpy scipy pillow` 후 `python3 tools/process_assets.py <원본 폴더>`(아바타 5명 `avatar-*.png`, `reception-counter.png`, 다크용 `house-dark.png`·`intro-box-dark.png`는 **투명 배경 PNG**여야 해요. 다크용 배경은 `bg-dark.png`)를 실행하면
`public/assets/`, `public/*.png`(앱 아이콘), `src/assets.gen.ts`가 다시 만들어져요.

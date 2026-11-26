# 눈 내리는 오르골

바탕화면에 두는 눈 내리는 오르골이에요. 인터넷이 없어도 실행돼요.

## 사용법
- `오르골.exe`를 더블클릭하면 화면 오른쪽 아래에 오르골이 나타나요. 설치가 필요 없어요.
- 오르골을 **한 번 누르면** 흔들려서 눈이 휘몰아쳐요. 점점 잦아들어요.
- **더블클릭하면** 불이 켜지고 꺼져요 (마을 창문과 가로등, 구슬 안이 환해져요).
- **끌어서** 원하는 곳으로 옮길 수 있어요. 위치는 기억해요.
- **오른쪽 클릭**(또는 작업표시줄 트레이 아이콘)으로 불, 눈, 흔들기, 눈 양, 크기, 다른 창 뒤에 두기, 시작할 때 자동 실행, 숨기기, 종료를 고를 수 있어요.
- 오르골 모양이 없는 투명한 곳은 클릭이 뒤에 있는 창으로 그대로 통과해요.

## 만드는 법
GitHub의 **Actions → Desktop snowglobe (Windows) → Run workflow**를 누르면 `오르골.exe`가 만들어져요. 완료되면 실행 결과 맨 아래 **Artifacts**에서 내려받아요.
직접 만들려면(윈도우 PC): `cd desktop-snowglobe && npm install && npm run dist` → `dist/오르골.exe`
미리 보기: `npm install && npm start`

## 그림을 바꾸려면
원본 네 장(`tools/src_art/snowglobe_off.png` 불꺼짐, `snowglobe_on.png` 불켜짐 — 투명 배경, 두 장은 같은 위치·크기 / `snowglobe_snow_off.png`, `snowglobe_snow_on.png` — 연두색 배경에 눈 알갱이, 위아래·좌우로 이어지는 그림)을 바꾼 뒤
`pip install numpy scipy pillow` → `python3 tools/process_snowglobe.py`를 실행하면 `art/`와 `icon.png`가 다시 만들어져요.

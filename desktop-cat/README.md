# 루비 바탕화면 고양이

화면 아래쪽(작업표시줄 위)을 돌아다니는 아기 고양이예요. 인터넷이 없어도 실행돼요.

## 사용법
- `Ruby-Cat.exe`를 더블클릭하면 고양이가 나타나요. 설치가 필요 없어요.
- 고양이를 **누르면** 애교를 부려요.
- **마우스를 가까이** 가져가면 앞발로 잡으려 해요.
- 고양이가 없는 곳은 클릭이 뒤에 있는 창으로 그대로 통과해서 업무에 방해되지 않아요.
- 작업표시줄 오른쪽 **트레이 아이콘**을 누르면 숨기기, 크기, 시작할 때 자동 실행, 종료를 고를 수 있어요.

## 만드는 법
GitHub의 **Actions → Desktop cat (Windows) → Run workflow**를 누르면 `Ruby-Cat.exe`가 만들어져요. 완료되면 그 실행 결과 맨 아래 **Artifacts**에서 내려받아요.
직접 만들려면(윈도우 PC): `cd desktop-cat && npm install && npm run dist` → `dist/Ruby-Cat.exe`
미리 보기: `npm install && npm start`

## 그림을 바꾸려면
`frames/`의 webp 파일과 `dims.js`(그림 크기)를 같은 이름으로 교체해요. 원본은 앱 저장소의 `tools/process_cats.py`로 만들어요.

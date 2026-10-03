# CLAUDE.md

## 명령어

- `npm run dev` — `tools/serve.mjs`(Node 정적 서버)로 앱을 http://localhost:8000 에 띄운다. `HOST=127.0.0.1,100.90.210.1 npm run dev`처럼 HOST에 쉼표로 주소를 주면 그 주소에서만 연다 (스마트폰은 Tailscale 주소로 테스트).
- `npm run lint` — ESLint로 `js/`, `sw.js`, `tools/`, `.claude/hooks/`의 JS를 검사하고 오류가 없으면 exit 0이다.
- `npm run typecheck` — `tsc -p jsconfig.json`으로 JS 타입을 검사하고 오류가 없으면 exit 0이다.
- `npm run build` — `index.html`과 manifest가 참조하는 로컬 파일이 모두 있는지 확인한다 (번들링하지 않음).
- `npm run android:sync` — 앱 파일을 `www/`로 복사하고 `cap sync android`로 `android/`에 넣는다 (APK 빌드 전 단계, CI가 실행한다).
- APK 배포 — `git tag v1.2.3 && git push origin v1.2.3` 또는 Actions의 "Build Android APK"를 버전을 넣어 실행하면 Release에 `workcal-1.2.3.apk`가 올라간다. 버전은 이전보다 커야 덮어쓰기 설치가 된다.
- `npm run backlog -- list` — 작업을 `id 상태 제목` 순서로 한 줄씩 출력한다.
- `npm run backlog -- show <id>` — 작업 하나의 모든 필드(summary, note, where 등)를 출력한다.
- `npm run backlog -- set <id> <status>` — 작업 상태를 바꿔 저장하고, enums에 없는 상태는 거부한다.
- `npm run backlog -- edit <id> <field> <value>` — title·summary·where·note·doc·priority·category·deps(쉼표 구분) 중 하나를 바꾸고, 검증에 실패하면 저장하지 않는다.
- `npm run backlog -- validate` — 백로그가 올바르면 `VALID`, 아니면 문제 목록을 출력한다.

## 구조

- `SPEC.md` — 근무 규칙, 화면 흐름, 데이터 구조, 제약, 완료 조건의 기준이다.
- `backlog.json` — 작업 목록·상태·완료 조건(summary)·핵심 규칙(note)의 기준(SSOT)이다.
- `tools/backlog.mjs` — backlog.json을 읽고 쓰는 유일한 경로다.
- `tools/build.mjs` — `npm run build`의 참조 파일 검사 기준이다.
- `tools/serve.mjs` — `npm run dev` 개발 서버이며 `.js`를 `text/javascript`로 보낸다.
- `tools/make-icons.mjs` — `icons/icon-192.png`, `icon-512.png`를 다시 그리는 스크립트다 (`node tools/make-icons.mjs`).
- `.github/workflows/pages.yml` — main에 push하면 앱 파일(`index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/`, `icons/`)만 GitHub Pages에 배포한다. 앱 파일을 새로 만들면 이 목록과 `sw.js`의 FILES에도 넣는다.
- `.github/workflows/android.yml` — 태그(`v*`)나 수동 실행 때 서명된 APK를 빌드해 GitHub Release에 올린다. 서명 키는 Secrets(`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`)에만 있고 저장소에 넣지 않는다.
- `capacitor.config.json`, `android/` — APK 래퍼(Capacitor). `android/`는 Capacitor가 만든 프로젝트이며 버전·서명 설정은 `android/app/build.gradle`에 있다. 아이콘을 바꾸면 `node tools/make-icons.mjs`가 런처 아이콘·splash도 다시 그린다.
- `tools/copy-web.mjs` — APK에 넣을 앱 파일을 `www/`(git 제외)로 복사한다. 앱 파일을 새로 만들면 여기 목록에도 넣는다.
- `eslint.config.js` — lint 규칙과 검사 범위의 기준이다.
- `jsconfig.json` — 타입 검사 옵션과 대상 파일의 기준이다.
- `.claude/settings.json` — 등록된 hook(PreToolUse, Stop)의 기준이다.
- `.claude/hooks/guard-backlog.mjs` — backlog.json을 직접 읽거나 쓰는 도구 호출을 차단한다.
- `.claude/hooks/stop-check.mjs` — 응답 종료 전 lint·build·typecheck·300줄 검사를 실행한다.
- `index.html`, `css/`, `js/`, `manifest.webmanifest`, `sw.js`, `icons/` — 앱 코드 (backlog의 `where` 필드에 정의, 아직 없음).

## 항상 지킬 것

- backlog.json은 Read/Edit/Write나 셸로 직접 열거나 고치지 않고 `tools/backlog.mjs`의 list/show/set/edit/validate로만 다룬다.
- 작업을 시작하면 `set <id> in_progress`, 끝나면 summary 조건을 브라우저에서 확인한 뒤 `set <id> done`으로 바꾼다.
- 외부 DB나 서버를 붙이지 않는다. 데이터는 `localStorage`의 `workcal.v1` 키에만 저장한다.
- 저장 데이터의 필드 이름은 SPEC.md §4(`date`, `start`, `end`, `excludeMinutes`, `leave`, `updatedAt`)와 정확히 같아야 한다.
- 앱 코드(`js/`, `sw.js`)는 외부 라이브러리와 빌드 도구 없이 브라우저 표준 기능만 쓴다.
- 날짜 문자열은 로컬 시간 기준으로 만들고 `toISOString()`으로 만들지 않는다.
- 근무시간 계산은 분 단위 정수로 하고 `js/calc.js`의 순수 함수로만 한다.
- 코드 파일 하나는 300줄을 넘기지 않는다.
- 응답을 끝내기 전에 lint, build, typecheck가 모두 exit 0이어야 한다.

## 막히면

- 앱 화면이 비거나 모듈 오류가 나면 `file://`이 아니라 `npm run dev`로 띄운 http://localhost:8000 에서 열었는지 확인한다.
- `npm run lint`/`typecheck`가 명령을 못 찾으면 `npm install`을 실행했는지(`node_modules/` 존재) 확인한다.
- `npm run dev`가 `EADDRINUSE`로 실패하면 8000 포트를 쓰는 다른 서버를 끄거나 `PORT=8001 npm run dev`로 띄운다.
- `python -m http.server`로 띄우면 Windows에서 `.js`가 `text/plain`으로 가서 모듈이 막히므로 `npm run dev`만 쓴다.
- 화면이 옛 버전으로 보이면 DevTools > Application > Service Workers에서 Unregister하고 새로고침한다.
- 저장값이 이상하면 DevTools > Application > Local Storage의 `workcal.v1` 값을 SPEC.md §4와 비교한다.
- backlog 명령이 실패하면 `npm run backlog -- validate` 출력의 문제 목록부터 고친다.
- 도구 호출이 "백로그는 tools/backlog.mjs로만…"으로 막히면 guard hook이 정상 동작한 것이니 backlog 명령을 쓴다.
- Stop hook이 종료를 막으면 reason에 나온 `[lint]`/`[build]`/`[typecheck]`/`[length]` 항목을 고친 뒤 해당 npm 명령을 직접 다시 실행한다.
- APK 빌드가 서명 단계에서 실패하면 GitHub Secrets 세 개가 있는지(`gh secret list`) 확인한다. 서명 키 원본은 저장소 밖 `C:\Users\hh\workcal-signing\`에 있다.
- hook이 동작하지 않으면 `node --version`이 출력되는지와 `.claude/settings.json`이 올바른 JSON인지 확인한다.

# ZipOne

고객용 제품 소개 홈페이지와 요청·질문 게시판입니다. HTML, CSS, 브라우저 JavaScript로 만들었으며 프런트엔드 프레임워크는 사용하지 않습니다. 게시글·답변·관리자 계정·세션은 Cloudflare D1에 저장합니다.

- 서비스: https://zipone.pages.dev
- 게시판: https://zipone.pages.dev/board
- 관리자: https://zipone.pages.dev/admin
- 저장소: https://github.com/cndudwls11-maker/ZipOne
- Windows 로컬 작업 폴더: `C:\Users\youngjin\Desktop\웹페이지 데이터\ZipOne`

## 로컬 실행

Node.js 22 이상과 npm이 필요합니다. 터미널에서 위 프로젝트 폴더로 이동합니다.

```powershell
npm ci
npm run build
npm run dev
```

`http://127.0.0.1:8788`을 엽니다. 종료는 `Ctrl+C`입니다. `PORT` 환경변수로 포트를 변경할 수 있습니다. 소스를 수정하면 서버를 종료하고 `npm run build` 후 다시 실행합니다. Windows에서는 실행 중인 서버가 `dist` 폴더를 잠글 수 있습니다.

실제 Cloudflare Workers 런타임(workerd)과 로컬 D1을 Miniflare로 실행합니다. 서버 시작 시 스키마를 초기화하며 기존 게시글을 보존합니다. 데이터는 `.zipone/d1/`에 저장되어 서버를 다시 실행해도 유지됩니다. 로컬 D1과 운영 D1은 분리되어 있습니다. HTML 파일을 직접 열거나 정적 파일 서버만 실행하면 게시판 API는 작동하지 않습니다.

## 파일 구조

```text
public/             HTML, CSS, 브라우저 JavaScript, 이미지
server/api.js       게시판과 관리자 API
server/security.js  해시, 세션 쿠키, CSRF, 입력 검증, 요청 제한
server/worker.js    Pages 고급 모드 진입점
functions/api/      동일 API를 사용하는 Pages Functions 진입점
migrations/         D1 SQL 스키마
scripts/            빌드, 로컬 실행, DB 초기화, 관리자 생성
tests/              실제 workerd/D1 통합 테스트
site.config.json    공개 배포 주소와 리소스 식별자
dist/               배포 산출물 (빌드로 생성, Git 제외)
.zipone/            로컬 DB와 초기 로그인 정보 (Git 제외)
```

빌드가 정적 파일과 단일 ESM `_worker.js`, `_routes.json`을 `dist/`에 만듭니다. Cloudflare Pages의 고급 모드 Functions를 사용합니다. `/api/*`는 서버에서 처리하고 일반 페이지는 정적 자산으로 제공합니다. `functions/api/[[path]].js`는 일반 파일 기반 Functions 구조에서도 동일한 서버 모듈을 호출할 수 있도록 남겨둔 진입점입니다. 고급 모드 배포에서는 `_worker.js`가 우선합니다.

## 환경변수와 비밀정보

| 이름 | 용도 | 설정 위치 |
| --- | --- | --- |
| `SITE_URL` | canonical, 공유 이미지, sitemap, robots의 기준 주소 | Pages 빌드 환경 또는 로컬 셸. 미설정 시 `site.config.json` 사용 |
| `PORT` | 로컬 서버 포트, 기본값 8788 | 로컬 셸 |
| `CLOUDFLARE_API_TOKEN` | 원격 DB 초기화·관리자 생성 도구용, 해당 계정 D1 Edit 권한 | 로컬 셸 또는 CI 비밀정보 저장소 |
| `CLOUDFLARE_ACCOUNT_ID` | CLI 도구가 사용할 계정, 미설정 시 설정 파일의 계정 | 로컬 셸 |
| D1 바인딩 `DB` | 운영 게시글·답변·관리자·세션 저장 | Pages → Settings → Bindings, 운영 및 미리보기별 설정 |

런타임에는 D1 바인딩 외에 비밀 환경변수가 필요하지 않습니다. 관리자 평문 비밀번호나 토큰은 소스·빌드 산출물에 넣지 않습니다. 계정·DB 식별자는 공개 설정값입니다. `.env`, `.dev.vars`, `.zipone`, 로컬 DB와 로그는 Git에서 제외됩니다. 제공된 `.env.example`은 값이 없는 참고 파일이며 자동으로 읽지 않습니다.

## 데이터베이스 초기화

로컬 DB는 `npm run dev`가 자동 초기화합니다. 수동 실행은 빌드 후 다음과 같습니다.

```powershell
npm run db:migrate
```

원격 D1에는 `.env.example`에 설명된 토큰을 안전하게 셸 환경변수로 설정한 뒤 실행합니다.

```powershell
npm run db:migrate -- --remote
```

`migrations/0001_initial.sql`은 재실행할 수 있으며 기존 데이터를 삭제하지 않습니다. D1 콘솔에서 같은 SQL을 실행해도 됩니다. DB ID는 `site.config.json`에 있습니다. 이후 스키마 변경은 별도 번호의 마이그레이션 파일과 실행 도구 변경으로 관리하고, 적용 전에 D1 백업을 확인하세요. 현재 도구는 초기 스키마 파일을 적용합니다.

## 관리자 계정 생성·비밀번호 변경

로컬 관리자:

```powershell
npm run admin:create -- --username zipone-admin
```

운영 관리자 (D1 Edit 토큰 필요):

```powershell
npm run admin:create -- --remote --username zipone-admin
```

대화형 터미널에서 새 비밀번호를 두 번 입력합니다. 입력은 화면에 표시되지 않으며 명령행 인자·로그·파일로 저장하지 않습니다. 관리자 비밀번호는 14~128자의 고유한 값을 사용하세요. 같은 아이디로 실행하면 비밀번호를 변경하고 해당 계정의 기존 세션을 모두 폐기합니다. 로컬 서버가 같은 DB를 사용 중이면 관리자 생성 전에 종료해 주세요.

최초 작업 과정에서 생성한 운영 관리자 로그인 정보는 **지정 Windows 폴더 안의 `.zipone/admin-initial.json`에만** 보관되어 있습니다. GitHub에는 올라가지 않습니다. 위 도구로 비밀번호를 변경한 뒤에는 이 초기 파일도 안전하게 정리하세요. 새로 복제한 환경에는 이 파일이 없으므로 위 도구로 계정을 생성해야 합니다.

관리자는 `/admin`에서 로그인한 뒤 글을 선택해 답변을 등록·수정·삭제하거나 부적절한 글을 삭제할 수 있습니다. 답변 존재 여부로 ‘답변 대기/답변 완료’를 계산하므로 답변 삭제 시 자동으로 대기 상태로 바뀝니다. 관리자 API는 매 요청마다 서버에서 세션과 계정을 검증합니다.

## Pages 배포

이 프로젝트 전용 리소스는 다음과 같습니다.

- Pages 프로젝트: `zipone`, 운영 브랜치: `main`
- Git 연결: `cndudwls11-maker/ZipOne`
- Pages 빌드 명령: `npm ci && npm run build` (GitHub Actions에서 별도로 통합 테스트 실행)
- 빌드 결과 폴더: `dist`
- D1: `zipone-board`, 바인딩 이름: `DB`
- 호환성 날짜: `2026-11-13` (로컬 에뮬레이터: 설치된 workerd의 `2026-07-30`)
- 미리보기 브랜치 자동 배포는 꺼져 있어 운영 DB에 테스트 글이 들어오는 것을 줄입니다. 미리보기를 사용할 때는 별도 D1 DB를 연결하세요.

`main`에 푸시하면 Cloudflare Pages가 자동으로 빌드하고 배포합니다. 배포 로그에서 빌드·검증 성공과 해당 커밋의 배포 상태를 확인하세요. 다른 계정에서 설치할 때는 Pages에서 GitHub 저장소를 연결하고 위 빌드 설정과 D1 바인딩을 지정한 뒤 `site.config.json`의 리소스와 주소를 실제 값으로 바꿉니다. `SITE_URL`을 새로운 HTTPS 원점 주소로 지정하면 메타데이터·sitemap·robots가 빌드 때 함께 갱신됩니다.

`sitemap.xml`에는 홈과 게시판만 포함됩니다. 관리자·작성·수정·게시글 상세·API는 `noindex` 또는 `X-Robots-Tag`를 사용하며 robots에도 제외 경로를 지정합니다. 검색 노출 제외는 접근 권한을 대체하지 않으므로 관리자 보호는 서버가 별도로 수행합니다.

## 보안과 공개 게시판 운영

- 글 비밀번호: 10~128자, 무작위 개별 salt + PBKDF2-SHA256 100,000회(Workers Web Crypto의 지원 상한), 상수 시간 비교. 관리자 생성 도구는 14자 이상을 요구합니다.
- 세션: 256비트 무작위 토큰의 SHA-256 해시만 DB 저장. HTTPS에서 `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`. 로그인 시 교체, 로그아웃 시 서버에서 폐기, 절대 만료 8시간·유휴 만료 30분.
- CSRF: 원점 및 Fetch Metadata 확인 + 쿠키와 헤더 토큰 확인. 토큰은 `/api/session`에서 받아 메모리에서만 사용합니다.
- SQL: 모든 고객 입력은 prepared statements로 바인딩. 검색의 `%`, `_`, `\`도 이스케이프합니다.
- XSS: 고객 작성 내용과 답변을 HTML로 해석하지 않고 `textContent`로 표시. CSP, 프레임 차단, MIME 보호 적용.
- 요청 제한: IP를 scope·시간 구간과 함께 해시한 키로 D1에 저장. 일반 요청 180회/분, 글 등록 5회/10분, 글 비밀번호 확인 10회/10분, 관리자 로그인 5회/15분, 관리자 변경 60회/10분. 초과 시 429와 대기 안내. 원본 IP는 DB에 저장하지 않습니다.
- JSON 요청만 받고 본문은 32KB, 글·답변은 5,000자까지 허용합니다. DB 오류에는 503과 재시도 안내를 반환합니다. 저장 실패 시 입력 폼은 유지하며 성공 화면으로 이동하지 않습니다.
- 세션 확인 시 만료 세션과 오래된 요청 제한 데이터를 정리합니다. 글과 답변은 관리자가 삭제하기 전까지 저장됩니다. 글 삭제 시 연결된 답변도 함께 삭제합니다.

공개 게시판이므로 고객에게 연락처 등 개인정보를 적지 않도록 안내합니다. 파일 업로드, 연락처 수집, 결제, 이메일 알림은 포함하지 않습니다. 운영 트래픽이 커지면 Cloudflare의 별도 네트워크 요청 제한이나 Turnstile을 추가할 수 있습니다.

## 검증

```powershell
npm run build
npm test
```

테스트는 브라우저 저장소 모형이 아닌 workerd와 D1에서 실행됩니다. CRUD, 잘못된 비밀번호, 별도 세션 조회, 관리자 로그인·로그아웃·토큰 교체·권한 차단·답변 관리, 검색·분류·페이지네이션, SQL 주입, CSRF, 입력 크기, 반복 요청, 만료 세션과 DB 실패 안내를 검증합니다. 테스트 데이터는 메모리 DB에만 생성합니다. 상세 실행 결과와 화면 검증 범위는 `VALIDATION.md`에 기록합니다.

## 제품 정보와 이미지

ZipOne은 의류 하단을 잡아주어 한 손으로 지퍼를 잠그는 동작을 돕는 보조기기입니다. 지퍼를 자동으로 올리지 않습니다. 손을 가까이 대면 집게가 열리고, 열린 상태를 3초간 유지한 뒤 자동으로 닫힙니다. 높이 조절 다이얼로 집게 높이를 맞춥니다. 고객 화면에는 내부 기술 설명, 검증되지 않은 성능·인증·후기·가격·출시 정보를 넣지 않았습니다.

- `public/assets/product.png`: 사용자가 제공한 `zipone 제품 모의 이미지.png` 원본을 그대로 사용했습니다. 대표 이미지 옆에 최종 외관 변경 가능성을 안내합니다.
- `public/assets/one-hand.png`: 이 프로젝트를 위해 ImageGen으로 생성한 일상 동작 일러스트. 외부 사진이나 시제품 사진을 사용하지 않았습니다.
- 아이콘·로고 장식은 직접 작성한 SVG/CSS이며, 글꼴은 시스템 한국어 글꼴을 사용합니다. 외부 폰트 요청은 없습니다.

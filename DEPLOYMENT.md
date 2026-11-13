# ZipOne 운영 배포 기록

검증일: 2026-11-14 (Asia/Seoul)

- 운영 주소: https://zipone.pages.dev/
- 게시판: https://zipone.pages.dev/board
- 관리자: https://zipone.pages.dev/admin
- GitHub: https://github.com/cndudwls11-maker/ZipOne / main
- 로컬 작업 폴더: C:\Users\youngjin\Desktop\웹페이지 데이터\ZipOne

## 실제 복구한 새 프로젝트 설정

| 항목 | 값 |
| --- | --- |
| Pages 프로젝트 | zipone (새 생성 시각 2026-11-13T16:05:39.911248Z) |
| Git 연결 | cndudwls11-maker/ZipOne, production main |
| 빌드 명령 | npm ci && npm run build |
| 출력 폴더 | dist |
| 루트 폴더 | 저장소 루트 (빈 값) |
| NODE_VERSION | 22 |
| SITE_URL | https://zipone.pages.dev |
| D1 바인딩 | DB → zipone-board |
| D1 ID | c61a4a1c-e155-489c-9a96-672b6d8bbaf4 |
| 호환성 날짜 | 2026-11-13 |
| Functions fail_open | false |
| main 자동 배포 | 활성화 |
| 브랜치 미리보기 자동 배포 | 비활성화, 재활성화 시 별도 D1 연결 필요 |

## 원인과 조치

삭제 전 사이트의 설정이 이어졌다고 가정하지 않고 현재 목록·설정을 확인했습니다. 새 프로젝트에는 빌드 명령과 출력 폴더가 없었습니다. 이전 빌드 로그가 빌드 생략을 명시했으며, 홈은 404이지만 /public/index.html은 200이었습니다. 소스 폴더가 배포되어 있었기 때문입니다. DB 바인딩도 비어 있어 API가 503을 반환했습니다. 현재 복구 대상의 원인은 이 설정 누락이며, 이전에 보였던 서비스 API 503·522 상태와 구분됩니다. 현재 Pages API와 운영 사이트가 정상 응답합니다.

기존 zipone-board를 먼저 조회해 테이블·스키마·관리자를 확인했습니다. 초기화 SQL이나 관리자 재생성 명령을 실행하지 않고 DB 바인딩만 복구했습니다. 진행 중인 배포가 없음을 확인하고 최신 main을 재시도했습니다.

## 성공한 복구 배포

- 배포 ID: 6674884f-485c-4edf-99b1-6eb2bdf325e1
- 소스 커밋: 75be9ff267d64f83a53d50a2143b804cbb73f2c7
- 결과: queued / initialize / clone_repo / build / deploy 모두 success
- 로그: Node 22.23.4, npm ci && npm run build, dist 생성, _worker.js와 _routes.json 업로드, Assets published

이 기록을 포함한 이후 main 커밋은 Git 연동으로 자동 배포됩니다. 최종 배포 커밋과 실제 접속 결과는 완료 보고 및 Cloudflare의 canonical deployment에서 확인할 수 있습니다.

## 실제 운영 검증과 데이터 보존

API와 브라우저 화면 양쪽에서 게시글 CRUD, 잘못된 비밀번호 차단, 검색·분류, 기존 관리자 로그인·로그아웃, 답변 CRUD와 자동 답변 상태, 관리자 권한 차단을 확인했습니다. 홈·제품 이미지·모바일 화면, sitemap·robots, 공개 서버 소스 404도 확인했습니다.

검증 글 3건은 모두 정리했습니다. 전후 기존 관리자 id·아이디·생성 시각이 동일하며, 최종 게시글 0건·답변 0건·관리자 1명·스키마 기록 1건입니다. DB 삭제·초기화·관리자 비밀번호 변경은 하지 않았습니다. 초기 로그인 정보는 기존 로컬 .zipone/admin-initial.json에 있으며 Git에 포함하지 않습니다.

현재 운영 차단 문제는 없습니다. 모바일은 Chromium 뷰포트 검증이며 실제 휴대폰·Safari·Firefox는 별도 검증하지 않았습니다.

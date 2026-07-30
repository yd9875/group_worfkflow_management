# 조직 일정 관리

조직 전체, 부서, 개인 일정을 주간표와 월간 캘린더에서 함께 관리하는 한국어 업무용 웹앱입니다. 조직 가입은 코드와 관리자 승인으로 통제하고, 데이터 조회와 변경 권한은 서버에서 다시 검증합니다.

## 주요 기능

- Better Auth 기반 이메일·비밀번호 가입, 이메일 인증, 비밀번호 재설정
- 조직 생성, 가입 코드 발급·재발급, 가입 신청·승인·거절
- 소유자·관리자·구성원 역할과 부서 기반 권한
- 조직·부서·개인 일정 등록, 소프트 삭제, 범위별 서버 조회 제한
- 월요일 시작 주간표, 월간 캘린더, URL 기반 필터
- 앱 내 알림, 구성원·부서 관리, 감사 로그
- A4 가로 인쇄 화면과 브라우저 PDF 저장
- PostgreSQL/Prisma 마이그레이션과 개발 시드
- Docker standalone 이미지와 Fly.io 설정

## 로컬 실행

필수 도구는 Node.js 22 이상, pnpm, Docker입니다.

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

브라우저에서 `http://localhost:3000`을 엽니다. Mailpit 화면은 `http://localhost:8025`입니다.

개발 시드 계정:

- 소유자: `owner@example.com`
- 관리자: `admin@example.com`
- 구성원: `member1@example.com` ~ `member4@example.com`
- 비밀번호: `Schedule!2026`
- 가입 코드: `TEAM2026`

시드는 `NODE_ENV=production`에서 실행되지 않습니다.

## 환경 변수

`.env.example`을 기준으로 설정합니다.

- `DATABASE_URL`: PostgreSQL 연결 문자열
- `BETTER_AUTH_SECRET`: 32자 이상의 임의 비밀값. 가입 코드 암호화에도 사용하므로 변경 전 기존 코드 재발급이 필요합니다.
- `BETTER_AUTH_URL`, `APP_URL`: 앱의 절대 URL
- `SMTP_*`: SMTP 연결 정보
- `EMAIL_DELIVERY_MODE=log`: 메일을 발송하지 않고 인증 링크를 구조화 로그로 출력하는 개발/미연결 모드
- `PRIVACY_CONTROLLER_NAME`, `PRIVACY_CONTACT_EMAIL`: 개인정보처리자와 문의처
- `PRIVACY_DB_*`: 개인정보 처리방침에 공개되는 Aiven 국외 보관 국가·수탁자 정보. 데이터베이스 리전을 바꾸면 함께 갱신합니다.

실제 운영에서는 `EMAIL_DELIVERY_MODE=log`를 제거하고 SMTP 비밀값을 설정해야 사용자가 받은편지함에서 인증할 수 있습니다.

## 검사

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

E2E 테스트는 개발 서버를 자동으로 시작하며, 인증이 필요한 전체 시나리오는 PostgreSQL과 시드가 준비된 상태에서 실행합니다.

## Docker

```bash
docker build -t group-workflow-management .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL='postgresql://...' \
  -e BETTER_AUTH_SECRET='...' \
  -e BETTER_AUTH_URL='http://localhost:3000' \
  group-workflow-management
```

이미지는 Next.js standalone 출력을 사용하며 `0.0.0.0:3000`에서 수신합니다. 마이그레이션은 이미지 시작이 아니라 배포 릴리스 명령에서 별도로 실행합니다.

## Fly.io 배포

`fly.toml`의 앱 이름은 `group-workflow-management`, 기본 리전은 서울에 가까운 `nrt`입니다. 앱 이름이 이미 사용 중이면 Fly에서 할당 가능한 이름으로 바꾸어야 합니다.

```bash
fly auth login
fly apps create group-workflow-management
fly mpg create
fly mpg attach <POSTGRES_CLUSTER_ID> -a group-workflow-management
fly secrets set \
  BETTER_AUTH_SECRET='<32자 이상 비밀값>' \
  BETTER_AUTH_URL='https://group-workflow-management.fly.dev' \
  APP_URL='https://group-workflow-management.fly.dev'
fly deploy
fly status
curl https://group-workflow-management.fly.dev/api/health
```

운영 SMTP를 연결하려면 `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`을 Fly secrets로 저장하고 `EMAIL_DELIVERY_MODE`를 제거합니다. `DATABASE_URL`과 모든 비밀값은 이미지나 Git에 포함하지 않습니다.

### 백업과 롤백

1. 스키마 변경 전에 Fly Managed Postgres의 최신 백업과 복원 가능 상태를 확인합니다.
2. 앱만 문제가 생겼다면 `fly releases`에서 이전 릴리스를 확인한 뒤 `fly deploy --image <이전 이미지>`로 앱만 되돌립니다.
3. DB 변경은 앱 롤백과 분리합니다. 파괴적 변경은 한 번에 하지 않고, 필드 추가 → 데이터 이행 → 구버전 사용 중단 → 후속 삭제 순서로 진행합니다.
4. DB 복원이 필요한 장애는 새 데이터 손실 범위를 먼저 확인하고 Managed Postgres 복원 절차로 별도 클러스터에 복원한 뒤 연결을 전환합니다.

## 보안·운영 메모

- 가입 코드 원문은 해시로 검색하고 AES-GCM으로 암호화해 관리자에게만 다시 표시합니다.
- 일정 조회는 기간 조건과 현재 활성 멤버십을 사용합니다.
- 개인 비공개 일정과 다른 부서 일정은 API 응답 자체에서 제외합니다.
- 관리자 작업과 일정 변경은 감사 로그를 남깁니다.
- 계정 설정에서 회원 탈퇴와 개인정보 파기를 제공합니다. 조직 소유자는 다른 구성원에게 소유권을 이전한 뒤 탈퇴할 수 있습니다.
- 탈퇴 시 계정·인증정보와 개인 일정은 삭제하고, 공동 일정·감사 기록은 사용자 식별 연결값을 제거한 뒤 조직 기록으로 보존합니다.

## 현재 MVP 차이

- 일정 수정 UI는 후속 작업입니다. 등록과 권한 검증된 소프트 삭제는 제공됩니다.
- 개별 알림 읽음은 목록 진입이 아니라 “모두 읽음”으로 제공합니다.
- 부서·구성원 비활성화 UI와 조직 삭제는 데이터 보존 정책 확정 전까지 제공하지 않습니다.
- 운영 SMTP 계정은 저장소에 포함할 수 없으므로 배포 후 별도 secret 설정이 필요합니다. 미설정 배포는 로그 메일 모드입니다.
- 브라우저 E2E는 공개 화면과 헬스 체크를 포함합니다. 데이터베이스 트랜잭션 전체 E2E는 운영과 분리된 테스트 DB 연결 후 확장합니다.

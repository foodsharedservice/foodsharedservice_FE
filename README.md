# 나눔장터 · 우리 동네 물품 나눔 (Frontend)

안 쓰는 물건과 남는 식품을 동네 이웃과 **무료로 나누는** 마켓플레이스 프론트엔드입니다.
[`food_shared_serivce`](https://github.com/foodsharedservice) 백엔드의 **실제 배포 API**(`https://api.foodshare.click`)에
1:1로 맞춰 구현했으며, UI는 번개장터 스타일의 마켓 그리드/채팅 경험을 지향합니다.

- **Framework**: Next.js 14 (App Router)
- **Language**: JavaScript (JSX) + React 18
- **Styling**: 디자인 시스템 CSS (`app/globals.css`) — 별도 UI 라이브러리 없음
- **실시간 채팅**: STOMP over WebSocket (`@stomp/stompjs`)
- **Deploy**: Vercel

## 화면

| 경로 | 화면 | 사용 API |
|------|------|----------|
| `/login` | 로그인 | `POST /auth/login` |
| `/signup` | 회원가입 (이메일 인증 · 닉네임 중복확인 · 주소) | `POST /auth/email/send` · `verify` · `GET /members/nickname/check` · `POST /members` |
| `/` | 홈 피드 (상품 그리드 · 검색 · 상태 필터 · 정렬 · 더보기) | `GET /foods?page&size&sort` |
| `/foods/[foodId]` | 물품 상세 (갤러리 · 나눔 요청 · 등록자 요청관리 · 채팅) | `GET /foods/{id}` · `POST/GET/DELETE /foods/{id}/requests*` · `PATCH …/approve\|reject` |
| `/register` | 나눔 등록 (대표사진 1장 → 서버 AI가 소비기한 인식) | `POST /foods` (multipart) · `POST /foods/expired-date/{id}` |
| `/chat` | 채팅 목록 | `GET /members/me/chat/rooms` |
| `/chat/[roomId]` | 채팅방 (히스토리 + 실시간) | `GET /chat/rooms/{id}/messages` · STOMP `/pub`·`/user/queue/messages` |
| `/mypage` | 마이페이지 (프로필 · 정보수정 · 내 채팅 · 로그아웃/탈퇴) | `GET/PATCH/DELETE /members/me` · `POST /auth/logout` |

## API 연동 (`lib/api.js`)

모든 경로/필드는 백엔드 컨트롤러·DTO와 1:1로 검증되어 있습니다.

- **인증**: 서버 세션 쿠키(Redis) → 모든 요청 `credentials: "include"`
- **성공 응답**: `{ code, data, message }` envelope → `data` 언랩
- **실패 응답**: RFC 7807 `ProblemDetail` `{ title(=code), status, detail }` → `Error(code, status)` throw
- **목록**: `PageResponse { content, page, size, totalElements, totalPages, hasNext, hasPrevious }`
- **나눔 등록**: 대표 사진 1장을 `POST /foods`의 `file` 파트로 보내면 서버가 AI로 소비기한을 읽어 자동 설정합니다.
- **나눔 요청**: 모든 요청 경로는 `/foods/{foodId}/requests` 하위에 있습니다.
- **실시간 채팅** (`lib/chat.js`): `wss://<api-host>/ws` 로 STOMP 연결 →
  구독 `/user/queue/messages`, 전송 `/pub/chat/rooms/{roomId}` `{ content }`.

> 이 앱은 **실제 API 데이터만** 사용합니다(mock 폴백 없음). 서버 연결/CORS 실패 시
> 각 화면에 로딩·에러·빈 상태 UI가 그대로 노출되어 연동 여부를 바로 확인할 수 있습니다.

### 인증 흐름

- 앱 진입 시 `GET /members/me`로 로그인 여부를 판별합니다. (`AuthProvider`)
- 로그인 성공 시 `GET /members/me`로 전체 프로필(`memberId`/주소 포함)을 다시 불러옵니다.
  `memberId`는 물품 상세에서 "내가 등록한 나눔"(등록자 요청관리) 여부 판별에 사용됩니다.
- 비로그인 시 `/mypage`·`/register`·`/chat`은 로그인으로 리다이렉트됩니다.

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `NEXT_PUBLIC_API_BASE` | 백엔드 API Base URL (`/api/v1` 포함) | `https://api.foodshare.click/api/v1` |

`.env.example`를 `.env.local`로 복사해 사용하세요. WebSocket 주소는 이 값의 호스트에서 `/ws`로 자동 유도됩니다.

## 로컬 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

## 빌드 / 배포 (Vercel)

```bash
npm run build
npm start
```

1. 저장소를 Vercel에 Import (Framework Preset: **Next.js** 자동 감지)
2. **Environment Variables**에 `NEXT_PUBLIC_API_BASE` 설정
3. Deploy

> 세션 쿠키 인증을 사용하므로, 백엔드 CORS `allowed-origin-patterns`에 프론트 도메인을 추가하고
> 쿠키는 `SameSite=None; Secure`여야 합니다. 백엔드 기본 허용 목록에는
> `https://foodsharedservice-fe.vercel.app`, `https://*.vercel.app`, `localhost:3000`이 포함되어 있습니다.

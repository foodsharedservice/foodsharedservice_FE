# 냠냠 · 음식 나눔 서비스 (Frontend)

미개봉 가공식품을 동네 이웃과 나누는 **당근마켓 스타일** 음식 나눔 서비스의 프론트엔드입니다.
[`food_shared_serivce`](https://github.com/foodsharedservice) 백엔드의 **실제 배포 API**(`https://api.foodshare.click/api/v1`)에 1:1로 맞춰 구현했습니다.

- **Framework**: Next.js 14 (App Router)
- **Language**: JavaScript (JSX) + React 18
- **Styling**: 디자인 시스템 CSS (`app/globals.css`) — 별도 UI 라이브러리 없음
- **실시간 채팅**: STOMP over WebSocket (`@stomp/stompjs`)
- **Fonts**: Pretendard(본문) / Inter · JetBrains Mono(숫자·라벨)
- **Deploy**: Vercel

## 화면

| 경로 | 화면 | 주요 API |
|------|------|---------|
| `/login` | 로그인 | `POST /auth/login` |
| `/signup` | 회원가입 (이메일 인증 · 닉네임 중복확인 · 비밀번호 규칙 · 주소 검색) | `POST /auth/email/send·verify`, `GET /members/nickname/check`, `POST /members` |
| `/` | 홈 피드 (물품 목록 · 상태 필터 · 페이지네이션) | `GET /foods?page&size&sort` |
| `/foods/[foodId]` | 물품 상세 (이미지 캐러셀 · 나눔 요청 · 등록자용 요청 수락/거절 · 채팅) | `GET /foods/{id}`, `…/requests`, `PATCH …/approve·reject`, `POST /chat/rooms` |
| `/register` | 물품 등록 (대표 사진 AI 소비기한 인식 · 추가 사진 · 정원/동네) | `POST /foods`, `POST /foods/expired-date/{id}` |
| `/chat` | 채팅 목록 | `GET /members/me/chat/rooms` |
| `/chat/[roomId]` | 실시간 채팅방 | `GET /chat/rooms/{id}/messages` + STOMP `/ws` |
| `/mypage` | 마이페이지 (내 물품 · 프로필 수정 · 로그아웃/탈퇴) | `GET/PATCH/DELETE /members/me`, `DELETE /foods/{id}` |
| 헤더 🔔 | 받은 요청 알림 (수락/거절) | `GET /foods/{id}/requests`, `PATCH …/approve·reject` |

## API 연동

API 호출 레이어는 `lib/api.js`에 있으며, **실제 배포 백엔드 컨트롤러 명세**에 정확히 매핑합니다.

- 인증: Spring Session 쿠키 (`credentials: "include"`) — 토큰 없음
- 성공 응답: `{ code, data, message }` envelope → `data` 언랩 (`204 No Content`는 본문 없음)
- 실패 응답: RFC 7807 `ProblemDetail`(`{ title, status, detail }`) → `Error(code, status)` throw
- 페이지네이션: 물품 목록은 `page/size/sort`(size ≤ 50, sort ∈ `foodId|expired|capacity`), 채팅 히스토리는 `cursor` 기반

> **이 앱은 실제 API 데이터만 사용합니다(mock 폴백 없음).** 서버 연결/CORS 실패 시
> 각 화면에 로딩·에러·빈 상태 UI가 그대로 노출됩니다.

### 백엔드 API 한계 보완

백엔드에 **"내가 등록한 물품 목록"** 엔드포인트가 없고 목록 응답에 `memberId`가 없어
소유자 식별이 불가합니다. 따라서 등록 시 생성한 `foodId`를 회원별 `localStorage`
(`lib/localStore.js`)에 기록하고, 마이페이지·알림에서 `GET /foods/{id}` 상세로 복원합니다.
(서버에서 삭제된 물품은 404로 자동 정리됩니다.)

### 실시간 채팅 (STOMP)

- 엔드포인트 `wss://<host>/ws` (SockJS 미사용, 네이티브 WebSocket) · 핸드셰이크 세션 쿠키 인증
- 전송 `SEND /pub/chat/rooms/{roomId}` `{ content }` · 수신 `SUBSCRIBE /user/queue/messages`
- 발신자는 자신의 메시지를 소켓으로 다시 받지 않아 화면에 낙관적으로 추가합니다.

### 인증 흐름

- 앱 진입 시 `GET /members/me`로 로그인 여부를 판별합니다. (`AuthProvider`)
- 비로그인 시: 헤더에 "로그인" 버튼이 보이고, `/mypage`·`/register`는 로그인으로 리다이렉트됩니다.
- 로그인 성공 시에만 홈으로 이동하며, 실패 시 에러 메시지를 표시합니다.

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `NEXT_PUBLIC_API_BASE` | 백엔드 API Base URL (`/api/v1` 포함) | `https://api.foodshare.click/api/v1` |

`.env.example`를 `.env.local`로 복사해 사용하세요.

## 로컬 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

## 빌드

```bash
npm run build
npm start
```

## Vercel 배포

1. 이 저장소를 Vercel에 Import 합니다. (Framework Preset: **Next.js** 자동 감지)
2. **Environment Variables**에 `NEXT_PUBLIC_API_BASE`를 실제 백엔드 주소로 설정합니다.
3. Deploy.

> 세션 쿠키 인증을 사용하므로, 실제 백엔드 연동 시 백엔드 CORS 설정에서
> 프론트엔드 도메인을 `allowedOrigins`에 추가하고 `allowCredentials=true`,
> 쿠키 `SameSite=None; Secure`가 필요합니다.

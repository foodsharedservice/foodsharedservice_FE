# 오늘나눔 · 음식 나눔 서비스 (Frontend)

미개봉 가공식품을 동네 이웃과 나누는 음식 나눔 서비스의 프론트엔드입니다.
[`food_shared_service`](https://github.com/foodsharedservice) 백엔드 API 명세(v3)를 그대로 사용하며,
**모바일 우선(단일 컬럼) 디자인**으로 구현했습니다.

- **Framework**: Next.js 14 (App Router)
- **Language**: JavaScript (JSX) + React 18
- **Styling**: 디자인 토큰 CSS(`app/globals.css`) + 화면별 인라인 스타일 — 별도 UI 라이브러리 없음
- **Fonts**: Pretendard
- **Layout**: 최대 480px 중앙 컬럼 · 하단 탭바(홈·채팅·등록·거래내역·마이) · 토스트
- **Deploy**: Vercel

## 화면

| 경로 | 화면 |
|------|------|
| `/login` | 로그인 |
| `/signup` | 회원가입 (이메일 → 6자리 코드 → 비밀번호·닉네임·주소, 3단계) |
| `/` | 홈 피드 (마감 임박 나눔 · 더 둘러보기 · 상태 필터) |
| `/foods/[foodId]` | 물품 상세 (이미지 · 나눔 요청 · 채팅 · 등록자 액션) |
| `/foods/[foodId]/requests` | (등록자) 물품에 들어온 받은 요청 수락/거절 |
| `/register` | 물품 등록 (AI 소비기한 인식 · 정원 스텝퍼 · 사진) |
| `/requests` | 거래내역 (받은 요청 / 보낸 요청 탭) |
| `/chat`, `/chat/[roomId]` | 채팅 목록 · 채팅방 |
| `/mypage` | 마이페이지 (프로필 · 통계 · 메뉴 · 로그아웃/탈퇴) |
| `/mypage/foods` | 내 등록 물품 |
| `/mypage/edit` | 회원정보 수정 (닉네임 중복확인 · 주소 검색) |

> **채팅**: 백엔드 명세에는 채팅방 생성/목록/이전 메시지 조회만 있고 '메시지 전송' 엔드포인트가
> 없어, 목록·이전 메시지는 실제 API로 표시하되 메시지 전송은 화면상(로컬)에서만 반영됩니다.
> 전송 API가 명세에 추가되면 `ChatRoomScreen`의 `send()`만 연결하면 됩니다.

## API 연동

API 호출 레이어는 `lib/api.js`에 있으며, v3 명세를 그대로 매핑합니다.

- 인증: Spring Session 쿠키 (`credentials: "include"`)
- 성공 응답: `{ code, data, message }` envelope → `data` 언랩
- 실패 응답: RFC 7807 `ProblemDetail` → `Error(code, status)` throw

> **이 앱은 실제 API 데이터만 사용합니다(mock 폴백 없음).** 로그인은 실제 인증을 거치고,
> 헤더의 로그인 상태는 `GET /members/me` 결과로 표시됩니다. 서버 연결/CORS가 실패하면
> 각 화면에 로딩·에러·빈 상태 UI가 그대로 노출되어 연동 여부를 바로 확인할 수 있습니다.

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

# 냠냠 · 음식 나눔 서비스 (Frontend)

미개봉 가공식품을 동네 이웃과 나누는 음식 나눔 서비스의 프론트엔드입니다.
[`food_shared_service`](https://github.com/foodsharedservice) 백엔드 API 명세(v3)와 제공된 Hi-fi 디자인을 기반으로 구현했습니다.

- **Framework**: Next.js 14 (App Router)
- **Language**: JavaScript (JSX) + React 18
- **Styling**: 디자인 시스템 CSS (`app/globals.css`) — 별도 UI 라이브러리 없음
- **Fonts**: Pretendard(본문) / Inter · JetBrains Mono(숫자·라벨)
- **Deploy**: Vercel

## 화면 (Design codes)

| 코드 | 경로 | 화면 |
|------|------|------|
| D-00 | `/login` | 로그인 |
| D-07 | `/signup` | 회원가입 (이메일 인증 · 닉네임 중복확인 · 비밀번호 규칙) |
| D-01 | `/` | 홈 피드 (물품 목록 · 상태 필터) |
| D-02 | `/foods/[foodId]` | 물품 상세 (이미지 캐러셀 · 나눔 요청 모달 · 채팅) |
| D-04 | `/register` | 물품 등록 (AI 소비기한 인식 · 사진 · 정원 스텝퍼) |
| D-05 | (헤더 🔔) | 알림 드롭다운 (받은 요청 수락/거절 · 내 요청 결과) |
| D-06 | `/transaction` | 거래 정보 (픽업 조율) |
| D-08 | `/mypage` | 마이페이지 (내 물품 · 프로필 · 로그아웃/탈퇴) |

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

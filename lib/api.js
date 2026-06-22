/* lib/api.js — 실배포 백엔드(food_shared_serivce) REST API 매핑 레이어
   Base: NEXT_PUBLIC_API_BASE (기본 https://api.foodshare.click/api/v1)
   인증: Spring Session 쿠키(JSESSIONID) → 모든 요청 credentials: "include"
   성공: { code, data, message } envelope → data 언랩 (204는 본문 없음 → null)
   실패: RFC7807 ProblemDetail { title(=ErrorCode), status, detail } → Error(code,status) throw

   ⚠️ 이 파일은 실제 배포된 백엔드 컨트롤러 명세에 1:1로 맞춰져 있습니다.
   (이전의 가상 v3 명세가 아니라, /api/v1/** 실제 엔드포인트 기준) */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://api.foodshare.click/api/v1";

/* WebSocket(STOMP) 베이스 — REST 베이스에서 호스트만 추출해 /ws 로 연결.
   예) https://api.foodshare.click/api/v1 → wss://api.foodshare.click/ws */
function deriveWsUrl(base) {
  try {
    const u = new URL(base);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}/ws`;
  } catch {
    return "wss://api.foodshare.click/ws";
  }
}
const WS_URL = deriveWsUrl(API_BASE);

async function apiRequest(method, path, opts = {}) {
  const { json, body, headers } = opts;
  const init = { method, credentials: "include", headers: { ...(headers || {}) } };
  if (json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (body !== undefined) {
    init.body = body; // FormData(multipart) — Content-Type 자동 설정
  }

  const res = await fetch(API_BASE + path, init);

  if (res.status === 204) return null; // No Content (삭제/수락/거절/취소 등)

  const ct = res.headers.get("content-type") || "";
  const payload = ct.includes("json") ? await res.json() : null;

  if (!res.ok) {
    // ProblemDetail: { type, title, status, detail, instance }
    const err = new Error((payload && payload.detail) || res.statusText);
    err.code = payload && payload.title; // 예: FOOD_NOT_AVAILABLE
    err.status = res.status;
    throw err;
  }
  return payload ? payload.data : null; // envelope 언랩
}

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.append(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const MAX_PAGE_SIZE = 50; // 백엔드 제한

const API = {
  base: API_BASE,
  wsUrl: WS_URL,

  auth: {
    // POST /auth/email/send  { email } → { expiresIn }
    sendEmailCode: (email) =>
      apiRequest("POST", "/auth/email/send", { json: { email } }),
    // POST /auth/email/verify  { email, code } → { verified, emailVerifyToken }
    verifyEmailCode: (email, code) =>
      apiRequest("POST", "/auth/email/verify", { json: { email, code } }),
    // POST /auth/login  { email, password } → { memberId, nickName }
    login: (email, password) =>
      apiRequest("POST", "/auth/login", { json: { email, password } }),
    // POST /auth/logout → null
    logout: () => apiRequest("POST", "/auth/logout"),
  },

  members: {
    // GET /members/nickname/check?nickName= → { available }
    checkNickname: (nickName) =>
      apiRequest("GET", `/members/nickname/check${qs({ nickName })}`),
    // POST /members  { email, emailVerifyToken, password, nickName, address } → { memberId }
    signup: ({ email, emailVerifyToken, password, nickName, address }) =>
      apiRequest("POST", "/members", {
        json: { email, emailVerifyToken, password, nickName, address },
      }),
    // GET /members/me → { memberId, email, nickName, address, createdAt }
    me: () => apiRequest("GET", "/members/me"),
    // PATCH /members/me  { nickName?, address? } → MemberInfoResponse
    update: ({ nickName, address }) => {
      const body = {};
      if (nickName !== undefined) body.nickName = nickName;
      if (address !== undefined) body.address = address;
      return apiRequest("PATCH", "/members/me", { json: body });
    },
    // DELETE /members/me → null (회원 탈퇴, 세션 무효화)
    remove: () => apiRequest("DELETE", "/members/me"),
  },

  foods: {
    // GET /foods?page=&size=&sort=  → PageResponse<FoodListResponse>
    //   sort: "foodId,desc" | "expired,asc" | "capacity,desc" (허용 필드만)
    list: ({ page = 0, size = 20, sort } = {}) =>
      apiRequest(
        "GET",
        `/foods${qs({ page, size: Math.min(size, MAX_PAGE_SIZE), sort })}`
      ),

    // GET /foods/{foodId} → FoodDetailResponse
    //   { foodId, memberId, foodName, details, capacity, approvedCount, statusTx, expired, region, imageUrls[] }
    detail: (foodId) => apiRequest("GET", `/foods/${foodId}`),

    // POST /foods (multipart: request(JSON) + file) → { foodId }
    //   소비기한은 서버가 file(대표 사진)을 AI 분석해 자동 설정한다.
    create: ({ foodName, capacity, details, region }, file) => {
      const fd = new FormData();
      fd.append(
        "request",
        new Blob([JSON.stringify({ foodName, capacity, details, region })], {
          type: "application/json",
        })
      );
      fd.append("file", file);
      return apiRequest("POST", "/foods", { body: fd });
    },

    // POST /foods/expired-date/{foodId} (multipart: file) → imageId (추가 사진 업로드)
    uploadImage: (foodId, file) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiRequest("POST", `/foods/expired-date/${foodId}`, { body: fd });
    },

    // DELETE /foods/{foodId} → null (소프트 삭제)
    remove: (foodId) => apiRequest("DELETE", `/foods/${foodId}`),
  },

  requests: {
    // POST /foods/{foodId}/requests (no body) → { requestFoodId }
    create: (foodId) => apiRequest("POST", `/foods/${foodId}/requests`),
    // GET /foods/{foodId}/requests/me → { requestFoodId, status }  (없으면 404)
    myForFood: (foodId) => apiRequest("GET", `/foods/${foodId}/requests/me`),
    // GET /foods/{foodId}/requests → [{ requestFoodId, memberId, status }]  (등록자만)
    received: (foodId) => apiRequest("GET", `/foods/${foodId}/requests`),
    // PATCH /foods/{foodId}/requests/{requestId}/approve → null
    approve: (foodId, requestId) =>
      apiRequest("PATCH", `/foods/${foodId}/requests/${requestId}/approve`),
    // PATCH /foods/{foodId}/requests/{requestId}/reject → null
    reject: (foodId, requestId) =>
      apiRequest("PATCH", `/foods/${foodId}/requests/${requestId}/reject`),
    // DELETE /foods/{foodId}/requests/{requestId} → null (내 신청 취소)
    cancel: (foodId, requestId) =>
      apiRequest("DELETE", `/foods/${foodId}/requests/${requestId}`),
  },

  chat: {
    // POST /chat/rooms { foodId } → { roomId, foodId, created }  (201 신규 / 200 기존)
    createRoom: (foodId) => apiRequest("POST", "/chat/rooms", { json: { foodId } }),
    // GET /members/me/chat/rooms → [{ roomId, foodId, foodName, partnerNickName, lastMessage, lastMessageAt, unreadCount }]
    myRooms: () => apiRequest("GET", "/members/me/chat/rooms"),
    // GET /chat/rooms/{roomId}/messages?cursor=&size= → { messages[], nextCursor, hasNext }
    history: (roomId, { cursor, size = 30 } = {}) =>
      apiRequest("GET", `/chat/rooms/${roomId}/messages${qs({ cursor, size })}`),
  },
};

export default API;

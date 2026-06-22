/* lib/api.js — 실제 백엔드(food_shared_serivce) API 매핑 레이어
   Base: NEXT_PUBLIC_API_BASE (기본 https://api.foodshare.click/api/v1)
   인증: 서버 세션 쿠키(Redis) → 모든 요청 credentials: "include"
   성공: { code, data, message } envelope → data 언랩
   실패: RFC7807 ProblemDetail { title(=code), status, detail } → Error(code,status) throw

   ※ 이 파일의 모든 경로/필드는 백엔드 컨트롤러·DTO와 1:1로 검증되었습니다.
   존재하지 않는 엔드포인트(mock)는 두지 않습니다. */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://api.foodshare.click/api/v1";

async function apiRequest(method, path, opts = {}) {
  const { json, body, headers } = opts;
  const init = { method, credentials: "include", headers: { ...(headers || {}) } };
  if (json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (body !== undefined) {
    init.body = body; // FormData(multipart) — Content-Type 자동 지정
  }

  let res;
  try {
    res = await fetch(API_BASE + path, init);
  } catch (e) {
    const err = new Error("서버에 연결할 수 없어요. 네트워크를 확인해주세요.");
    err.code = "NETWORK_ERROR";
    err.status = 0;
    throw err;
  }

  const ct = res.headers.get("content-type") || "";
  const payload = ct.includes("json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    // ProblemDetail: { type, title, status, detail, instance }
    const err = new Error((payload && (payload.detail || payload.message)) || res.statusText);
    err.code = payload && payload.title; // 예: FOOD_REQUEST_ALREADY_EXISTS
    err.status = res.status;
    throw err;
  }
  // 204 No Content 등 본문 없음 → null
  return payload ? payload.data : null;
}

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.append(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const API = {
  base: API_BASE,

  /* ===================== AUTH ===================== */
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
    // POST /auth/logout
    logout: () => apiRequest("POST", "/auth/logout"),
  },

  /* ===================== MEMBER ===================== */
  members: {
    // GET /members/nickname/check?nickName= → { available }
    checkNickname: (nickName) =>
      apiRequest("GET", `/members/nickname/check${qs({ nickName })}`),
    // POST /members  { email, emailVerifyToken, password, nickName, address:{roadAddress, detailAddress} } → { memberId }
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
    // DELETE /members/me (회원 탈퇴)
    remove: () => apiRequest("DELETE", "/members/me"),
  },

  /* ===================== FOODS ===================== */
  foods: {
    // GET /foods?page=&size=&sort=  → PageResponse<FoodListResponse>
    //   sort: "foodId,desc" | "expired,asc" | "capacity,desc" 등 (foodId|expired|capacity)
    list: ({ page = 0, size = 20, sort } = {}) =>
      apiRequest("GET", `/foods${qs({ page, size, sort })}`),

    // GET /foods/{foodId} → FoodDetailResponse
    //   { foodId, memberId, foodName, details, capacity, approvedCount, statusTx, expired, region, imageUrls[] }
    detail: (foodId) => apiRequest("GET", `/foods/${foodId}`),

    // POST /foods (multipart: request(JSON) + file) → { foodId }
    //   request = { foodName, capacity, details, region? }
    //   file = 소비기한이 보이는 사진 1장 (서버가 AI로 소비기한을 읽어 자동 설정)
    create: ({ foodName, capacity, details, region, file }) => {
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

    // POST /foods/expired-date/{foodId} (multipart: file) → imageId  (소비기한 추가 사진)
    uploadExpiredImage: (foodId, file) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiRequest("POST", `/foods/expired-date/${foodId}`, { body: fd });
    },

    // DELETE /foods/{foodId} (등록자만)
    remove: (foodId) => apiRequest("DELETE", `/foods/${foodId}`),
  },

  /* ===================== FOOD REQUESTS (나눔 신청) =====================
     모든 경로는 /foods/{foodId}/requests 하위. */
  requests: {
    // POST /foods/{foodId}/requests → { requestFoodId }
    create: (foodId) => apiRequest("POST", `/foods/${foodId}/requests`),
    // GET /foods/{foodId}/requests/me → { requestFoodId, status }  (내 신청 상태)
    mine: (foodId) => apiRequest("GET", `/foods/${foodId}/requests/me`),
    // GET /foods/{foodId}/requests → [{ requestFoodId, memberId, status }]  (등록자만)
    received: (foodId) => apiRequest("GET", `/foods/${foodId}/requests`),
    // PATCH /foods/{foodId}/requests/{requestId}/approve  (등록자만)
    approve: (foodId, requestId) =>
      apiRequest("PATCH", `/foods/${foodId}/requests/${requestId}/approve`),
    // PATCH /foods/{foodId}/requests/{requestId}/reject  (등록자만)
    reject: (foodId, requestId) =>
      apiRequest("PATCH", `/foods/${foodId}/requests/${requestId}/reject`),
    // DELETE /foods/{foodId}/requests/{requestId}  (신청자 본인 취소)
    cancel: (foodId, requestId) =>
      apiRequest("DELETE", `/foods/${foodId}/requests/${requestId}`),
  },

  /* ===================== CHAT ===================== */
  chat: {
    // POST /chat/rooms { foodId } → { roomId, foodId, created }
    createRoom: (foodId) =>
      apiRequest("POST", "/chat/rooms", { json: { foodId } }),
    // GET /members/me/chat/rooms → [{ roomId, foodId, foodName, partnerNickName, lastMessage, lastMessageAt, unreadCount }]
    myRooms: () => apiRequest("GET", "/members/me/chat/rooms"),
    // GET /chat/rooms/{roomId}/messages?cursor=&size= → { messages[], nextCursor, hasNext }
    //   messages: [{ messageId, senderId, senderNickName, content, mine, createdAt }] (최신→과거)
    history: (roomId, { cursor, size = 30 } = {}) =>
      apiRequest("GET", `/chat/rooms/${roomId}/messages${qs({ cursor, size })}`),
  },
};

export default API;

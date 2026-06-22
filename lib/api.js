/* lib/api.js — v3 API 매핑 레이어
   Base: NEXT_PUBLIC_API_BASE (기본 https://api.foodshare.click/api/v1)
   인증: Spring Session 쿠키 → 모든 요청 credentials: "include"
   성공: { code, data, message } envelope → data 언랩
   실패: RFC7807 ProblemDetail { title(=code), status, detail } → Error(code,status) throw
   ───────────────────────────────────────────────────────────
   백엔드(또는 CORS)가 준비되지 않은 환경에서는 네트워크 호출이 실패할 수 있습니다.
   각 화면은 이 모듈을 호출하되, 실패 시 목(mock) 데이터로 폴백합니다. */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://api.foodshare.click/api/v1";

async function apiRequest(method, path, opts = {}) {
  const { json, body, headers } = opts;
  const init = { method, credentials: "include", headers: { ...(headers || {}) } };
  if (json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (body !== undefined) {
    init.body = body; // FormData (multipart) — Content-Type 자동
  }
  const res = await fetch(API_BASE + path, init);
  const ct = res.headers.get("content-type") || "";
  const payload = ct.includes("json") ? await res.json() : null;
  if (!res.ok) {
    // ProblemDetail: { title, status, detail }
    const err = new Error((payload && payload.detail) || res.statusText);
    err.code = payload && payload.title; // 예: REQUEST_DUPLICATED
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

const API = {
  base: API_BASE,

  auth: {
    // POST /auth/email/send  { email } → { expiresIn }   (D-07 코드 발송)
    sendEmailCode: (email) =>
      apiRequest("POST", "/auth/email/send", { json: { email } }),
    // POST /auth/email/verify  { email, code } → { verified, emailVerifyToken }
    verifyEmailCode: (email, code) =>
      apiRequest("POST", "/auth/email/verify", { json: { email, code } }),
    // POST /auth/login  { email, password } → { memberId, nickName }   (D-00)
    login: (email, password) =>
      apiRequest("POST", "/auth/login", { json: { email, password } }),
    // POST /auth/logout
    logout: () => apiRequest("POST", "/auth/logout"),
  },

  members: {
    // GET /members/nickname/check?nickName= → { available }   (D-07 중복확인)
    checkNickname: (nickName) =>
      apiRequest("GET", `/members/nickname/check${qs({ nickName })}`),
    // POST /members  { email, emailVerifyToken, password, nickName, address } → { memberId }
    signup: ({ email, emailVerifyToken, password, nickName, address }) =>
      apiRequest("POST", "/members", {
        json: { email, emailVerifyToken, password, nickName, address },
      }),
    // GET /members/me → { memberId, email, nickName, address, createdAt }   (D-08)
    me: () => apiRequest("GET", "/members/me"),
    // PATCH /members/me  { nickName?, address? }   (D-08 정보 수정)
    update: ({ nickName, address }) => {
      const body = {};
      if (nickName !== undefined) body.nickName = nickName;
      if (address !== undefined) body.address = address;
      return apiRequest("PATCH", "/members/me", { json: body });
    },
    // DELETE /members/me → soft delete (회원 탈퇴)   (D-08)
    remove: () => apiRequest("DELETE", "/members/me"),
    // GET /members/me/foods → 내 등록 물품   (D-08)
    myFoods: () => apiRequest("GET", "/members/me/foods"),
  },

  foods: {
    // GET /foods?status=&page=&size=  (D-01)
    list: ({ status, page = 0, size = 20 } = {}) =>
      apiRequest("GET", `/foods${qs({ status, page, size })}`),

    // GET /foods/{foodId}  (D-02)
    detail: (foodId) => apiRequest("GET", `/foods/${foodId}`),

    // POST /foods/expired-date  (D-04 STEP1) — multipart: expiredImage
    // → { expired }   (AI 인식 날짜만 반환, 사진은 저장하지 않는 미리보기)
    recognizeExpiry: (file) => {
      const fd = new FormData();
      fd.append("expiredImage", file);
      return apiRequest("POST", "/foods/expired-date", { body: fd });
    },

    // POST /foods  (D-04 등록) — multipart: request(JSON, expired 포함) + expiredImage(EXPIRED) + images[](BASIC)
    create: ({ foodName, capacity, details, expired, expiredImage, images = [] }) => {
      const fd = new FormData();
      fd.append(
        "request",
        new Blob(
          [JSON.stringify({ foodName, capacity, details, expired })],
          { type: "application/json" }
        )
      );
      if (expiredImage) fd.append("expiredImage", expiredImage);
      images.forEach((f) => fd.append("images", f));
      return apiRequest("POST", "/foods", { body: fd });
    },

    // PATCH /foods/{foodId}  — multipart: request(JSON) + images[]
    update: (
      foodId,
      { foodName, capacity, details, expiredImageId, deleteImageIds, images = [] }
    ) => {
      const fd = new FormData();
      const req = { foodName, capacity, details };
      if (expiredImageId !== undefined) req.expiredImageId = expiredImageId;
      if (deleteImageIds !== undefined) req.deleteImageIds = deleteImageIds;
      fd.append("request", new Blob([JSON.stringify(req)], { type: "application/json" }));
      images.forEach((f) => fd.append("images", f));
      return apiRequest("PATCH", `/foods/${foodId}`, { body: fd });
    },

    // DELETE /foods/{foodId} → status_tx = INCOMPLETE (soft delete)
    remove: (foodId) => apiRequest("DELETE", `/foods/${foodId}`),
  },

  requests: {
    // POST /foods/{foodId}/requests  (no body) → { requestFoodId, status:"REQUEST" }
    create: (foodId) => apiRequest("POST", `/foods/${foodId}/requests`),
    // GET /foods/{foodId}/requests → 받은 요청 목록 (D-05 "받은 요청")
    received: (foodId) => apiRequest("GET", `/foods/${foodId}/requests`),
    // PATCH /requests/{requestFoodId}/approve → { status:"APPROVED", foodStatusTx }
    approve: (requestFoodId) =>
      apiRequest("PATCH", `/requests/${requestFoodId}/approve`),
    // PATCH /requests/{requestFoodId}/reject → { status:"REJECTED" }
    reject: (requestFoodId) =>
      apiRequest("PATCH", `/requests/${requestFoodId}/reject`),
    // GET /members/me/requests → 내가 보낸 요청 (D-05 "내 요청 결과")
    mine: () => apiRequest("GET", "/members/me/requests"),
  },

  chat: {
    // POST /chat/rooms { foodId } → { roomId, foodId, created }  (D-02 채팅하기)
    createRoom: (foodId) => apiRequest("POST", "/chat/rooms", { json: { foodId } }),
    // GET /members/me/chat/rooms
    myRooms: () => apiRequest("GET", "/members/me/chat/rooms"),
    // GET /chat/rooms/{roomId}/messages?cursor=&size=
    history: (roomId, { cursor, size = 20 } = {}) =>
      apiRequest("GET", `/chat/rooms/${roomId}/messages${qs({ cursor, size })}`),
  },

  images: {
    // DELETE /images/{imageId} (soft delete)
    remove: (imageId) => apiRequest("DELETE", `/images/${imageId}`),
  },
};

export default API;

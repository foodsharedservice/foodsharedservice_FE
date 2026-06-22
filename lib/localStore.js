/* lib/localStore.js — 클라이언트 보조 저장소

   백엔드에는 "내가 등록한 물품 목록" 엔드포인트가 없습니다.
   (GET /foods 목록 응답에는 memberId가 없어 소유자 식별 불가)
   따라서 등록 시점에 내가 만든 foodId를 회원별로 localStorage에 기록해 두고,
   마이페이지 / 알림(받은 요청)에서 GET /foods/{foodId} 로 상세를 채워 보여줍니다.
   서버에서 삭제된 물품은 상세 조회 404로 자연스럽게 걸러집니다. */

const KEY = (memberId) => `nyam:myFoods:${memberId ?? "guest"}`;

function read(memberId) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY(memberId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(memberId, ids) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(memberId), JSON.stringify(ids));
  } catch {
    /* quota 등 무시 */
  }
}

export function getMyFoodIds(memberId) {
  return read(memberId);
}

export function trackMyFood(memberId, foodId) {
  const id = Number(foodId);
  if (!id) return;
  const ids = read(memberId);
  if (!ids.includes(id)) write(memberId, [id, ...ids]);
}

export function untrackMyFood(memberId, foodId) {
  const id = Number(foodId);
  write(
    memberId,
    read(memberId).filter((x) => x !== id)
  );
}

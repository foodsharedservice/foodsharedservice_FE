/* lib/foodUi.js — 화면 공용 표시 헬퍼 (순수 함수)
   API 필드(statusTx, request status, expired 등)를 새 모바일 디자인의
   라벨/색상/요약 텍스트로 변환한다. API 명세는 건드리지 않는다. */

/* 물품 상태(statusTx) → 라벨/배지 색 */
export function statusMeta(s) {
  if (s === "IN_PROGRESS") return { label: "나눔중", bg: "#E7F3EC", fg: "#2E9E5B" };
  if (s === "COMPLETED") return { label: "나눔완료", bg: "#EFEDEA", fg: "#8A837C" };
  if (s === "EXPIRED") return { label: "기한만료", bg: "#FBE9E4", fg: "#C9472F" };
  return { label: "나눔취소", bg: "#EFEDEA", fg: "#8A837C" }; // INCOMPLETE 등
}

/* 요청 상태(REQUEST/APPROVED/REJECTED) → 라벨/배지 색 */
export function reqMeta(s) {
  if (s === "REQUEST") return { label: "대기중", bg: "#FBEDE2", fg: "#C16321" };
  if (s === "APPROVED") return { label: "수락됨", bg: "#E7F3EC", fg: "#2E9E5B" };
  return { label: "거절됨", bg: "#FBE9E4", fg: "#C9472F" }; // REJECTED
}

/* "2025-12-31" → "2025.12.31" */
export function fmtDate(d) {
  return (d || "").slice(0, 10).replace(/-/g, ".");
}

/* 소비기한까지 남은 일수 → "D-12" / "D-DAY" / "D+3" */
export function dDayLabel(expired) {
  if (!expired) return "";
  const diff = Math.ceil((new Date(expired) - new Date()) / 86400000);
  if (diff < 0) return `D+${Math.abs(diff)}`;
  if (diff === 0) return "D-DAY";
  return `D-${diff}`;
}

/* 모집 현황 텍스트 */
export function capText(approved, capacity, withSuffix = true) {
  return `${approved || 0}/${capacity || 0}명${withSuffix ? " 모집" : ""}`;
}

/* 남은 자리 텍스트 */
export function remainText(approved, capacity) {
  const left = (capacity || 0) - (approved || 0);
  return left > 0 ? `${left}자리 남음` : "마감";
}

/* 모집 진행률(%) */
export function progressPct(approved, capacity) {
  if (!capacity) return "0%";
  return `${Math.min(100, Math.round(((approved || 0) / capacity) * 100))}%`;
}

/* 이미지가 없을 때 placeholder 타일 색 (이름 기반 결정적 선택) */
const TILE_PALETTE = [
  ["#F3E2D3", "#B07A4F"],
  ["#E7E9DD", "#7C8567"],
  ["#F1DED9", "#B5705F"],
  ["#EDE6D6", "#9A8A5E"],
  ["#E5E0E8", "#7E7591"],
  ["#EBE3D5", "#9C8A66"],
  ["#E7EAE0", "#7E8A6B"],
  ["#EFE7DA", "#A98F66"],
];
export function tileColors(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [bg, fg] = TILE_PALETTE[h % TILE_PALETTE.length];
  return { bg, fg };
}

/* placeholder 타일에 표시할 짧은 라벨 (이름 앞 글자) */
export function shortLabel(name = "") {
  const t = (name || "").trim().replace(/\s+/g, "");
  return t.slice(0, 3) || "냠";
}

/* 이름 이니셜 (아바타용) */
export function initialOf(name = "") {
  return (name || "?").trim().charAt(0) || "?";
}

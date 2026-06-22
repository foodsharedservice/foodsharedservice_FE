"use client";

/* DetailScreen.jsx — 물품 상세
   API: GET /foods/{foodId}
        POST /foods/{foodId}/requests  (나눔 요청)
        POST /chat/rooms { foodId }     (채팅 시작) */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Avatar, Thumb, StateBox, ScreenHeader } from "@/components/ui";
import { fmtDate, capText, progressPct, statusMeta } from "@/lib/foodUi";
import API from "@/lib/api";

export default function DetailScreen({ foodId }) {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    API.foods.detail(foodId)
      .then((data) => { if (alive) { setD(data); setIdx(0); setRequested(!!(data && (data.requested || data.alreadyRequested))); } })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [foodId]);

  useEffect(() => load(), [load]);

  if (loading) {
    return <div><ScreenHeader onBack={() => router.back()} title="" /><StateBox kind="loading" title="물품 정보를 불러오는 중…" /></div>;
  }
  if (error || !d) {
    const notFound = error && error.status === 404;
    return (
      <div>
        <ScreenHeader onBack={() => router.push("/")} title="" />
        <StateBox kind="error" title={notFound ? "존재하지 않는 물품이에요" : "물품 정보를 불러오지 못했어요"} sub={notFound ? "삭제되었거나 잘못된 주소일 수 있어요." : `서버에 연결할 수 없습니다. (${(error && (error.code || error.status || error.message)) || "네트워크 오류"})`} onRetry={notFound ? undefined : load} />
      </div>
    );
  }

  const images = (d.images || []).filter((im) => im && im.accessUrl);
  const cur = images[idx] || images[0];
  const m = statusMeta(d.statusTx);
  const mine = !!(d.isOwner || (user && d.ownerNickName && user.nickName === d.ownerNickName));
  const available = d.statusTx === "IN_PROGRESS" && (d.approvedCount || 0) < (d.capacity || 0);

  const submitRequest = () => {
    if (busy) return;
    setBusy(true);
    API.requests.create(d.foodId)
      .then(() => { setRequested(true); toast.show("나눔 요청을 보냈어요 :)"); })
      .catch((e) => {
        const map = {
          REQUEST_DUPLICATED: "이미 요청한 물품이에요.",
          SELF_REQUEST_NOT_ALLOWED: "본인이 등록한 물품에는 요청할 수 없어요.",
          FOOD_NOT_AVAILABLE: "지금은 요청할 수 없는 상태예요.",
        };
        toast.show(map[e.code] || e.message || "요청에 실패했어요.");
      })
      .finally(() => setBusy(false));
  };

  const openChat = () => {
    API.chat.createRoom(d.foodId)
      .then((r) => { if (r && r.roomId) router.push(`/chat/${r.roomId}`); else router.push("/chat"); })
      .catch((e) => {
        const map = {
          SELF_CHAT_NOT_ALLOWED: "본인 물품에는 채팅할 수 없어요.",
          FOOD_NOT_AVAILABLE: "지금은 채팅방을 만들 수 없는 상태예요.",
        };
        toast.show(map[e.code] || "채팅방을 열지 못했어요.");
      });
  };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 8px", position: "sticky", top: 0, zIndex: 20, background: "rgba(251,250,248,.9)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => router.back()} aria-label="뒤로" style={hdrBtn}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F1D1B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      </div>

      {/* 이미지 */}
      <div style={{ width: "100%", aspectRatio: "4/3" }}>
        <Thumb src={cur && cur.accessUrl} name={d.foodName} radius={0} fontSize={18} style={{ width: "100%", height: "100%" }} />
      </div>
      {images.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "12px 0 4px" }}>
          {images.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`사진 ${i + 1}`} style={{ width: 7, height: 7, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", background: i === idx ? "var(--ac)" : "#DED8D1" }} />
          ))}
        </div>
      )}

      <div style={{ padding: "14px 18px 6px" }}>
        {/* 등록자 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={d.ownerNickName} size={42} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{d.ownerNickName || "이웃"}</div>
            <div style={{ fontSize: 12.5, color: "#9A938C" }}>등록자</div>
          </div>
        </div>

        <div style={{ height: 1, background: "#F0ECE6", margin: "16px 0" }} />

        <h1 style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.32, margin: 0 }}>{d.foodName}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 9px", borderRadius: 8, background: m.bg, color: m.fg }}>{m.label}</span>
          {d.createdAt && <span style={{ fontSize: 13, color: "#9A938C" }}>등록일 {fmtDate(d.createdAt)}</span>}
        </div>

        {/* 정보 박스 */}
        <div style={{ background: "#F7F3EE", borderRadius: 14, padding: 16, marginTop: 18, display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13.5, color: "#6B6560", fontWeight: 600 }}>소비기한</span>
            <span style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#1FA85C", background: "#E8F6EC", padding: "2px 6px", borderRadius: 6 }}>AI 인식</span>
              {fmtDate(d.expired)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13.5, color: "#6B6560", fontWeight: 600 }}>모집 현황</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{capText(d.approvedCount, d.capacity)}</span>
          </div>
          <div style={{ height: 8, background: "#E9E3DB", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: progressPct(d.approvedCount, d.capacity), background: "var(--ac)", borderRadius: 999 }} />
          </div>
        </div>

        {d.details && <p style={{ fontSize: 15, lineHeight: 1.65, color: "#37332E", margin: "20px 0", whiteSpace: "pre-wrap" }}>{d.details}</p>}
      </div>
      <div style={{ height: 96 }} />

      {/* 하단 액션 바 */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EEE9E3", padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", display: "flex", gap: 10, zIndex: 40 }}>
        {mine ? (
          <>
            <button onClick={() => toast.show("물품 수정은 준비 중이에요")} style={outlineBtn}>수정</button>
            <button onClick={() => router.push(`/foods/${d.foodId}/requests`)} style={primaryBtn}>받은 요청 보기</button>
          </>
        ) : requested ? (
          <>
            <button onClick={openChat} style={outlineBtn}>채팅</button>
            <button disabled style={disabledBtn}>요청 완료 ✓</button>
          </>
        ) : available ? (
          <>
            <button onClick={openChat} style={outlineBtn}>채팅</button>
            <button onClick={submitRequest} disabled={busy} style={primaryBtn}>{busy ? "요청 중…" : "나눔 요청하기"}</button>
          </>
        ) : (
          <button disabled style={{ ...disabledBtn, flex: 1 }}>나눔이 마감되었어요</button>
        )}
      </div>
    </div>
  );
}

const hdrBtn = { width: 40, height: 40, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" };
const outlineBtn = { flex: "none", padding: "14px 18px", borderRadius: 13, border: "1.5px solid #E5DFD8", background: "#fff", color: "#1F1D1B", fontWeight: 700, fontSize: 15, cursor: "pointer" };
const primaryBtn = { flex: 1, padding: 14, borderRadius: 13, border: "none", background: "var(--ac)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" };
const disabledBtn = { flex: 1, padding: 14, borderRadius: 13, border: "none", background: "#F1ECE6", color: "#9A938C", fontWeight: 800, fontSize: 16, cursor: "default" };

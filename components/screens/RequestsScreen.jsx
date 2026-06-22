"use client";

/* RequestsScreen.jsx — 거래내역 (받은 요청 / 보낸 요청)
   받은 요청: GET /members/me/foods → 각 물품 GET /foods/{id}/requests (명세에 통합 알림 없음 → 클라 집계)
   보낸 요청: GET /members/me/requests
   수락/거절: PATCH /requests/{id}/approve | reject */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Avatar, Thumb, ReqBadge, StateBox } from "@/components/ui";
import API from "@/lib/api";

export default function RequestsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("received");
  const [received, setReceived] = useState(null);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);

  const loadReceived = useCallback(async () => {
    setError(null);
    try {
      const foods = (await API.members.myFoods()) || [];
      const active = foods.filter((f) => f.statusTx === "IN_PROGRESS");
      const lists = await Promise.all(
        active.map((f) =>
          API.requests.received(f.foodId)
            .then((rs) => (rs || []).map((r) => ({ ...r, foodId: f.foodId, foodName: f.foodName })))
            .catch(() => [])
        )
      );
      setReceived(lists.flat());
    } catch (e) {
      setError(e);
      setReceived([]);
    }
  }, []);

  const loadSent = useCallback(async () => {
    try {
      setSent((await API.requests.mine()) || []);
    } catch {
      setSent([]);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    loadReceived();
    loadSent();
  }, [authLoading, user, router, loadReceived, loadSent]);

  const approve = (r) => {
    API.requests.approve(r.requestFoodId)
      .then(() => toast.show("요청을 수락했어요"))
      .catch(() => toast.show("처리에 실패했어요"));
    setReceived((prev) => (prev || []).map((x) => (x.requestFoodId === r.requestFoodId ? { ...x, status: "APPROVED" } : x)));
  };
  const reject = (r) => {
    API.requests.reject(r.requestFoodId)
      .then(() => toast.show("요청을 거절했어요"))
      .catch(() => toast.show("처리에 실패했어요"));
    setReceived((prev) => (prev || []).map((x) => (x.requestFoodId === r.requestFoodId ? { ...x, status: "REJECTED" } : x)));
  };

  if (authLoading || !user) return null;

  return (
    <div style={{ minHeight: "100dvh" }}>
      {/* 헤더 + 세그먼트 */}
      <div style={{ padding: "16px 18px 10px", position: "sticky", top: 0, zIndex: 20, background: "rgba(251,250,248,.92)", backdropFilter: "blur(10px)" }}>
        <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>거래내역</div>
        <div style={{ display: "flex", gap: 4, background: "#F1ECE6", borderRadius: 999, padding: 4 }}>
          <Seg active={tab === "received"} onClick={() => setTab("received")}>받은 요청</Seg>
          <Seg active={tab === "sent"} onClick={() => setTab("sent")}>보낸 요청</Seg>
        </div>
      </div>

      {tab === "received" ? (
        received === null ? (
          <StateBox kind="loading" title="요청을 불러오는 중…" />
        ) : error ? (
          <StateBox kind="error" title="요청을 불러오지 못했어요" sub={`(${error.code || error.status || error.message || "네트워크 오류"})`} onRetry={loadReceived} />
        ) : received.length === 0 ? (
          <StateBox kind="empty" title="받은 요청이 없어요" sub="물품을 등록하면 이웃의 요청을 여기서 볼 수 있어요." />
        ) : (
          received.map((r) => (
            <div key={r.requestFoodId} style={rowStyle}>
              <Avatar name={r.requesterNickName} size={46} bg="rgba(31,168,92,.1)" fg="var(--ac)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{r.requesterNickName || "이웃"}</span>
                  <ReqBadge status={r.status} />
                </div>
                <div style={{ fontSize: 12.5, color: "#9A938C", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.foodName}</div>
              </div>
              {r.status === "REQUEST" && (
                <div style={{ display: "flex", gap: 6, flex: "none" }}>
                  <button onClick={() => reject(r)} style={miniGhost}>거절</button>
                  <button onClick={() => approve(r)} style={miniPrimary}>수락</button>
                </div>
              )}
            </div>
          ))
        )
      ) : sent === null ? (
        <StateBox kind="loading" title="요청을 불러오는 중…" />
      ) : sent.length === 0 ? (
        <StateBox kind="empty" title="보낸 요청이 없어요" sub="마음에 드는 나눔에 요청을 보내보세요." />
      ) : (
        sent.map((r, i) => (
          <button
            key={r.requestFoodId || i}
            onClick={() => r.foodId && router.push(`/foods/${r.foodId}`)}
            style={{ ...rowStyle, gap: 14, width: "100%", textAlign: "left", background: "transparent", cursor: r.foodId ? "pointer" : "default" }}
          >
            <Thumb src={r.thumbnailUrl} name={r.foodName} radius={12} style={{ width: 60, height: 60, flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{r.foodName || `요청 #${r.requestFoodId}`}</div>
              {r.ownerNickName && <div style={{ fontSize: 12.5, color: "#9A938C", marginTop: 4 }}>{r.ownerNickName} 님</div>}
            </div>
            <ReqBadge status={r.status} style={{ flex: "none", fontSize: 12, padding: "4px 9px", borderRadius: 8 }} />
          </button>
        ))
      )}
      <div style={{ height: 96 }} />
    </div>
  );
}

function Seg({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: 9, borderRadius: 999, border: "none", cursor: "pointer",
        fontSize: 14, fontWeight: 700,
        background: active ? "#fff" : "transparent",
        color: active ? "#1F1D1B" : "#9A938C",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,.08)" : "none",
      }}
    >
      {children}
    </button>
  );
}

const rowStyle = { display: "flex", gap: 12, padding: "16px 18px", borderBottom: "1px solid #F1ECE6", alignItems: "center" };
const miniGhost = { padding: "9px 13px", borderRadius: 10, border: "1.5px solid #E5DFD8", background: "#fff", color: "#6B6560", fontWeight: 700, fontSize: 13.5, cursor: "pointer" };
const miniPrimary = { padding: "9px 14px", borderRadius: 10, border: "none", background: "var(--ac)", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer" };

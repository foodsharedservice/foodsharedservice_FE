"use client";

/* FoodRequestsScreen.jsx — 특정 물품에 들어온 받은 요청 (등록자용)
   API: GET /foods/{foodId}/requests, GET /foods/{foodId}
        PATCH /requests/{id}/approve | reject */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { Avatar, ReqBadge, StateBox } from "@/components/ui";
import API from "@/lib/api";

export default function FoodRequestsScreen({ foodId }) {
  const router = useRouter();
  const toast = useToast();
  const [foodName, setFoodName] = useState("");
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setList(null);
    API.foods.detail(foodId).then((d) => setFoodName((d && d.foodName) || "")).catch(() => {});
    API.requests.received(foodId)
      .then((rs) => setList(rs || []))
      .catch((e) => { setError(e); setList([]); });
  }, [foodId]);

  useEffect(() => load(), [load]);

  const approve = (r) => {
    API.requests.approve(r.requestFoodId).then(() => toast.show("요청을 수락했어요")).catch(() => toast.show("처리에 실패했어요"));
    setList((prev) => (prev || []).map((x) => (x.requestFoodId === r.requestFoodId ? { ...x, status: "APPROVED" } : x)));
  };
  const reject = (r) => {
    API.requests.reject(r.requestFoodId).then(() => toast.show("요청을 거절했어요")).catch(() => toast.show("처리에 실패했어요"));
    setList((prev) => (prev || []).map((x) => (x.requestFoodId === r.requestFoodId ? { ...x, status: "REJECTED" } : x)));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 8px", position: "sticky", top: 0, zIndex: 20, background: "rgba(251,250,248,.92)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => router.back()} aria-label="뒤로" style={{ width: 40, height: 40, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F1D1B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>받은 요청</div>
      </div>
      {foodName && <div style={{ padding: "6px 18px 12px", fontSize: 14, color: "#6B6560" }}>{foodName}</div>}

      {list === null ? (
        <StateBox kind="loading" title="요청을 불러오는 중…" />
      ) : error ? (
        <StateBox kind="error" title="요청을 불러오지 못했어요" sub={`(${error.code || error.status || error.message || "네트워크 오류"})`} onRetry={load} />
      ) : list.length === 0 ? (
        <StateBox kind="empty" title="아직 들어온 요청이 없어요" />
      ) : (
        list.map((r) => (
          <div key={r.requestFoodId} style={{ display: "flex", gap: 12, padding: "16px 18px", borderBottom: "1px solid #F1ECE6", alignItems: "center" }}>
            <Avatar name={r.requesterNickName} size={46} bg="rgba(31,168,92,.1)" fg="var(--ac)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{r.requesterNickName || "이웃"}</span>
                <ReqBadge status={r.status} />
              </div>
            </div>
            {r.status === "REQUEST" && (
              <div style={{ display: "flex", gap: 6, flex: "none" }}>
                <button onClick={() => reject(r)} style={{ padding: "9px 13px", borderRadius: 10, border: "1.5px solid #E5DFD8", background: "#fff", color: "#6B6560", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>거절</button>
                <button onClick={() => approve(r)} style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "var(--ac)", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>수락</button>
              </div>
            )}
          </div>
        ))
      )}
      <div style={{ height: 40 }} />
    </div>
  );
}

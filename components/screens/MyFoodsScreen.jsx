"use client";

/* MyFoodsScreen.jsx — 내 등록 물품
   API: GET /members/me/foods, DELETE /foods/{foodId} */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Thumb, StatusBadge, StateBox } from "@/components/ui";
import { fmtDate, capText } from "@/lib/foodUi";
import API from "@/lib/api";

export default function MyFoodsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [foods, setFoods] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    API.members.myFoods()
      .then((fs) => setFoods(Array.isArray(fs) ? fs : []))
      .catch((e) => { setError(e); setFoods([]); });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    load();
  }, [authLoading, user, router, load]);

  if (authLoading || !user) return null;

  return (
    <div className="screen">
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 8px", position: "sticky", top: 0, zIndex: 20, background: "rgba(251,250,248,.92)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => router.back()} aria-label="뒤로" style={{ width: 40, height: 40, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F1D1B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>내 등록 물품</div>
      </div>

      {foods === null ? (
        <StateBox kind="loading" title="물품을 불러오는 중…" />
      ) : error ? (
        <StateBox kind="error" title="물품을 불러오지 못했어요" sub={`(${error.code || error.status || error.message || "네트워크 오류"})`} onRetry={load} />
      ) : foods.length === 0 ? (
        <StateBox kind="empty" title="아직 등록한 물품이 없어요" sub="첫 나눔을 등록해보세요." />
      ) : (
        foods.map((f) => (
          <div key={f.foodId} style={{ display: "flex", gap: 14, padding: 16, borderBottom: "1px solid #F1ECE6", alignItems: "flex-start" }}>
            <button onClick={() => router.push(`/foods/${f.foodId}`)} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", flex: "none" }}>
              <Thumb src={f.thumbnailUrl} name={f.foodName} radius={14} style={{ width: 88, height: 88 }} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <button onClick={() => router.push(`/foods/${f.foodId}`)} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "left", display: "block", width: "100%" }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.36, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{f.foodName}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
                  <StatusBadge status={f.statusTx} />
                  <span style={{ fontSize: 12.5, color: "#6B6560", fontWeight: 600 }}>{capText(f.approvedCount, f.capacity)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#B6AFA7", marginTop: 6 }}>소비기한 {fmtDate(f.expired)}</div>
              </button>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => router.push(`/foods/${f.foodId}/requests`)} style={{ padding: "7px 12px", borderRadius: 9, border: "1.5px solid #E5DFD8", background: "#fff", color: "#6B6560", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>받은 요청</button>
                {(f.statusTx === "IN_PROGRESS" || f.statusTx === "EXPIRED") && (
                  <button onClick={() => removeFood(f.foodId)} style={{ padding: "7px 12px", borderRadius: 9, border: "1.5px solid #F3CFC6", background: "#fff", color: "#C9472F", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>삭제</button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
      <div style={{ height: 60 }} />
    </div>
  );

  function removeFood(foodId) {
    if (!window.confirm("이 물품 나눔을 삭제할까요?")) return;
    API.foods.remove(foodId).then(() => toast.show("물품을 삭제했어요")).catch(() => toast.show("삭제에 실패했어요"));
    setFoods((prev) => (prev || []).map((f) => (f.foodId === foodId ? { ...f, statusTx: "INCOMPLETE" } : f)));
  }
}

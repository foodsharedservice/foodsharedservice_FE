"use client";

/* HomeScreen.jsx — 홈 피드 (마감 임박 나눔 + 더 둘러보기)
   API: GET /foods?page=&size=  (실제 데이터만 사용, 실패 시 에러 UI) */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Thumb, Avatar, StatusBadge, StateBox } from "@/components/ui";
import { fmtDate, capText, remainText, progressPct, statusMeta, initialOf } from "@/lib/foodUi";
import API from "@/lib/api";

const FILTERS = [
  ["ALL", "전체"],
  ["IN_PROGRESS", "나눔중"],
  ["COMPLETED", "나눔완료"],
  ["EXPIRED", "기한만료"],
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState("ALL");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    API.foods.list({ page: 0, size: 100 })
      .then((data) => {
        if (!alive) return;
        setRows(data && Array.isArray(data.content) ? data.content : Array.isArray(data) ? data : []);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => load(), [load]);

  const dong = (user && user.address && (user.address.roadAddress || "").split(" ").slice(-1)[0]) || "내 동네";

  const publicFoods = rows.filter((f) => f.statusTx !== "INCOMPLETE");
  const feed = publicFoods.filter((f) => filter === "ALL" || f.statusTx === filter);
  const featured = publicFoods
    .filter((f) => f.statusTx === "IN_PROGRESS")
    .sort((a, b) => new Date(a.expired) - new Date(b.expired))
    .slice(0, 6);

  return (
    <div style={{ minHeight: "100dvh" }}>
      {/* ===== 상단 헤더 ===== */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 10px", position: "sticky", top: 0, zIndex: 20, background: "rgba(251,250,248,.88)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="2.6" /></svg>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{dong}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/requests")} aria-label="알림" style={iconCircle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3E3A36" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          </button>
        </div>
      </div>

      {/* ===== 상태 필터 ===== */}
      <div style={{ display: "flex", gap: 8, padding: "2px 18px 14px", overflowX: "auto" }}>
        {FILTERS.map(([k, label]) => {
          const active = filter === k;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{
                flex: "none", whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 999,
                border: `1px solid ${active ? "var(--ac)" : "#E5DFD8"}`,
                background: active ? "var(--ac)" : "#fff",
                color: active ? "#fff" : "#6B6560",
                fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                boxShadow: active ? "0 4px 12px rgba(31,168,92,.28)" : "none",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <StateBox kind="loading" title="물품을 불러오는 중…" />
      ) : error ? (
        <StateBox kind="error" title="물품을 불러오지 못했어요" sub={`서버에 연결할 수 없습니다. (${error.code || error.status || error.message || "네트워크 오류"})`} onRetry={load} />
      ) : (
        <>
          {/* ===== 마감 임박 나눔 ===== */}
          {featured.length > 0 && (
            <div>
              <SectionTitle title="마감 임박 나눔" count={featured.length} />
              <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "0 18px 8px", scrollSnapType: "x mandatory" }}>
                {featured.map((f) => (
                  <FeaturedCard key={f.foodId} item={f} onClick={() => router.push(`/foods/${f.foodId}`)} />
                ))}
                <div style={{ flex: "none", width: 4 }} />
              </div>
            </div>
          )}

          {/* ===== 더 둘러보기 ===== */}
          <div>
            <SectionTitle title="더 둘러보기" count={feed.length} pad="18px 18px 6px" />
            {feed.length === 0 ? (
              <StateBox kind="empty" title="해당하는 물품이 없어요" sub="다른 필터를 선택하거나 첫 나눔을 등록해보세요." />
            ) : (
              feed.map((f) => <FeedRow key={f.foodId} item={f} onClick={() => router.push(`/foods/${f.foodId}`)} />)
            )}
          </div>
        </>
      )}

      <div style={{ height: 96 }} />
    </div>
  );
}

const iconCircle = { width: 38, height: 38, borderRadius: "50%", border: "none", background: "#F1ECE6", display: "grid", placeItems: "center", cursor: "pointer" };

function SectionTitle({ title, count, pad = "2px 18px 12px" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: pad }}>
      <span style={{ width: 7, height: 18, borderRadius: 4, background: "var(--ac)" }} />
      <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: "nowrap" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#9A938C", fontWeight: 700, marginLeft: 2 }}>{count}</div>
    </div>
  );
}

function FeaturedCard({ item, onClick }) {
  const m = statusMeta(item.statusTx);
  const owner = item.ownerNickName || item.owner || "이웃";
  return (
    <button onClick={onClick} style={{ flex: "none", width: "78%", maxWidth: 320, scrollSnapAlign: "center", textAlign: "left", background: "#fff", border: "1px solid #F0ECE6", borderRadius: 20, overflow: "hidden", cursor: "pointer", padding: 0, boxShadow: "var(--shadow-card)" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/11" }}>
        <Thumb src={item.thumbnailUrl} name={item.foodName} radius={0} fontSize={16} style={{ width: "100%", height: "100%" }} />
        <span style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: "rgba(255,255,255,.94)", color: m.fg }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.fg }} />{m.label}
        </span>
      </div>
      <div style={{ padding: "15px 16px 16px" }}>
        <div style={lineClamp(2, { fontSize: 16, fontWeight: 700, lineHeight: 1.36, minHeight: 44 })}>{item.foodName}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#E2F0E7", color: "#4E9970", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 11, flex: "none" }}>{initialOf(owner)}</div>
          <span style={{ fontSize: 12.5, color: "#6B6560", fontWeight: 600, whiteSpace: "nowrap" }}>{owner}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 13 }}>
          <span style={{ fontSize: 12.5, color: "#37332E", fontWeight: 700, whiteSpace: "nowrap" }}>{capText(item.approvedCount, item.capacity)}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ac)", whiteSpace: "nowrap" }}>{remainText(item.approvedCount, item.capacity)}</span>
        </div>
        <div style={{ height: 6, background: "#EEEAE3", borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
          <div style={{ height: "100%", width: progressPct(item.approvedCount, item.capacity), background: "var(--ac)", borderRadius: 999 }} />
        </div>
      </div>
    </button>
  );
}

function FeedRow({ item, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", gap: 14, width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid #F1ECE6", padding: 16, cursor: "pointer", alignItems: "flex-start" }}>
      <Thumb src={item.thumbnailUrl} name={item.foodName} radius={14} style={{ width: 92, height: 92, flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <div style={lineClamp(2, { fontSize: 15.5, fontWeight: 700, lineHeight: 1.36, color: "#1F1D1B" })}>{item.foodName}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
          <StatusBadge status={item.statusTx} />
          <span style={{ fontSize: 12.5, color: "#6B6560", fontWeight: 600 }}>{capText(item.approvedCount, item.capacity)}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#B6AFA7", marginTop: 6 }}>소비기한 {fmtDate(item.expired)}</div>
      </div>
    </button>
  );
}

function lineClamp(lines, extra = {}) {
  return { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden", ...extra };
}

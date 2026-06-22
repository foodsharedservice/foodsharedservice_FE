"use client";

/* MyScreen.jsx — 마이페이지
   API: GET /members/me, GET /members/me/foods, GET /members/me/requests,
        POST /auth/logout, DELETE /members/me */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { StateBox } from "@/components/ui";
import { initialOf } from "@/lib/foodUi";
import API from "@/lib/api";

export default function MyScreen() {
  const router = useRouter();
  const { user, loading: authLoading, setUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [counts, setCounts] = useState({ foods: 0, sent: 0, received: 0 });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    API.members.me()
      .then((me) => { if (alive) setProfile(me); })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });

    Promise.all([
      API.members.myFoods().catch(() => []),
      API.requests.mine().catch(() => []),
    ]).then(async ([foods, sent]) => {
      if (!alive) return;
      const active = (foods || []).filter((f) => f.statusTx === "IN_PROGRESS");
      const recvLists = await Promise.all(active.map((f) => API.requests.received(f.foodId).catch(() => [])));
      if (!alive) return;
      setCounts({ foods: (foods || []).length, sent: (sent || []).length, received: recvLists.flat().length });
    });
    return () => { alive = false; };
  }, [authLoading, user, router]);

  const logout = async () => {
    try { await API.auth.logout(); } catch {}
    setUser(null);
    router.push("/login");
  };
  const withdraw = async () => {
    if (!window.confirm("정말 탈퇴하시겠어요? 탈퇴한 이메일은 재가입할 수 없어요.")) return;
    try { await API.members.remove(); } catch {}
    setUser(null);
    router.push("/login");
  };

  if (authLoading || (user && loading)) {
    return <div><StateBox kind="loading" title="내 정보를 불러오는 중…" /></div>;
  }
  if (!user) return null;
  if (error) {
    return <div><StateBox kind="error" title="내 정보를 불러오지 못했어요" sub={`(${error.code || error.status || error.message || "네트워크 오류"})`} onRetry={() => router.refresh()} /></div>;
  }

  const p = profile || user;
  const addr = (p.address && (p.address.roadAddress || "")) || "";

  return (
    <div style={{ minHeight: "100dvh" }}>
      <div style={{ padding: "16px 18px 12px" }}><div style={{ fontSize: 21, fontWeight: 800 }}>마이</div></div>

      {/* 프로필 카드 */}
      <div style={{ margin: "0 18px", padding: 20, borderRadius: 18, background: "linear-gradient(135deg,#E8F6EC,#D6EFDD)", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#fff", color: "var(--ac)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 22 }}>{initialOf(p.nickName)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{p.nickName}</div>
          <div style={{ fontSize: 13, color: "#8A7A66", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{addr || p.email}</div>
        </div>
        <button onClick={() => router.push("/mypage/edit")} style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "rgba(255,255,255,.7)", color: "#37332E", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>수정</button>
      </div>

      {/* 통계 */}
      <div style={{ display: "flex", margin: 18, borderRadius: 16, background: "#F7F3EE", overflow: "hidden" }}>
        <Stat n={counts.foods} label="등록 물품" onClick={() => router.push("/mypage/foods")} />
        <div style={{ width: 1, background: "#E9E3DB" }} />
        <Stat n={counts.sent} label="보낸 요청" onClick={() => router.push("/requests")} />
        <div style={{ width: 1, background: "#E9E3DB" }} />
        <Stat n={counts.received} label="받은 요청" onClick={() => router.push("/requests")} />
      </div>

      {/* 메뉴 */}
      <div style={{ padding: "0 6px" }}>
        <MenuItem onClick={() => router.push("/mypage/foods")} label="내 등록 물품">
          <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 21V9" />
        </MenuItem>
        <MenuItem onClick={() => router.push("/requests")} label="나눔 요청 내역">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </MenuItem>
        <MenuItem onClick={() => router.push("/mypage/edit")} label="회원정보 수정">
          <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
        </MenuItem>
        <MenuItem onClick={logout} label="로그아웃" color="#C9472F" noChevron stroke="#C9472F">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </MenuItem>
        <MenuItem onClick={withdraw} label="회원 탈퇴" color="#9A938C" noChevron stroke="#9A938C">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </MenuItem>
      </div>
      <div style={{ height: 96 }} />
    </div>
  );
}

function Stat({ n, label, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "16px 8px", border: "none", background: "transparent", cursor: "pointer" }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{n}</div>
      <div style={{ fontSize: 12.5, color: "#9A938C", marginTop: 2 }}>{label}</div>
    </button>
  );
}

function MenuItem({ onClick, label, children, color = "#1F1D1B", stroke = "#6B6560", noChevron }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 16, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
      <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color }}>{label}</span>
      {!noChevron && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7BFB5" strokeWidth="2.4"><path d="m9 18 6-6-6-6" /></svg>}
    </button>
  );
}

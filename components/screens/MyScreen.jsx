"use client";

/* MyScreen.jsx — D-08 마이페이지
   API: GET /members/me, GET /members/me/foods, DELETE /foods/{foodId},
        DELETE /members/me, POST /auth/logout
   실제 API 데이터만 사용. 비로그인 시 로그인으로 유도. */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Photo, StatusBadge, Avatar, StateBox } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

const MY_FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "IN_PROGRESS", label: "진행중" },
  { id: "COMPLETED", label: "완료" },
  { id: "DONE", label: "만료/미완료" },
];

export default function MyScreen() {
  const router = useRouter();
  const { user, loading: authLoading, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([API.members.me(), API.members.myFoods().catch(() => [])])
      .then(([me, fs]) => {
        if (!alive) return;
        setProfile(me);
        setFoods(Array.isArray(fs) ? fs : []);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, router]);

  const removeFood = (foodId) => {
    // DELETE /foods/{foodId} → status_tx INCOMPLETE (soft delete)
    API.foods.remove(foodId).catch(() => {});
    setFoods((prev) => prev.map((f) => (f.foodId === foodId ? { ...f, statusTx: "INCOMPLETE" } : f)));
  };

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
    return <div className="my"><StateBox kind="loading" title="내 정보를 불러오는 중…" /></div>;
  }
  if (!user) return null; // 리다이렉트 중
  if (error) {
    return (
      <div className="my">
        <StateBox kind="error" title="내 정보를 불러오지 못했어요"
          sub={`서버에 연결할 수 없습니다. (${error.code || error.status || error.message || "네트워크 오류"})`}
          onRetry={() => router.refresh()} />
      </div>
    );
  }

  const p = profile || user;
  const total = foods.length;
  const activeCount = foods.filter((f) => f.statusTx === "IN_PROGRESS").length;
  const completedCount = foods.filter((f) => f.statusTx === "COMPLETED").length;
  const addr = p.address ? (p.address.roadAddress || "") : "";
  const joined = p.createdAt ? String(p.createdAt).slice(0, 10) : "";

  const filtered = foods.filter((f) => {
    if (filter === "ALL") return true;
    if (filter === "DONE") return f.statusTx === "EXPIRED" || f.statusTx === "INCOMPLETE";
    return f.statusTx === filter;
  });

  return (
    <div className="my">
      <div className="my-head">
        <div className="eyebrow" style={{ color: "var(--primary)" }}>MY PAGE</div>
      </div>

      <div className="my-layout">
        {/* ============ Sidebar ============ */}
        <aside className="my-sidebar">
          <div className="my-profile">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Avatar name={p.nickName} size={44} />
              <div style={{ minWidth: 0 }}>
                <div className="my-profile-name">{p.nickName}</div>
                <div className="my-profile-mail">{p.email}</div>
              </div>
            </div>
            {(addr || joined) && (
              <div className="my-profile-addr">{addr}{addr && joined ? " · " : ""}{joined && `가입 ${joined}`}</div>
            )}
            <div className="my-stats">
              <div className="my-stat"><b>{total}</b><span>등록</span></div>
              <div className="my-stat"><b>{activeCount}/10</b><span>활성</span></div>
              <div className="my-stat"><b>{completedCount}</b><span>완료</span></div>
            </div>
          </div>

          <nav className="my-menu">
            <button className="my-menu-item on"><Icon.Users /> 내가 등록한 물품</button>
            <button className="my-menu-item"><Icon.Heart /> 받은 / 보낸 요청</button>
            <button className="my-menu-item"><Icon.Pin /> 정보 수정</button>
            <div className="my-menu-sep"></div>
            <button className="my-menu-item" onClick={logout}><Icon.ArrowRight /> 로그아웃</button>
            <button className="my-menu-item danger" onClick={withdraw}><Icon.Trash /> 회원 탈퇴</button>
          </nav>
        </aside>

        {/* ============ Main: my foods ============ */}
        <div>
          <div className="my-main-head">
            <div className="my-main-title">내가 등록한 물품</div>
            <div className="my-main-count">총 {total}건 · 활성 {activeCount}건</div>
          </div>

          <div className="tab-row" style={{ marginBottom: 16 }}>
            {MY_FILTERS.map((f) => (
              <button key={f.id} className={`tab ${filter === f.id ? "on" : ""}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="my-list">
            {filtered.map((f) => (
              <div className="my-row" key={f.foodId}>
                <Photo label="냠냠" src={f.thumbnailUrl} ratio="1/1" />
                <div className="my-row-body">
                  <div className="my-row-name">{f.foodName}</div>
                  <div className="my-row-exp">소비기한 {f.expired}</div>
                  <div className="my-row-tags">
                    <StatusBadge status={f.statusTx} />
                    <span className="badge incomplete" style={{ background: "var(--bg-2)" }}>
                      {f.approvedCount}/{f.capacity}명
                    </span>
                  </div>
                </div>
                <div className="my-row-actions">
                  <button className="btn ghost sm" onClick={() => router.push(`/foods/${f.foodId}`)}>보기</button>
                  {(f.statusTx === "IN_PROGRESS" || f.statusTx === "EXPIRED") && (
                    <button className="btn danger-ghost sm" onClick={() => removeFood(f.foodId)}>삭제</button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                {total === 0 ? "아직 등록한 물품이 없어요" : "해당하는 물품이 없어요"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

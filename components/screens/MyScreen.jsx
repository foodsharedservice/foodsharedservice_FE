"use client";

/* MyScreen.jsx — D-08 마이페이지
   API: GET /members/me, PATCH /members/me, DELETE /members/me,
        GET /members/me/foods, DELETE /foods/{foodId}, POST /auth/logout */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Photo, StatusBadge, Avatar } from "@/components/ui";
import API from "@/lib/api";

const MY_PROFILE = {
  memberId: 1,
  nickName: "나눔러",
  email: "nanumlover@example.com",
  address: { roadAddress: "서울 서초구", detailAddress: "101동 202호" },
  createdAt: "2026-03-12",
  shareCount: 12,
  receiveCount: 7,
};

const MY_FOODS = [
  { foodId: 1, foodName: "참치캔 6개입 (미개봉)", expired: "2026-06-25", approvedCount: 1, capacity: 3, statusTx: "IN_PROGRESS", emoji: "🐟" },
  { foodId: 2, foodName: "스팸 클래식 200g x 4", expired: "2026-07-15", approvedCount: 0, capacity: 2, statusTx: "IN_PROGRESS", emoji: "🥫" },
  { foodId: 3, foodName: "오뚜기 카레 (백미)", expired: "2026-08-02", approvedCount: 1, capacity: 1, statusTx: "COMPLETED", emoji: "🍛" },
  { foodId: 4, foodName: "농심 신라면 5개입", expired: "2026-06-02", approvedCount: 0, capacity: 5, statusTx: "EXPIRED", emoji: "🍜" },
  { foodId: 12, foodName: "녹차티백 100개입", expired: "2027-01-30", approvedCount: 0, capacity: 5, statusTx: "INCOMPLETE", emoji: "🍵" },
];

const MY_FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "IN_PROGRESS", label: "진행중" },
  { id: "COMPLETED", label: "완료" },
  { id: "DONE", label: "만료/미완료" },
];

export default function MyScreen() {
  const router = useRouter();
  const [foods, setFoods] = useState(MY_FOODS);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    let alive = true;
    // GET /members/me/foods
    API.members.myFoods()
      .then((data) => { if (alive && Array.isArray(data) && data.length) setFoods(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const removeFood = (foodId) => {
    // DELETE /foods/{foodId} → status_tx INCOMPLETE (soft delete)
    API.foods.remove(foodId).catch(() => {});
    setFoods((prev) => prev.map((f) => (f.foodId === foodId ? { ...f, statusTx: "INCOMPLETE" } : f)));
  };

  const logout = () => {
    API.auth.logout().catch(() => {});
    router.push("/login");
  };

  const filtered = foods.filter((f) => {
    if (filter === "ALL") return true;
    if (filter === "DONE") return f.statusTx === "EXPIRED" || f.statusTx === "INCOMPLETE";
    return f.statusTx === filter;
  });

  const activeCount = foods.filter((f) => f.statusTx === "IN_PROGRESS").length;
  const p = MY_PROFILE;

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
            <div className="my-profile-addr">{p.address.roadAddress} · 가입 {p.createdAt}</div>
            <div className="my-stats">
              <div className="my-stat"><b>{p.shareCount}</b><span>나눔</span></div>
              <div className="my-stat"><b>{p.receiveCount}</b><span>받음</span></div>
              <div className="my-stat"><b>{activeCount}/10</b><span>활성</span></div>
            </div>
          </div>

          <nav className="my-menu">
            <button className="my-menu-item on"><Icon.Users /> 내가 등록한 물품</button>
            <button className="my-menu-item"><Icon.Heart /> 받은 / 보낸 요청</button>
            <button className="my-menu-item"><Icon.Pin /> 정보 수정</button>
            <div className="my-menu-sep"></div>
            <button className="my-menu-item" onClick={logout}><Icon.ArrowRight /> 로그아웃</button>
            <button className="my-menu-item danger"><Icon.Trash /> 회원 탈퇴</button>
          </nav>
        </aside>

        {/* ============ Main: my foods ============ */}
        <div>
          <div className="my-main-head">
            <div className="my-main-title">내가 등록한 물품</div>
            <div className="my-main-count">총 {foods.length}건 · 활성 {activeCount}건</div>
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
                <Photo label="" emoji={f.emoji} ratio="1/1" />
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
                  {f.statusTx === "IN_PROGRESS" && <button className="btn ghost sm">수정</button>}
                  {(f.statusTx === "IN_PROGRESS" || f.statusTx === "EXPIRED") && (
                    <button className="btn danger-ghost sm" onClick={() => removeFood(f.foodId)}>삭제</button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                해당하는 물품이 없어요
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

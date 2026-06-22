"use client";

/* MyScreen.jsx — D-08 마이페이지 (실제 API)
   GET    /members/me                  프로필
   PATCH  /members/me                  정보 수정(닉네임/주소)
   DELETE /members/me                  회원 탈퇴
   POST   /auth/logout                 로그아웃
   DELETE /foods/{foodId}              내 물품 삭제

   ※ 백엔드에 "내 물품 목록" API가 없어, 등록 시 기록해 둔 foodId(localStorage)로
     GET /foods/{foodId} 상세를 모아 보여준다(삭제된 물품은 404로 자동 제외). */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Photo, StatusBadge, Avatar, StateBox } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import AddressSearch from "@/components/AddressSearch";
import { getMyFoodIds, untrackMyFood } from "@/lib/localStore";
import API from "@/lib/api";

const MY_FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "IN_PROGRESS", label: "진행중" },
  { id: "COMPLETED", label: "완료" },
  { id: "DONE", label: "만료/미완료" },
];

export default function MyScreen() {
  const router = useRouter();
  const { user, loading: authLoading, setUser, refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [editOpen, setEditOpen] = useState(false);

  const loadFoods = useCallback((memberId) => {
    const ids = getMyFoodIds(memberId);
    if (!ids.length) { setFoods([]); return Promise.resolve(); }
    return Promise.all(
      ids.map((id) =>
        API.foods.detail(id).catch((e) => {
          if (e.status === 404) untrackMyFood(memberId, id); // 삭제된 물품 정리
          return null;
        })
      )
    ).then((list) => setFoods(list.filter(Boolean)));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    API.members.me()
      .then(async (me) => {
        if (!alive) return;
        setProfile(me);
        await loadFoods(me.memberId);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, router, loadFoods]);

  const removeFood = (foodId) => {
    if (!window.confirm("이 물품을 삭제할까요?")) return;
    API.foods.remove(foodId)
      .then(() => {
        untrackMyFood(profile && profile.memberId, foodId);
        setFoods((prev) => prev.filter((f) => f.foodId !== foodId));
      })
      .catch((e) => alert(e.message || "삭제에 실패했어요."));
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
  if (!user) return null;
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
              <div className="my-stat"><b>{activeCount}</b><span>진행중</span></div>
              <div className="my-stat"><b>{completedCount}</b><span>완료</span></div>
            </div>
          </div>

          <nav className="my-menu">
            <button className="my-menu-item on"><Icon.Users /> 내가 등록한 물품</button>
            <button className="my-menu-item" onClick={() => router.push("/chat")}><Icon.Chat /> 채팅 목록</button>
            <button className="my-menu-item" onClick={() => setEditOpen(true)}><Icon.Pencil /> 정보 수정</button>
            <div className="my-menu-sep"></div>
            <button className="my-menu-item" onClick={logout}><Icon.ArrowRight /> 로그아웃</button>
            <button className="my-menu-item danger" onClick={withdraw}><Icon.Trash /> 회원 탈퇴</button>
          </nav>
        </aside>

        {/* ============ Main: my foods ============ */}
        <div>
          <div className="my-main-head">
            <div className="my-main-title">내가 등록한 물품</div>
            <div className="my-main-count">총 {total}건 · 진행중 {activeCount}건</div>
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
                <Photo label="냠냠" src={(f.imageUrls && f.imageUrls[0]) || undefined} ratio="1/1" />
                <div className="my-row-body">
                  <div className="my-row-name">{f.foodName}</div>
                  <div className="my-row-exp">소비기한 {f.expired}{f.region ? ` · ${f.region}` : ""}</div>
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
                {total === 0 ? (
                  <>
                    아직 등록한 물품이 없어요
                    <div style={{ marginTop: 14 }}>
                      <button className="btn primary sm" onClick={() => router.push("/register")}>나눔 등록하기</button>
                    </div>
                  </>
                ) : "해당하는 물품이 없어요"}
              </div>
            )}
          </div>
          {total > 0 && (
            <p style={{ marginTop: 16, fontSize: 11, color: "var(--ink-4)", lineHeight: 1.6 }}>
              ※ 이 목록은 이 브라우저에서 등록한 물품을 기준으로 보여줘요. (백엔드에 내 물품 목록 API가 없어요)
            </p>
          )}
        </div>
      </div>

      {editOpen && (
        <EditProfileModal
          profile={p}
          onClose={() => setEditOpen(false)}
          onSaved={async () => { setEditOpen(false); const me = await API.members.me().catch(() => null); if (me) setProfile(me); refresh && refresh(); }}
        />
      )}
    </div>
  );
}

/* ============ 정보 수정 모달 (PATCH /members/me) ============ */
function EditProfileModal({ profile, onClose, onSaved }) {
  const [nick, setNick] = useState(profile.nickName || "");
  const [road, setRoad] = useState((profile.address && profile.address.roadAddress) || "");
  const [detail, setDetail] = useState((profile.address && profile.address.detailAddress) || "");
  const [addrOpen, setAddrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {};
      if (nick && nick !== profile.nickName) body.nickName = nick;
      if (road) body.address = { roadAddress: road, detailAddress: detail };
      await API.members.update(body);
      onSaved && onSaved();
    } catch (e) {
      const map = { NICKNAME_DUPLICATED: "이미 사용 중인 닉네임이에요.", VALIDATION_FAILED: "입력값을 확인해주세요. (닉네임 2~10자)" };
      setError(map[e.code] || e.message || "수정에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="닫기"><Icon.X /></button>
        <div className="eyebrow" style={{ color: "var(--primary)" }}>EDIT PROFILE</div>
        <h2 style={{ fontSize: 21, fontWeight: 800, marginTop: 4, marginBottom: 16 }}>정보 수정</h2>

        <div className="label">닉네임 <span className="hint">2–10자</span></div>
        <input className="field-input" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={10} />

        <div className="label" style={{ marginTop: 16 }}>주소</div>
        <div className="verify-row">
          <input className="field-input" value={road} readOnly onClick={() => setAddrOpen(true)} placeholder="도로명 주소 검색" style={{ cursor: "pointer" }} />
          <button className="btn ghost" onClick={() => setAddrOpen(true)}>주소 검색</button>
        </div>
        <input className="field-input" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="상세주소 (선택)" style={{ marginTop: 8 }} />

        {error && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: "#FBEAE5", border: "1px solid var(--danger-100)", borderRadius: 8, color: "var(--danger)", fontSize: 12.5 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>취소</button>
          <button className="btn primary" style={{ flex: 2 }} onClick={save} disabled={busy}>{busy ? "저장 중…" : "저장하기"}</button>
        </div>
      </div>

      <AddressSearch open={addrOpen} onClose={() => setAddrOpen(false)} onComplete={(data) => {
        const building = data.buildingName && data.buildingName !== "N" ? ` (${data.buildingName})` : "";
        setRoad((data.roadAddress || data.jibunAddress || "") + building);
      }} />

      <style>{`
        .modal-scrim { position: fixed; inset: 0; background: rgba(31,29,24,0.45); backdrop-filter: blur(2px); z-index: 200; display: grid; place-items: center; padding: 20px; }
        .modal { width: 100%; max-width: 440px; background: var(--surface); border-radius: 14px; padding: 28px; position: relative; box-shadow: var(--shadow-pop); }
        .modal-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; color: var(--ink-3); }
        .modal-close:hover { background: var(--bg-2); color: var(--ink); }
      `}</style>
    </div>
  );
}

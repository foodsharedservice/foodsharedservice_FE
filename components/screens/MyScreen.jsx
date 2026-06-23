"use client";

/* MyScreen.jsx — D-08 마이페이지 (실제 API)
   GET    /members/me                  프로필
   PATCH  /members/me                  정보 수정(닉네임/주소)
   DELETE /members/me                  회원 탈퇴
   POST   /auth/logout                 로그아웃
   DELETE /foods/{foodId}              내 물품 삭제
   PATCH  /foods/{foodId}              내 물품 수정
   GET    /members/me/foods            내가 등록한 물품 목록
   GET    /members/me/requests         내가 보낸 요청 목록
   DELETE /foods/{foodId}/requests/{requestId}  요청 취소 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Photo, StatusBadge, Avatar, StateBox } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import AddressSearch from "@/components/AddressSearch";
import API from "@/lib/api";

const MY_FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "IN_PROGRESS", label: "진행중" },
  { id: "COMPLETED", label: "완료" },
  { id: "DONE", label: "만료/미완료" },
];

const REQUEST_STATUS_LABEL = {
  REQUEST: "대기중",
  APPROVED: "수락됨",
  REJECTED: "거절됨",
  CANCELLED: "취소됨",
};

export default function MyScreen() {
  const router = useRouter();
  const { user, loading: authLoading, setUser, refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("foods"); // "foods" | "requests"
  const [editFoodTarget, setEditFoodTarget] = useState(null); // food object to edit

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([API.members.me(), API.foods.myFoods().catch(() => [])])
      .then(([me, res]) => {
        if (!alive) return;
        setProfile(me);
        const list = Array.isArray(res) ? res : (res && res.content) || [];
        setFoods(list);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, router]);

  const removeFood = (foodId) => {
    if (!window.confirm("이 물품을 삭제할까요?")) return;
    API.foods.remove(foodId)
      .then(() => setFoods((prev) => prev.filter((f) => f.foodId !== foodId)))
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
            <div className="my-stats">
              <div className="my-stat"><b>{total}</b><span>등록</span></div>
              <div className="my-stat"><b>{activeCount}</b><span>진행중</span></div>
              <div className="my-stat"><b>{completedCount}</b><span>완료</span></div>
            </div>
          </div>

          <nav className="my-menu">
            <button className={`my-menu-item ${activeTab === "foods" ? "on" : ""}`} onClick={() => setActiveTab("foods")}><Icon.Users /> 내가 등록한 물품</button>
            <button className={`my-menu-item ${activeTab === "requests" ? "on" : ""}`} onClick={() => setActiveTab("requests")}><Icon.ArrowRight /> 보낸 요청</button>
            <button className="my-menu-item" onClick={() => router.push("/chat")}><Icon.Chat /> 채팅 목록</button>
            <button className="my-menu-item" onClick={() => setEditOpen(true)}><Icon.Pencil /> 정보 수정</button>
            <div className="my-menu-sep"></div>
            <button className="my-menu-item" onClick={logout}><Icon.ArrowRight /> 로그아웃</button>
            <button className="my-menu-item danger" onClick={withdraw}><Icon.Trash /> 회원 탈퇴</button>
          </nav>
        </aside>

        {/* ============ Main ============ */}
        <div>
          {activeTab === "foods" ? (
            <>
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
                    <Photo label="냠냠" src={f.thumbnailUrl || undefined} ratio="1/1" />
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
                      {f.statusTx === "IN_PROGRESS" && (
                        <button className="btn ghost sm" onClick={() => setEditFoodTarget(f)}>수정</button>
                      )}
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
            </>
          ) : (
            <MySentRequests />
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

      {editFoodTarget && (
        <EditFoodModal
          food={editFoodTarget}
          onClose={() => setEditFoodTarget(null)}
          onSaved={(updated) => {
            setFoods((prev) => prev.map((f) => f.foodId === updated.foodId ? { ...f, ...updated } : f));
            setEditFoodTarget(null);
          }}
        />
      )}
    </div>
  );
}

/* ============ 보낸 요청 목록 ============ */
function MySentRequests() {
  const router = useRouter();
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(() => {
    setErr(null);
    API.requests.mySent()
      .then((res) => setList(Array.isArray(res) ? res : (res && res.content) || []))
      .catch((e) => { setErr(e); setList([]); });
  }, []);

  useEffect(() => load(), [load]);

  const cancel = (foodId, requestId) => {
    if (!window.confirm("요청을 취소할까요?")) return;
    API.requests.cancel(foodId, requestId)
      .then(() => setList((prev) => prev.filter((r) => r.requestId !== requestId)))
      .catch((e) => alert(e.message || "취소에 실패했어요."));
  };

  return (
    <>
      <div className="my-main-head">
        <div className="my-main-title">보낸 요청</div>
        {list && <div className="my-main-count">총 {list.length}건</div>}
      </div>

      {list === null ? (
        <StateBox kind="loading" title="요청 목록을 불러오는 중…" />
      ) : err ? (
        <StateBox kind="error" title="요청 목록을 불러오지 못했어요" onRetry={load} />
      ) : list.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
          보낸 요청이 없어요
        </div>
      ) : (
        <div className="my-list">
          {list.map((r) => (
            <div className="my-row" key={r.requestId}>
              <Photo label="냠냠" src={r.thumbnailUrl || undefined} ratio="1/1" />
              <div className="my-row-body">
                <div className="my-row-name">{r.foodName || "물품"}</div>
                {r.ownerNickName && <div className="my-row-exp">등록자 {r.ownerNickName}</div>}
                <div className="my-row-tags">
                  <span className={`badge ${r.status === "APPROVED" ? "progress" : r.status === "REQUEST" ? "incomplete" : "incomplete"}`}
                    style={r.status === "REQUEST" ? { background: "var(--primary-100)", color: "var(--primary-700)" } : {}}>
                    {REQUEST_STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>
              </div>
              <div className="my-row-actions">
                <button className="btn ghost sm" onClick={() => router.push(`/foods/${r.foodId}`)}>보기</button>
                {r.status === "REQUEST" && (
                  <button className="btn danger-ghost sm" onClick={() => cancel(r.foodId, r.requestId)}>취소</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ============ 음식 수정 모달 (PATCH /foods/{foodId}) ============ */
function EditFoodModal({ food, onClose, onSaved }) {
  const [foodName, setFoodName] = useState(food.foodName || "");
  const [capacity, setCapacity] = useState(food.capacity || 3);
  const [details, setDetails] = useState("");
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    API.foods.detail(food.foodId)
      .then((d) => { setDetails(d.details || ""); setDetailsLoaded(true); })
      .catch(() => setDetailsLoaded(true));
  }, [food.foodId]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {};
      if (foodName.trim() !== food.foodName) body.foodName = foodName.trim();
      if (capacity !== food.capacity) body.capacity = capacity;
      if (detailsLoaded) body.details = details.trim();
      const updated = await API.foods.update(food.foodId, body);
      onSaved && onSaved({ ...food, foodName: foodName.trim(), capacity, ...(updated || {}) });
    } catch (e) {
      const map = { VALIDATION_FAILED: "입력값을 확인해주세요.", FOOD_NOT_FOUND: "존재하지 않는 물품이에요." };
      setError(map[e.code] || e.message || "수정에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="닫기"><Icon.X /></button>
        <div className="eyebrow" style={{ color: "var(--primary)" }}>EDIT FOOD</div>
        <h2 style={{ fontSize: 21, fontWeight: 800, marginTop: 4, marginBottom: 16 }}>물품 수정</h2>

        <div className="label">물품 이름</div>
        <input className="field-input" value={foodName} onChange={(e) => setFoodName(e.target.value)} maxLength={30} />

        <div className="label" style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
          <span>정원 수</span><span className="hint">최대 10명</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
          <button className="cap-btn" onClick={() => setCapacity((c) => Math.max(1, c - 1))} aria-label="감소"><Icon.Minus /></button>
          <span style={{ minWidth: 60, textAlign: "center", fontSize: 20, fontWeight: 700, fontFamily: "var(--font-en)" }}>{capacity}명</span>
          <button className="cap-btn" onClick={() => setCapacity((c) => Math.min(10, c + 1))} aria-label="증가"><Icon.Plus /></button>
        </div>

        <div className="label" style={{ marginTop: 16 }}>상세 내용</div>
        {!detailsLoaded ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 12 }}>불러오는 중…</div>
        ) : (
          <textarea className="field-input textarea" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={4} />
        )}

        {error && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: "#FBEAE5", border: "1px solid var(--danger-100)", borderRadius: 8, color: "var(--danger)", fontSize: 12.5 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>취소</button>
          <button className="btn primary" style={{ flex: 2 }} onClick={save} disabled={busy || !foodName.trim()}>{busy ? "저장 중…" : "저장하기"}</button>
        </div>
      </div>

      <style>{`
        .modal-scrim { position: fixed; inset: 0; background: rgba(31,29,24,0.45); backdrop-filter: blur(2px); z-index: 200; display: grid; place-items: center; padding: 20px; }
        .modal { width: 100%; max-width: 440px; background: var(--surface); border-radius: 14px; padding: 28px; position: relative; box-shadow: var(--shadow-pop); }
        .modal-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; color: var(--ink-3); }
        .modal-close:hover { background: var(--bg-2); color: var(--ink); }
        .cap-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--surface); border: 1px solid var(--line); color: var(--ink); display: grid; place-items: center; }
        .cap-btn:hover { border-color: var(--primary); color: var(--primary); }
      `}</style>
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

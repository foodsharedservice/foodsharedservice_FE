"use client";

/* MyScreen.jsx — 마이페이지
   API: GET /members/me, PATCH /members/me, DELETE /members/me,
        POST /auth/logout, GET /members/me/chat/rooms
   ※ 백엔드에 "내가 등록한 물품" 목록 엔드포인트가 없어, 프로필/채팅 중심으로 구성. */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Avatar, StateBox } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import AddressSearch from "@/components/AddressSearch";
import API from "@/lib/api";

export default function MyScreen() {
  const router = useRouter();
  const { user, loading: authLoading, setUser, refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("chats"); // chats | edit

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([API.members.me(), API.chat.myRooms().catch(() => [])])
      .then(([me, rs]) => { if (!alive) return; setProfile(me); setRooms(Array.isArray(rs) ? rs : []); })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, router]);

  const logout = async () => {
    try { await API.auth.logout(); } catch {}
    setUser(null);
    router.push("/login");
  };
  const withdraw = async () => {
    if (!window.confirm("정말 탈퇴하시겠어요? 되돌릴 수 없어요.")) return;
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
  const addr = p.address ? [p.address.roadAddress, p.address.detailAddress].filter(Boolean).join(" ") : "";
  const joined = p.createdAt ? String(p.createdAt).slice(0, 10) : "";
  const totalUnread = rooms.reduce((s, r) => s + (r.unreadCount || 0), 0);

  return (
    <div className="my">
      <div className="my-head"><div className="eyebrow" style={{ color: "var(--primary)" }}>MY PAGE</div></div>

      <div className="my-layout">
        {/* sidebar */}
        <aside className="my-sidebar">
          <div className="my-profile">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Avatar name={p.nickName} size={46} />
              <div style={{ minWidth: 0 }}>
                <div className="my-profile-name">{p.nickName}</div>
                <div className="my-profile-mail">{p.email}</div>
              </div>
            </div>
            {addr && <div className="my-profile-addr"><Icon.Pin /> {addr}</div>}
            {joined && <div className="my-profile-addr" style={{ marginTop: 6 }}>가입일 {joined}</div>}
            <div className="my-stats">
              <div className="my-stat"><b>{rooms.length}</b><span>채팅방</span></div>
              <div className="my-stat"><b>{totalUnread}</b><span>안읽음</span></div>
            </div>
          </div>

          <nav className="my-menu">
            <button className={`my-menu-item ${tab === "chats" ? "on" : ""}`} onClick={() => setTab("chats")}><Icon.Chat /> 내 채팅</button>
            <button className={`my-menu-item ${tab === "edit" ? "on" : ""}`} onClick={() => setTab("edit")}><Icon.Edit /> 정보 수정</button>
            <button className="my-menu-item" onClick={() => router.push("/register")}><Icon.Plus /> 나눔 등록</button>
            <div className="my-menu-sep" />
            <button className="my-menu-item" onClick={logout}><Icon.ArrowRight /> 로그아웃</button>
            <button className="my-menu-item danger" onClick={withdraw}><Icon.Trash /> 회원 탈퇴</button>
          </nav>
        </aside>

        {/* main */}
        <div>
          {tab === "chats" ? (
            <>
              <div className="my-main-head">
                <div className="my-main-title">내 채팅</div>
                <div className="my-main-count">총 {rooms.length}개 · 안읽음 {totalUnread}</div>
              </div>
              {rooms.length === 0 ? (
                <StateBox kind="empty" title="아직 채팅이 없어요" sub="마음에 드는 나눔에 채팅을 걸어보세요." style={{ padding: "56px 20px" }} />
              ) : (
                <div className="my-list">
                  {rooms.map((r) => (
                    <button className="chat-card" key={r.roomId} onClick={() => router.push(`/chat/${r.roomId}`)}>
                      <Avatar name={r.partnerNickName || "?"} size={48} />
                      <div className="chat-card-body">
                        <div className="chat-card-top">
                          <span className="chat-card-name">{r.partnerNickName || "상대방"}</span>
                          <span className="chat-card-food">· {r.foodName}</span>
                          {r.lastMessageAt && <span className="chat-card-time">{timeAgo(r.lastMessageAt)}</span>}
                        </div>
                        <div className="chat-card-msg">{r.lastMessage || "대화를 시작해보세요"}</div>
                      </div>
                      {r.unreadCount > 0 && <span className="chat-card-unread">{r.unreadCount}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <EditProfile profile={p} onSaved={async () => { await refresh(); const me = await API.members.me(); setProfile(me); setTab("chats"); }} />
          )}
        </div>
      </div>

      <style>{`
        .chat-card { display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); text-align: left; width: 100%; }
        .chat-card:hover { border-color: var(--line-2); box-shadow: var(--shadow-card-hover); }
        .chat-card-body { flex: 1; min-width: 0; }
        .chat-card-top { display: flex; align-items: baseline; gap: 6px; }
        .chat-card-name { font-weight: 700; font-size: 14px; }
        .chat-card-food { font-size: 12px; color: var(--ink-4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chat-card-time { margin-left: auto; font-size: 11px; color: var(--ink-4); flex-shrink: 0; }
        .chat-card-msg { font-size: 13px; color: var(--ink-3); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chat-card-unread { min-width: 20px; height: 20px; padding: 0 6px; background: var(--primary); color: #fff; border-radius: 999px; font-size: 11px; font-weight: 700; display: grid; place-items: center; font-family: var(--font-en); }
      `}</style>
    </div>
  );
}

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

/* ============ 정보 수정 ============ */
function EditProfile({ profile, onSaved }) {
  const [nick, setNick] = useState(profile.nickName || "");
  const [road, setRoad] = useState((profile.address && profile.address.roadAddress) || "");
  const [detail, setDetail] = useState((profile.address && profile.address.detailAddress) || "");
  const [addrOpen, setAddrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);

  const save = async () => {
    setError(null); setOk(false); setBusy(true);
    try {
      const body = {};
      if (nick && nick !== profile.nickName) body.nickName = nick;
      body.address = { roadAddress: road, detailAddress: detail };
      await API.members.update(body);
      setOk(true);
      onSaved && onSaved();
    } catch (e) {
      const map = { NICKNAME_DUPLICATED: "이미 사용 중인 닉네임이에요.", VALIDATION_FAILED: "입력값을 확인해주세요." };
      setError(map[e.code] || e.message || "수정에 실패했어요.");
    } finally { setBusy(false); }
  };

  return (
    <div className="edit-card">
      <div className="my-main-title" style={{ marginBottom: 16 }}>정보 수정</div>

      <div className="label">닉네임 <span className="hint">2–10자</span></div>
      <input className="field-input" value={nick} maxLength={10} onChange={(e) => setNick(e.target.value)} />

      <div className="label" style={{ marginTop: 16 }}>주소</div>
      <div className="verify-row">
        <input className="field-input" value={road} readOnly placeholder="도로명 주소 검색" onClick={() => setAddrOpen(true)} style={{ cursor: "pointer" }} />
        <button className="btn ghost" onClick={() => setAddrOpen(true)}>주소 검색</button>
      </div>
      <input className="field-input" style={{ marginTop: 8 }} value={detail} placeholder="상세주소 (선택)" onChange={(e) => setDetail(e.target.value)} />

      {error && <FormErrorInline>{error}</FormErrorInline>}
      {ok && <div className="field-state ok" style={{ marginTop: 12 }}><Icon.Check /> 저장했어요</div>}

      <button className="btn primary lg" style={{ width: "100%", marginTop: 20 }} disabled={busy || nick.trim().length < 2 || !road} onClick={save}>
        {busy ? "저장 중…" : "저장하기"}
      </button>

      <AddressSearch open={addrOpen} onClose={() => setAddrOpen(false)} onComplete={(data) => {
        const building = data.buildingName && data.buildingName !== "N" ? ` (${data.buildingName})` : "";
        setRoad((data.roadAddress || data.autoRoadAddress || data.jibunAddress || "") + building);
      }} />

      <style>{`
        .edit-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); padding: 22px; max-width: 460px; }
      `}</style>
    </div>
  );
}

function FormErrorInline({ children }) {
  return (
    <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--primary-50)", border: "1px solid var(--danger-100)", borderRadius: 8, color: "var(--danger)", fontSize: 12.5 }}>
      {children}
    </div>
  );
}

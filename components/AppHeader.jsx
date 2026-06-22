"use client";

/* components/AppHeader.jsx — 상단 네비게이션 + 알림(받은 요청) 드롭다운 (실제 API 기반)

   백엔드에 "내 물품 목록"/"통합 알림" API가 없으므로, 등록 시 기록해 둔 foodId
   (localStorage)로 각 물품의 받은 요청(GET /foods/{id}/requests)을 집계해 보여준다.
   수락/거절은 PATCH /foods/{foodId}/requests/{requestId}/(approve|reject). */

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Avatar, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { getMyFoodIds } from "@/lib/localStore";
import API from "@/lib/api";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [bellOpen, setBellOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  const isRegister = pathname?.startsWith("/register");
  const isMypage = pathname?.startsWith("/mypage");
  const isChat = pathname?.startsWith("/chat");

  // 받은 나눔 요청(REQUEST) 개수를 집계해 벨 아이콘 뱃지로 표시한다.
  // (백엔드에 통합 알림 API가 없어, 내 물품 foodId별 GET /foods/{id}/requests를 합산)
  useEffect(() => {
    if (!user) { setNotifCount(0); return; }
    let alive = true;
    (async () => {
      try {
        const ids = getMyFoodIds(user.memberId);
        if (!ids.length) { if (alive) setNotifCount(0); return; }
        const counts = await Promise.all(
          ids.map((foodId) =>
            API.requests.received(foodId)
              .then((rs) => (rs || []).filter((r) => r.status === "REQUEST").length)
              .catch(() => 0)
          )
        );
        if (alive) setNotifCount(counts.reduce((a, b) => a + b, 0));
      } catch {
        if (alive) setNotifCount(0);
      }
    })();
    return () => { alive = false; };
  }, [user, pathname, bellOpen]);

  return (
    <div className="app-header">
      <button className="logo" onClick={() => router.push("/")}>냠냠</button>

      <div className="search">
        <Icon.Search />
        <input placeholder="미개봉 식품 검색…" />
      </div>

      <div className="actions">
        {user ? (
          <>
            <button className={`btn ${isRegister ? "primary" : "ghost"}`} onClick={() => router.push("/register")}>
              <Icon.Plus /> 글쓰기
            </button>
            <button className={`icobtn ${isChat ? "on" : ""}`} onClick={() => router.push("/chat")} aria-label="채팅">
              <Icon.Chat />
            </button>
            <button
              className={`icobtn ${bellOpen ? "on" : ""}`}
              onClick={() => setBellOpen((v) => !v)}
              aria-label="알림"
            >
              <Icon.Bell />
              {notifCount > 0 && !bellOpen && <span className="dot">{notifCount}</span>}
            </button>
            <button className={`icobtn ${isMypage ? "on" : ""}`} onClick={() => router.push("/mypage")} aria-label="마이페이지">
              <Avatar name={user.nickName || "?"} size={28} />
            </button>
          </>
        ) : loading ? (
          <Spinner size={18} />
        ) : (
          <button className="btn primary" onClick={() => router.push("/login")}>로그인</button>
        )}
      </div>

      {bellOpen && user && (
        <BellDropdown
          memberId={user.memberId}
          onClose={() => setBellOpen(false)}
          onOpenFood={(foodId) => { setBellOpen(false); router.push(`/foods/${foodId}`); }}
        />
      )}
    </div>
  );
}

/* ============ Bell Dropdown — 받은 나눔 요청 집계 ============ */
function BellDropdown({ memberId, onClose, onOpenFood }) {
  const [received, setReceived] = useState(null); // null=loading
  const [error, setError] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        const tgt = e.target.closest("[aria-label='알림']");
        if (!tgt) onClose && onClose();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const ids = getMyFoodIds(memberId);
      if (!ids.length) { setReceived([]); return; }
      const lists = await Promise.all(
        ids.map((foodId) =>
          API.foods.detail(foodId)
            .then((food) =>
              API.requests.received(foodId)
                .then((rs) => (rs || [])
                  .filter((r) => r.status === "REQUEST")
                  .map((r) => ({ ...r, foodId, foodName: food.foodName })))
                .catch(() => [])
            )
            .catch(() => [])
        )
      );
      setReceived(lists.flat());
    } catch (e) {
      setError(e);
      setReceived([]);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  const handle = (foodId, requestId, kind) => {
    const fn = kind === "approve" ? API.requests.approve : API.requests.reject;
    fn(foodId, requestId).catch(() => {});
    setReceived((prev) => (prev || []).filter((r) => r.requestFoodId !== requestId));
  };

  const newCount = (received || []).length;

  return (
    <>
      <div className="bell-scrim" onClick={onClose}></div>
      <div className="bell-panel" ref={ref}>
        <div className="bell-head">
          <div>
            <div className="eyebrow">NOTIFICATIONS</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>받은 요청 {newCount > 0 && <span className="num-pill">{newCount}</span>}</h3>
          </div>
          <button className="icobtn" onClick={onClose} aria-label="닫기"><Icon.X /></button>
        </div>

        <div className="bell-list">
          {received === null ? (
            <div className="bell-loading"><Spinner size={24} /></div>
          ) : error ? (
            <div className="bell-empty">알림을 불러오지 못했어요</div>
          ) : received.length === 0 ? (
            <div className="bell-empty">받은 요청이 없어요</div>
          ) : (
            received.map((r) => (
              <div className="notif-card new" key={r.requestFoodId}>
                <div className="notif-top">
                  <Avatar name={`${r.memberId}`} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="notif-line"><b>이웃 #{r.memberId}</b></div>
                    <div className="notif-sub" onClick={() => onOpenFood(r.foodId)} style={{ cursor: "pointer" }}>
                      <b>{r.foodName}</b>에 나눔 요청 →
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => handle(r.foodId, r.requestFoodId, "reject")}>거절</button>
                  <button className="btn primary sm" style={{ flex: 1.4 }} onClick={() => handle(r.foodId, r.requestFoodId, "approve")}>수락</button>
                </div>
                <style>{notifCardStyles}</style>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .bell-scrim { position: fixed; inset: 0; background: rgba(31,29,24,0.18); z-index: 80; }
        .bell-panel {
          position: absolute; top: 64px; right: 32px; width: 400px;
          max-height: calc(100vh - 100px); background: var(--surface);
          border-radius: 14px; border: 1px solid var(--line);
          box-shadow: var(--shadow-pop); z-index: 90;
          display: flex; flex-direction: column; overflow: hidden;
        }
        .bell-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 12px; border-bottom: 1px solid var(--line); }
        .num-pill { display: inline-block; margin-left: 4px; padding: 1px 7px; background: var(--danger); color: #fff; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .bell-list { padding: 8px; overflow-y: auto; flex: 1; min-height: 120px; }
        .bell-loading { display: grid; place-items: center; padding: 48px 0; }
        .bell-empty { padding: 56px 20px; text-align: center; color: var(--ink-4); font-size: 13px; }
        @media (max-width: 900px) {
          .bell-panel { top: 60px; right: 12px; left: 12px; width: auto; max-width: none; }
        }
      `}</style>
    </>
  );
}

const notifCardStyles = `
  .notif-card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-bottom: 6px; transition: border-color 0.12s; }
  .notif-card:hover { border-color: var(--line-2); }
  .notif-card.new { border-color: var(--primary-100); background: var(--primary-50); }
  .notif-top { display: flex; gap: 10px; align-items: flex-start; }
  .notif-line { display: flex; align-items: baseline; gap: 8px; font-size: 13.5px; }
  .notif-line b { font-weight: 700; }
  .notif-sub { font-size: 12.5px; color: var(--ink-2); margin-top: 2px; }
`;

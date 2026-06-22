"use client";

/* components/AppHeader.jsx — 상단 네비게이션 + 알림 드롭다운 (실제 API 기반) */

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Avatar, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [bellOpen, setBellOpen] = useState(false);

  const isRegister = pathname?.startsWith("/register");
  const isMypage = pathname?.startsWith("/mypage");

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
            <button
              className={`icobtn ${bellOpen ? "on" : ""}`}
              onClick={() => setBellOpen((v) => !v)}
              aria-label="알림"
            >
              <Icon.Bell />
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
          onClose={() => setBellOpen(false)}
          onOpenTransaction={() => { setBellOpen(false); router.push("/transaction"); }}
        />
      )}
    </div>
  );
}

/* ============ Bell Dropdown (실제 API 집계) ============
   명세에 통합 알림 엔드포인트가 없어 클라이언트에서 집계한다.
   - 받은 요청: GET /members/me/foods → 각 물품 GET /foods/{id}/requests (status=REQUEST)
   - 내 요청 결과: GET /members/me/requests
   - 수락/거절: PATCH /requests/{id}/approve | reject */
function BellDropdown({ onClose, onOpenTransaction }) {
  const [tab, setTab] = useState("received");
  const [received, setReceived] = useState(null); // null=loading
  const [mine, setMine] = useState(null);
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

  const loadReceived = useCallback(async () => {
    setError(null);
    try {
      const foods = (await API.members.myFoods()) || [];
      const active = foods.filter((f) => f.statusTx === "IN_PROGRESS");
      const lists = await Promise.all(
        active.map((f) =>
          API.requests
            .received(f.foodId)
            .then((rs) => (rs || []).map((r) => ({ ...r, foodId: f.foodId, foodName: f.foodName })))
            .catch(() => [])
        )
      );
      const flat = lists.flat().filter((r) => r.status === "REQUEST");
      setReceived(flat);
    } catch (e) {
      setError(e);
      setReceived([]);
    }
  }, []);

  const loadMine = useCallback(async () => {
    try {
      const rs = (await API.requests.mine()) || [];
      setMine(rs);
    } catch {
      setMine([]);
    }
  }, []);

  useEffect(() => {
    loadReceived();
    loadMine();
  }, [loadReceived, loadMine]);

  const handleApprove = (id) => {
    API.requests.approve(id).catch(() => {});
    setReceived((prev) => (prev || []).filter((r) => r.requestFoodId !== id));
  };
  const handleReject = (id) => {
    API.requests.reject(id).catch(() => {});
    setReceived((prev) => (prev || []).filter((r) => r.requestFoodId !== id));
  };

  const newCount = (received || []).length;

  return (
    <>
      <div className="bell-scrim" onClick={onClose}></div>
      <div className="bell-panel" ref={ref}>
        <div className="bell-head">
          <div>
            <div className="eyebrow">NOTIFICATIONS</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>알림</h3>
          </div>
          <button className="icobtn" onClick={onClose} aria-label="닫기"><Icon.X /></button>
        </div>

        <div className="bell-tabs">
          <button className={`bell-tab ${tab === "received" ? "on" : ""}`} onClick={() => setTab("received")}>
            받은 요청 {newCount > 0 && <span className="num-pill">{newCount}</span>}
          </button>
          <button className={`bell-tab ${tab === "result" ? "on" : ""}`} onClick={() => setTab("result")}>내 요청 결과</button>
        </div>

        <div className="bell-list">
          {tab === "received" ? (
            received === null ? (
              <div className="bell-loading"><Spinner size={24} /></div>
            ) : error ? (
              <div className="bell-empty">알림을 불러오지 못했어요</div>
            ) : received.length === 0 ? (
              <div className="bell-empty">받은 요청이 없어요</div>
            ) : (
              received.map((r) => (
                <div className="notif-card new" key={r.requestFoodId}>
                  <div className="notif-top">
                    <Avatar name={r.requesterNickName} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="notif-line"><b>@{r.requesterNickName}</b></div>
                      <div className="notif-sub"><b>{r.foodName}</b>에 나눔 요청</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => handleReject(r.requestFoodId)}>거절</button>
                    <button className="btn primary sm" style={{ flex: 1.4 }} onClick={() => handleApprove(r.requestFoodId)}>수락</button>
                  </div>
                  <style>{notifCardStyles}</style>
                </div>
              ))
            )
          ) : mine === null ? (
            <div className="bell-loading"><Spinner size={24} /></div>
          ) : mine.length === 0 ? (
            <div className="bell-empty">보낸 요청이 없어요</div>
          ) : (
            mine.map((r, i) => {
              const label = { APPROVED: "수락됨", REJECTED: "거절됨", REQUEST: "대기중" }[r.status] || r.status;
              const isApproved = r.status === "APPROVED";
              return (
                <div className={`notif-card ${isApproved ? "accent" : "subtle"}`} key={r.requestFoodId || i}>
                  <div className="notif-line">
                    <b>{r.foodName || `요청 #${r.requestFoodId}`}</b>
                    <span className="notif-time">{label}</span>
                  </div>
                  {isApproved && (
                    <a className="link" style={{ marginTop: 6, display: "inline-block", fontSize: 12 }} onClick={onOpenTransaction}>
                      거래 정보 보기 →
                    </a>
                  )}
                  <style>{notifCardStyles}</style>
                </div>
              );
            })
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
        .bell-tabs { display: flex; gap: 18px; padding: 0 18px; border-bottom: 1px solid var(--line); }
        .bell-tab { position: relative; padding: 10px 0; font-size: 13px; font-weight: 600; color: var(--ink-4); }
        .bell-tab:hover { color: var(--ink-2); }
        .bell-tab.on { color: var(--ink); }
        .bell-tab.on::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--primary); border-radius: 2px; }
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
  .notif-card.accent { background: var(--accent-50); border-color: var(--accent-100); }
  .notif-card.subtle { background: var(--surface-2); }
  .notif-top { display: flex; gap: 10px; align-items: flex-start; }
  .notif-line { display: flex; align-items: baseline; gap: 8px; font-size: 13.5px; }
  .notif-line b { font-weight: 700; }
  .notif-time { margin-left: auto; font-size: 11px; color: var(--ink-4); font-family: var(--font-en); }
  .notif-sub { font-size: 12.5px; color: var(--ink-2); margin-top: 2px; }
  .link { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; font-weight: 600; }
  .link:hover { color: var(--primary-700); }
`;

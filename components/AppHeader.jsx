"use client";

/* components/AppHeader.jsx — 상단 네비게이션 + 알림 드롭다운 */

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Avatar } from "@/components/ui";
import API from "@/lib/api";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [bellOpen, setBellOpen] = useState(false);
  const notifCount = 2;

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
        <button
          className={`btn ${isRegister ? "primary" : "ghost"}`}
          onClick={() => router.push("/register")}
        >
          <Icon.Plus /> 글쓰기
        </button>

        <button
          className={`icobtn ${bellOpen ? "on" : ""}`}
          onClick={() => setBellOpen((v) => !v)}
          aria-label="알림"
        >
          <Icon.Bell />
          {notifCount > 0 && !bellOpen && <span className="dot">{notifCount}</span>}
        </button>

        <button
          className={`icobtn ${isMypage ? "on" : ""}`}
          onClick={() => router.push("/mypage")}
          aria-label="마이페이지"
        >
          <Avatar name="나눔러" size={28} />
        </button>
      </div>

      {bellOpen && (
        <BellDropdown
          onClose={() => setBellOpen(false)}
          onOpenTransaction={() => {
            setBellOpen(false);
            router.push("/transaction");
          }}
        />
      )}
    </div>
  );
}

/* ============ Bell Dropdown ============
   Data sources per v3 API spec:
   - 받은 요청 tab: GET /foods/{foodId}/requests (status=REQUEST) per my foods
   - 내 요청 결과 tab: GET /members/me/requests (status=APPROVED|REJECTED)
   Actions: PATCH /requests/{requestFoodId}/approve | reject
   Note: spec has no unified GET /alerts endpoint — panel aggregates client-side. */
function BellDropdown({ onClose, onOpenTransaction }) {
  const [items, setItems] = useState([
    { id: 1, kind: "new", requestFoodId: 501, who: "hungry_panda", food: "참치캔 6개입 (미개봉)", time: "방금 전" },
    { id: 2, kind: "new", requestFoodId: 502, who: "green_kim", food: "참치캔 6개입 (미개봉)", time: "8분 전" },
    { id: 3, kind: "approved", who: "sunny_kim", food: "스팸 클래식 200g x 4", time: "1시간 전" },
    { id: 4, kind: "completed", food: "오뚜기 카레 (백미)", time: "어제" },
    { id: 5, kind: "rejected", who: "warm_lee", food: "초코파이 박스 24입", time: "2일 전" },
  ]);

  const [tab, setTab] = useState("all");
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

  const handleApprove = (id) => {
    const it = items.find((x) => x.id === id);
    if (it && it.requestFoodId) API.requests.approve(it.requestFoodId).catch(() => {});
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, kind: "self-approved" } : x)));
  };
  const handleReject = (id) => {
    const it = items.find((x) => x.id === id);
    if (it && it.requestFoodId) API.requests.reject(it.requestFoodId).catch(() => {});
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, kind: "self-rejected" } : x)));
  };

  const filtered =
    tab === "all"
      ? items
      : tab === "received"
      ? items.filter((it) => it.kind === "new" || it.kind === "self-approved" || it.kind === "self-rejected")
      : items.filter((it) => it.kind === "approved" || it.kind === "completed" || it.kind === "rejected");

  const newCount = items.filter((it) => it.kind === "new").length;

  return (
    <>
      <div className="bell-scrim" onClick={onClose}></div>
      <div className="bell-panel" ref={ref}>
        <div className="bell-head">
          <div>
            <div className="eyebrow">NOTIFICATIONS</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>알림</h3>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn ghost sm">모두 읽음</button>
            <button className="icobtn" onClick={onClose} aria-label="닫기"><Icon.X /></button>
          </div>
        </div>

        <div className="bell-tabs">
          <button className={`bell-tab ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>전체</button>
          <button className={`bell-tab ${tab === "received" ? "on" : ""}`} onClick={() => setTab("received")}>
            받은 요청 {newCount > 0 && <span className="num-pill">{newCount}</span>}
          </button>
          <button className={`bell-tab ${tab === "result" ? "on" : ""}`} onClick={() => setTab("result")}>내 요청 결과</button>
        </div>

        <div className="bell-list">
          {filtered.length === 0 && (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
              해당하는 알림이 없어요
            </div>
          )}
          {filtered.map((it) => (
            <NotifCard key={it.id} item={it} onApprove={handleApprove} onReject={handleReject} onOpenTransaction={onOpenTransaction} />
          ))}
        </div>

        <div className="bell-foot">
          <button className="btn ghost sm" style={{ width: "100%" }}>
            전체 알림 보기 <Icon.ArrowRight />
          </button>
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
        .bell-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px 12px; border-bottom: 1px solid var(--line);
        }
        .bell-tabs { display: flex; gap: 18px; padding: 0 18px; border-bottom: 1px solid var(--line); }
        .bell-tab { position: relative; padding: 10px 0; font-size: 13px; font-weight: 600; color: var(--ink-4); }
        .bell-tab:hover { color: var(--ink-2); }
        .bell-tab.on { color: var(--ink); }
        .bell-tab.on::after {
          content: ""; position: absolute; left: 0; right: 0; bottom: -1px;
          height: 2px; background: var(--primary); border-radius: 2px;
        }
        .num-pill {
          display: inline-block; margin-left: 4px; padding: 1px 7px;
          background: var(--danger); color: #fff; border-radius: 999px;
          font-size: 11px; font-weight: 700;
        }
        .bell-list { padding: 8px; overflow-y: auto; flex: 1; min-height: 0; }
        .bell-foot { padding: 10px 14px; border-top: 1px solid var(--line); background: var(--surface-2); }
        @media (max-width: 900px) {
          .bell-panel { top: 60px; right: 12px; left: 12px; width: auto; max-width: none; }
        }
      `}</style>
    </>
  );
}

/* ============ Notification Card ============ */
function NotifCard({ item, onApprove, onReject, onOpenTransaction }) {
  const it = item;

  if (it.kind === "new") {
    return (
      <div className="notif-card new">
        <div className="notif-top">
          <Avatar name={it.who} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="notif-line">
              <b>@{it.who}</b>
              <span className="notif-time">{it.time}</span>
            </div>
            <div className="notif-sub"><b>{it.food}</b>에 나눔 요청</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => onReject(it.id)}>거절</button>
          <button className="btn primary sm" style={{ flex: 1.4 }} onClick={() => onApprove(it.id)}>수락</button>
        </div>
        <style>{notifCardStyles}</style>
      </div>
    );
  }

  if (it.kind === "self-approved") {
    return (
      <div className="notif-card resolved approved">
        <div className="resolved-icon"><Icon.Check /></div>
        <div style={{ flex: 1 }}>
          <div className="notif-line"><b>@{it.who}</b> 요청을 수락했어요</div>
          <div className="notif-sub-2">{it.food} · <a className="link" onClick={onOpenTransaction}>거래 정보 보기</a></div>
        </div>
        <style>{notifCardStyles}</style>
      </div>
    );
  }

  if (it.kind === "self-rejected") {
    return (
      <div className="notif-card resolved rejected">
        <div className="resolved-icon"><Icon.X /></div>
        <div style={{ flex: 1 }}>
          <div className="notif-line"><b>@{it.who}</b> 요청을 거절했어요</div>
          <div className="notif-sub-2">{it.food}</div>
        </div>
        <style>{notifCardStyles}</style>
      </div>
    );
  }

  if (it.kind === "approved") {
    return (
      <div className="notif-card accent">
        <div style={{ flex: 1 }}>
          <div className="notif-line">
            <b>@{it.who}</b> 님이 수락했어요
            <span className="notif-time">{it.time}</span>
          </div>
          <div className="notif-sub">{it.food}</div>
          <a className="link" style={{ marginTop: 6, display: "inline-block", fontSize: 12 }} onClick={onOpenTransaction}>
            거래 정보 보기 →
          </a>
        </div>
        <style>{notifCardStyles}</style>
      </div>
    );
  }

  if (it.kind === "completed") {
    return (
      <div className="notif-card subtle">
        <div className="kind-eyebrow"><Icon.Check style={{ width: 12, height: 12 }} /> 거래 완료</div>
        <div className="notif-sub" style={{ marginTop: 4 }}><b>{it.food}</b> · 정원이 다 찼어요</div>
        <div className="notif-time" style={{ marginTop: 2 }}>{it.time}</div>
        <style>{notifCardStyles}</style>
      </div>
    );
  }

  if (it.kind === "rejected") {
    return (
      <div className="notif-card subtle">
        <div className="kind-eyebrow" style={{ color: "var(--danger)" }}><Icon.X style={{ width: 12, height: 12 }} /> 요청 거절</div>
        <div className="notif-sub" style={{ marginTop: 4 }}><b>{it.food}</b> · @{it.who}</div>
        <div className="notif-time" style={{ marginTop: 2 }}>{it.time}</div>
        <style>{notifCardStyles}</style>
      </div>
    );
  }

  return null;
}

const notifCardStyles = `
  .notif-card {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 10px; padding: 12px 14px; margin-bottom: 6px;
    transition: border-color 0.12s;
  }
  .notif-card:hover { border-color: var(--line-2); }
  .notif-card.new { border-color: var(--primary-100); background: var(--primary-50); }
  .notif-card.accent { background: var(--accent-50); border-color: var(--accent-100); }
  .notif-card.subtle { background: var(--surface-2); }
  .notif-card.resolved { display: flex; gap: 10px; align-items: flex-start; background: var(--bg-2); opacity: 0.85; }
  .notif-top { display: flex; gap: 10px; align-items: flex-start; }
  .notif-line { display: flex; align-items: baseline; gap: 8px; font-size: 13.5px; }
  .notif-line b { font-weight: 700; }
  .notif-time { margin-left: auto; font-size: 11px; color: var(--ink-4); font-family: var(--font-en); }
  .notif-sub { font-size: 12.5px; color: var(--ink-2); margin-top: 2px; }
  .notif-sub-2 { font-size: 12px; color: var(--ink-3); margin-top: 2px; }
  .resolved-icon {
    width: 28px; height: 28px; border-radius: 999px;
    display: grid; place-items: center; flex-shrink: 0;
    background: var(--ink-5); color: #fff;
  }
  .notif-card.resolved.approved .resolved-icon { background: var(--primary); }
  .notif-card.resolved.rejected .resolved-icon { background: var(--danger); }
  .kind-eyebrow {
    font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--primary);
    display: inline-flex; align-items: center; gap: 4px;
  }
  .link { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; font-weight: 600; }
  .link:hover { color: var(--primary-700); }
`;

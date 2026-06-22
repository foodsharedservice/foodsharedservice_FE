"use client";

/* DetailScreen.jsx — 물품 상세
   API:
     GET    /foods/{foodId}                                   상세
     POST   /foods/{foodId}/requests                          나눔 요청
     GET    /foods/{foodId}/requests/me                       내 요청 상태
     DELETE /foods/{foodId}/requests/{requestId}              요청 취소
     GET    /foods/{foodId}/requests           (등록자)       받은 요청 목록
     PATCH  /foods/{foodId}/requests/{id}/approve|reject (등록자)
     POST   /chat/rooms { foodId }                            채팅방 생성
   상세 응답: { foodId, memberId, foodName, details, capacity, approvedCount, statusTx, expired, region, imageUrls[] } */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { StatusBadge, Photo, Avatar, CapacityBar, StateBox } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

export default function DetailScreen({ foodId }) {
  const router = useRouter();
  const { user } = useAuth();

  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);

  const [myReq, setMyReq] = useState(null); // {requestFoodId, status} | null
  const [received, setReceived] = useState(null); // 등록자: [{requestFoodId, memberId, status}]
  const [requestModal, setRequestModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const isOwner = !!(user && d && user.memberId === d.memberId);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const loadDetail = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    API.foods
      .detail(foodId)
      .then((data) => { if (alive) { setD(data); setPhotoIdx(0); } })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [foodId]);

  useEffect(() => loadDetail(), [loadDetail]);

  // 등록자/요청자에 따라 추가 데이터 로드
  useEffect(() => {
    if (!d || !user) return;
    if (user.memberId === d.memberId) {
      API.requests.received(foodId).then((rs) => setReceived(rs || [])).catch(() => setReceived([]));
    } else {
      API.requests.mine(foodId).then((r) => setMyReq(r || null)).catch(() => setMyReq(null));
    }
  }, [d, user, foodId]);

  const images = (d && d.imageUrls) || [];
  const prev = useCallback(() => images.length && setPhotoIdx((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => images.length && setPhotoIdx((i) => (i + 1) % images.length), [images.length]);

  if (loading) {
    return (
      <div className="detail">
        <div className="detail-crumb"><button className="crumb-back" onClick={() => router.push("/")}><Icon.ChevronLeft /> 목록으로</button></div>
        <StateBox kind="loading" title="물품 정보를 불러오는 중…" />
      </div>
    );
  }
  if (error || !d) {
    const notFound = error && error.status === 404;
    return (
      <div className="detail">
        <div className="detail-crumb"><button className="crumb-back" onClick={() => router.push("/")}><Icon.ChevronLeft /> 목록으로</button></div>
        <StateBox
          kind="error"
          title={notFound ? "존재하지 않는 물품이에요" : "물품 정보를 불러오지 못했어요"}
          sub={notFound ? "삭제되었거나 잘못된 주소일 수 있어요." : `서버에 연결할 수 없습니다. (${(error && (error.code || error.status || error.message)) || "네트워크 오류"})`}
          onRetry={notFound ? undefined : loadDetail}
        />
      </div>
    );
  }

  const expDate = d.expired ? new Date(d.expired) : null;
  const daysLeft = expDate ? Math.ceil((expDate - new Date()) / 86400000) : null;
  const full = d.approvedCount >= d.capacity;
  const requestable = d.statusTx === "IN_PROGRESS" && !full;

  const requireLogin = () => { router.push("/login"); };

  const submitRequest = () => {
    if (!user) return requireLogin();
    setBusy(true);
    API.requests.create(d.foodId)
      .then((r) => {
        setMyReq({ requestFoodId: r && r.requestFoodId, status: "REQUEST" });
        setRequestModal(false);
        showToast("나눔 요청을 보냈어요! 등록자가 수락하면 채팅으로 진행돼요.");
      })
      .catch((e) => {
        const map = {
          FOOD_REQUEST_ALREADY_EXISTS: "이미 요청한 물품이에요.",
          FOOD_FORBIDDEN: "본인이 등록한 물품에는 요청할 수 없어요.",
          FOOD_NOT_AVAILABLE: "지금은 요청할 수 없는 상태예요.",
        };
        showToast(map[e.code] || e.message || "요청에 실패했어요.");
      })
      .finally(() => setBusy(false));
  };

  const cancelMyRequest = () => {
    if (!myReq) return;
    API.requests.cancel(d.foodId, myReq.requestFoodId)
      .then(() => { setMyReq(null); showToast("요청을 취소했어요."); })
      .catch((e) => showToast(e.message || "취소에 실패했어요."));
  };

  const openChat = () => {
    if (!user) return requireLogin();
    API.chat.createRoom(d.foodId)
      .then((room) => { if (room && room.roomId) router.push(`/chat/${room.roomId}`); })
      .catch((e) => {
        const map = { SELF_CHAT_NOT_ALLOWED: "본인 물품에는 채팅할 수 없어요.", FOOD_NOT_AVAILABLE: "지금은 채팅방을 만들 수 없어요." };
        showToast(map[e.code] || "채팅방을 열지 못했어요.");
      });
  };

  const handleApprove = (rid) => {
    API.requests.approve(d.foodId, rid)
      .then(() => { setReceived((p) => (p || []).map((r) => r.requestFoodId === rid ? { ...r, status: "APPROVED" } : r)); loadDetail(); showToast("요청을 수락했어요."); })
      .catch((e) => showToast(e.message || "수락에 실패했어요."));
  };
  const handleReject = (rid) => {
    API.requests.reject(d.foodId, rid)
      .then(() => { setReceived((p) => (p || []).map((r) => r.requestFoodId === rid ? { ...r, status: "REJECTED" } : r)); showToast("요청을 거절했어요."); })
      .catch((e) => showToast(e.message || "거절에 실패했어요."));
  };

  const deleteFood = () => {
    if (!window.confirm("이 나눔을 삭제할까요?")) return;
    API.foods.remove(d.foodId).then(() => router.push("/mypage")).catch((e) => showToast(e.message || "삭제에 실패했어요."));
  };

  const reqStatusLabel = { REQUEST: "수락 대기중", APPROVED: "수락됨 ✓", REJECTED: "거절됨" };

  return (
    <div className="detail">
      <div className="detail-crumb">
        <button className="crumb-back" onClick={() => router.push("/")}><Icon.ChevronLeft /> 목록으로</button>
        <span className="crumb-sep">/</span>
        <span style={{ color: "var(--ink-2)" }}>{d.foodName}</span>
      </div>

      <div className="detail-grid">
        {/* ===== left: gallery ===== */}
        <div className="detail-left">
          <div className="gallery">
            <Photo label="나눔장터" src={images[photoIdx]} ratio="1/1" />
            <div className="gallery-tl"><StatusBadge status={d.statusTx} solid /></div>
            {images.length > 1 && (
              <>
                <button className="gallery-arrow left" onClick={prev} aria-label="이전"><Icon.ChevronLeft /></button>
                <button className="gallery-arrow right" onClick={next} aria-label="다음"><Icon.ChevronRight /></button>
                <div className="gallery-counter font-en">{photoIdx + 1} / {images.length}</div>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((url, i) => (
                <button key={i} className={`thumb ${i === photoIdx ? "on" : ""}`} onClick={() => setPhotoIdx(i)}>
                  <Photo label="" src={url} ratio="1/1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ===== right: info ===== */}
        <div className="detail-right">
          <div className="owner-row">
            <Avatar name={isOwner ? (user.nickName || "나") : "이웃"} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="owner-name">{isOwner ? "내가 등록한 나눔" : "이웃 나눔"}</div>
              <div className="owner-sub">{d.region || "지역 미설정"}</div>
            </div>
            {isOwner && (
              <button className="btn danger-ghost sm" onClick={deleteFood}><Icon.Trash /> 삭제</button>
            )}
          </div>

          <h1 className="detail-title">{d.foodName}</h1>
          <div className="detail-price">무료나눔</div>

          <div className="info-table">
            <div className="info-row">
              <span className="info-k"><Icon.Calendar /> 소비기한</span>
              <span className="info-v">
                <span className="font-en" style={{ fontWeight: 700 }}>{d.expired || "—"}</span>
                {daysLeft != null && <span className={`d-pill ${daysLeft <= 7 ? "warn" : ""}`}>{daysLeft < 0 ? `만료` : `D-${daysLeft}`}</span>}
              </span>
            </div>
            <div className="info-row">
              <span className="info-k"><Icon.Users /> 모집 인원</span>
              <span className="info-v"><CapacityBar approved={d.approvedCount} total={d.capacity} /></span>
            </div>
            {d.region && (
              <div className="info-row">
                <span className="info-k"><Icon.Pin /> 지역</span>
                <span className="info-v">{d.region}</span>
              </div>
            )}
          </div>

          <div className="detail-desc">
            {(d.details || "").split("\n").map((p, i) => <p key={i}>{p || " "}</p>)}
          </div>

          {/* ===== actions ===== */}
          {isOwner ? (
            <OwnerRequests
              received={received}
              capacity={d.capacity}
              approvedCount={d.approvedCount}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ) : (
            <div className="cta-block">
              <button className="btn ghost lg" onClick={openChat}><Icon.Chat /> 채팅하기</button>
              {myReq ? (
                <div className="my-req">
                  <span className={`my-req-badge ${myReq.status === "APPROVED" ? "ok" : myReq.status === "REJECTED" ? "no" : ""}`}>
                    {reqStatusLabel[myReq.status] || myReq.status}
                  </span>
                  {myReq.status === "APPROVED" ? (
                    <button className="btn primary lg cta" onClick={openChat}>채팅으로 픽업 잡기</button>
                  ) : myReq.status === "REQUEST" ? (
                    <button className="btn ghost lg" onClick={cancelMyRequest}>요청 취소</button>
                  ) : (
                    <button className="btn ghost lg" disabled>거절된 요청</button>
                  )}
                </div>
              ) : (
                <button
                  className="btn primary lg cta"
                  disabled={!requestable || busy}
                  onClick={() => (user ? setRequestModal(true) : requireLogin())}
                >
                  {d.statusTx !== "IN_PROGRESS" ? "마감된 나눔이에요" : full ? "모집이 마감됐어요" : "나눔 요청하기"}
                </button>
              )}
            </div>
          )}
          {!isOwner && <div className="cta-hint">요청 후 등록자가 수락하면 채팅으로 픽업을 조율해요.</div>}
        </div>
      </div>

      {requestModal && (
        <RequestModal food={d} busy={busy} onClose={() => setRequestModal(false)} onSubmit={submitRequest} />
      )}
      {toast && <div className="detail-toast">{toast}</div>}

      <style>{`
        .detail { max-width: var(--maxw); margin: 0 auto; padding: 0 24px 60px; }
        .detail-crumb { display: flex; align-items: center; gap: 8px; padding: 16px 0; font-size: 13px; color: var(--ink-4); }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .gallery { position: relative; background: var(--bg-2); border-radius: var(--r-card); overflow: hidden; }
        .gallery .ph { border-radius: var(--r-card); }
        .gallery-tl { position: absolute; top: 14px; left: 14px; }
        .gallery-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.92); color: var(--ink); display: grid; place-items: center; box-shadow: var(--shadow-card); }
        .gallery-arrow:hover { background: #fff; }
        .gallery-arrow.left { left: 12px; } .gallery-arrow.right { right: 12px; }
        .gallery-counter { position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.66); color: #fff; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; }
        .gallery-thumbs { display: flex; gap: 8px; margin-top: 10px; }
        .thumb { width: 64px; height: 64px; padding: 0; border-radius: 8px; overflow: hidden; border: 2px solid transparent; flex-shrink: 0; }
        .thumb .ph { border-radius: 6px; }
        .thumb.on { border-color: var(--primary); }
        .detail-right { display: flex; flex-direction: column; }
        .owner-row { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
        .owner-name { font-weight: 700; font-size: 14.5px; }
        .owner-sub { font-size: 12.5px; color: var(--ink-4); margin-top: 2px; }
        .detail-title { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.3; margin-top: 18px; }
        .detail-price { font-size: 24px; font-weight: 800; color: var(--primary); margin-top: 6px; }
        .info-table { margin-top: 20px; border: 1px solid var(--line); border-radius: var(--r-card); overflow: hidden; }
        .info-row { display: flex; align-items: center; padding: 13px 16px; }
        .info-row + .info-row { border-top: 1px solid var(--line); }
        .info-k { display: inline-flex; align-items: center; gap: 7px; width: 120px; font-size: 12.5px; font-weight: 600; color: var(--ink-3); }
        .info-v { flex: 1; font-size: 13.5px; display: flex; align-items: center; gap: 10px; }
        .detail-desc { font-size: 14px; line-height: 1.75; color: var(--ink-2); margin: 22px 0; padding-bottom: 22px; border-bottom: 1px solid var(--line); white-space: pre-wrap; }
        .detail-desc p + p { margin-top: 10px; }
        .cta-block { display: flex; gap: 8px; }
        .cta { flex: 1; }
        .my-req { flex: 1; display: flex; align-items: center; gap: 10px; }
        .my-req-badge { padding: 0 12px; height: 48px; display: inline-flex; align-items: center; border-radius: var(--r-btn); background: var(--bg-2); color: var(--ink-2); font-weight: 700; font-size: 13px; }
        .my-req-badge.ok { background: var(--success-100); color: #0a7a45; }
        .my-req-badge.no { background: var(--bg-2); color: var(--ink-4); }
        .my-req .btn { flex: 1; }
        .cta-hint { text-align: center; font-size: 12px; color: var(--ink-4); margin-top: 12px; }
        .detail-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); padding: 12px 20px; background: var(--ink); color: #fff; border-radius: 999px; font-size: 13.5px; font-weight: 600; box-shadow: var(--shadow-pop); z-index: 300; max-width: 90vw; }
        @media (max-width: 900px) {
          .detail { padding: 0 14px 50px; }
          .detail-grid { grid-template-columns: 1fr; gap: 20px; }
          .detail-title { font-size: 20px; }
        }
      `}</style>
    </div>
  );
}

/* ============ 등록자: 받은 요청 관리 ============ */
function OwnerRequests({ received, capacity, approvedCount, onApprove, onReject }) {
  const statusLabel = { REQUEST: "대기중", APPROVED: "수락됨", REJECTED: "거절됨" };
  return (
    <div className="owner-reqs">
      <div className="owner-reqs-head">
        <b>받은 나눔 요청</b>
        <span className="font-en" style={{ color: "var(--ink-4)", fontSize: 12.5 }}>{approvedCount}/{capacity} 수락</span>
      </div>
      {received === null ? (
        <div className="owner-reqs-empty">불러오는 중…</div>
      ) : received.length === 0 ? (
        <div className="owner-reqs-empty">아직 받은 요청이 없어요</div>
      ) : (
        <div className="owner-reqs-list">
          {received.map((r) => (
            <div className="oreq" key={r.requestFoodId}>
              <Avatar name={`회${r.memberId}`} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="oreq-name">회원 #{r.memberId}</div>
                <div className="oreq-status">{statusLabel[r.status] || r.status}</div>
              </div>
              {r.status === "REQUEST" ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn ghost sm" onClick={() => onReject(r.requestFoodId)}>거절</button>
                  <button className="btn primary sm" onClick={() => onApprove(r.requestFoodId)}>수락</button>
                </div>
              ) : (
                <span className={`badge ${r.status === "APPROVED" ? "done" : "incomplete"}`}>{statusLabel[r.status]}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`
        .owner-reqs { border: 1px solid var(--line); border-radius: var(--r-card); padding: 16px; }
        .owner-reqs-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; font-size: 14.5px; }
        .owner-reqs-empty { padding: 24px 0; text-align: center; color: var(--ink-4); font-size: 13px; }
        .owner-reqs-list { display: flex; flex-direction: column; gap: 10px; }
        .oreq { display: flex; align-items: center; gap: 10px; }
        .oreq-name { font-size: 13.5px; font-weight: 600; }
        .oreq-status { font-size: 11.5px; color: var(--ink-4); margin-top: 1px; }
      `}</style>
    </div>
  );
}

/* ============ 요청 모달 ============ */
function RequestModal({ food, busy, onClose, onSubmit }) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="닫기"><Icon.X /></button>
        <div className="eyebrow" style={{ color: "var(--primary)" }}>NEW REQUEST</div>
        <h2 style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>나눔 요청 보내기</h2>
        <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6, marginBottom: 16, lineHeight: 1.6 }}>
          <b>{food.foodName}</b> 나눔을 요청해요. 등록자가 수락하면 채팅으로 픽업을 조율할 수 있어요.
        </p>
        <div className="modal-summary">
          <Photo label="" src={(food.imageUrls && food.imageUrls[0]) || undefined} ratio="1/1" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{food.foodName}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}>
              소비기한 {food.expired || "—"} · {food.approvedCount}/{food.capacity}명 모집
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>취소</button>
          <button className="btn primary" style={{ flex: 2 }} onClick={onSubmit} disabled={busy}>
            {busy ? "보내는 중…" : "요청 보내기"}
          </button>
        </div>
      </div>
      <style>{`
        .modal-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 200; display: grid; place-items: center; padding: 20px; }
        .modal { width: 100%; max-width: 420px; background: var(--surface); border-radius: 14px; padding: 26px; position: relative; box-shadow: var(--shadow-pop); }
        .modal-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; color: var(--ink-3); }
        .modal-close:hover { background: var(--bg-2); }
        .modal-summary { display: flex; gap: 12px; align-items: center; padding: 12px; background: var(--bg-2); border-radius: 10px; }
        .modal-summary .ph { width: 56px; height: 56px; flex-shrink: 0; }
      `}</style>
    </div>
  );
}

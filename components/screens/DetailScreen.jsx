"use client";

/* DetailScreen.jsx — D-02 물품 상세 (실제 API)
   GET /foods/{foodId} → { foodId, memberId, foodName, details, capacity,
                           approvedCount, statusTx, expired, region, imageUrls[] }
   요청 보내기:   POST   /foods/{foodId}/requests
   내 신청 상태:  GET    /foods/{foodId}/requests/me  (없으면 404)
   내 신청 취소:  DELETE /foods/{foodId}/requests/{requestId}
   받은 요청(등록자): GET /foods/{foodId}/requests + approve/reject
   채팅:          POST   /chat/rooms { foodId } → roomId → /chat/{roomId} */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { StatusBadge, Photo, Avatar, CapacityBar, StateBox, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

export default function DetailScreen({ foodId }) {
  const router = useRouter();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [requestModal, setRequestModal] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [reqError, setReqError] = useState(null);
  const [toast, setToast] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [myRequest, setMyRequest] = useState(null); // { requestId, status } | null

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    API.foods.detail(foodId)
      .then((data) => { if (alive) { setD(data); setPhotoIdx(0); } })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [foodId]);

  useEffect(() => load(), [load]);

  // 등록자 여부 판별: 상세 응답엔 소유자 식별자가 없으므로 내 물품 목록과 대조
  useEffect(() => {
    if (!user || !d) { setIsOwner(false); return; }
    let alive = true;
    API.foods.myFoods()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res && res.content) || [];
        if (alive) setIsOwner(list.some((f) => f.foodId === d.foodId));
      })
      .catch(() => { if (alive) setIsOwner(false); });
    return () => { alive = false; };
  }, [user, d]);

  // 내 신청 상태 조회 (신청자 뷰에서 취소 버튼 표시용)
  useEffect(() => {
    if (!user || !d || isOwner) { setMyRequest(null); return; }
    let alive = true;
    API.requests.mySent()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res && res.content) || [];
        const found = list.find((r) => r.foodId === d.foodId);
        if (alive) setMyRequest(found ? { requestId: found.requestId, status: found.status } : null);
      })
      .catch(() => { if (alive) setMyRequest(null); });
    return () => { alive = false; };
  }, [user, d, isOwner]);

  const images = (d && d.images) || [];

  const prev = useCallback(() => {
    if (!images.length) return;
    setPhotoIdx((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);
  const next = useCallback(() => {
    if (!images.length) return;
    setPhotoIdx((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (requestModal) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestModal, prev, next]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  if (loading) {
    return (
      <div className="detail">
        <div className="detail-crumb">
          <button className="crumb-back" onClick={() => router.push("/")}><Icon.ChevronLeft /> 홈으로</button>
        </div>
        <StateBox kind="loading" title="물품 정보를 불러오는 중…" />
      </div>
    );
  }
  if (error || !d) {
    const notFound = error && error.status === 404;
    return (
      <div className="detail">
        <div className="detail-crumb">
          <button className="crumb-back" onClick={() => router.push("/")}><Icon.ChevronLeft /> 홈으로</button>
        </div>
        <StateBox
          kind="error"
          title={notFound ? "존재하지 않는 물품이에요" : "물품 정보를 불러오지 못했어요"}
          sub={notFound ? "삭제되었거나 잘못된 주소일 수 있어요." : `서버에 연결할 수 없습니다. (${(error && (error.code || error.status || error.message)) || "네트워크 오류"})`}
          onRetry={notFound ? undefined : load}
        />
      </div>
    );
  }

  const expDate = new Date(d.expired);
  const daysLeft = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
  const cur = images[photoIdx];
  const curUrl = cur && cur.accessUrl;
  const isExpImage = cur && cur.imageType === "EXPIRED";
  const full = d.approvedCount >= d.capacity;

  const submitRequest = () => {
    setReqError(null);
    API.requests.create(d.foodId)
      .then((res) => {
        if (res && res.requestId) setMyRequest({ requestId: res.requestId, status: "REQUEST" });
        setRequestSent(true);
        setTimeout(() => { setRequestModal(false); load(); }, 1300);
      })
      .catch((e) => {
        const map = {
          REQUEST_DUPLICATED: "이미 요청한 물품이에요.",
          SELF_REQUEST_NOT_ALLOWED: "본인이 등록한 물품에는 요청할 수 없어요.",
          FOOD_NOT_AVAILABLE: "지금은 요청할 수 없는 상태예요 (완료/만료 등).",
          FOOD_NOT_FOUND: "삭제된 물품이에요.",
        };
        setReqError(map[e.code] || e.message || "요청에 실패했어요.");
      });
  };

  const openChat = () => {
    if (!user) { router.push("/login"); return; }
    setChatBusy(true);
    API.chat.createRoom(d.foodId)
      .then((room) => { if (room && room.roomId) router.push(`/chat/${room.roomId}`); })
      .catch((e) => {
        const map = {
          SELF_CHAT_NOT_ALLOWED: "본인 물품에는 채팅할 수 없어요.",
          FOOD_NOT_FOUND: "삭제된 물품이에요.",
        };
        showToast(map[e.code] || "채팅방을 열지 못했어요.");
      })
      .finally(() => setChatBusy(false));
  };

  return (
    <div className="detail">
      <div className="detail-crumb">
        <button className="crumb-back" onClick={() => router.push("/")}><Icon.ChevronLeft /> 홈으로</button>
        <span className="crumb-sep">/</span>
        <span style={{ color: "var(--ink)" }}>{d.foodName}</span>
      </div>

      <div className="detail-grid">
        {/* ============ Left: image carousel ============ */}
        <div className="detail-left">
          <div className="carousel">
            <Photo label="나눔마켓" src={curUrl} />
            <div className="carousel-tl"><StatusBadge status={d.statusTx} solid /></div>
            {isExpImage && (
              <div className="carousel-tr exp-tag"><Icon.Calendar /> 소비기한 인증 사진</div>
            )}
            {images.length > 0 && (
              <div className="carousel-counter">
                <span className="font-en">{photoIdx + 1}</span><span>/</span><span className="font-en">{images.length}</span>
              </div>
            )}
            {images.length > 1 && (
              <>
                <button className="carousel-arrow left" onClick={prev} aria-label="이전"><Icon.ChevronLeft /></button>
                <button className="carousel-arrow right" onClick={next} aria-label="다음"><Icon.ChevronRight /></button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="carousel-thumbs">
              {images.map((img, i) => (
                <button key={img.imageId ?? i} className={`thumb ${i === photoIdx ? "on" : ""}`} onClick={() => setPhotoIdx(i)}>
                  <Photo label="" src={img.accessUrl} ratio="1/1" />
                  {img.imageType === "EXPIRED" && <div className="thumb-star">⭐</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ============ Right: info ============ */}
        <div className="detail-right">
          <div className="detail-owner">
            <Avatar name={d.ownerNickName || (isOwner ? (user && user.nickName) || "나" : "?")} size={42} />
            <div style={{ flex: 1 }}>
              <div className="owner-name">{isOwner ? "내가 등록한 물품" : (d.ownerNickName || "이웃")}</div>
              <div className="owner-sub">등록자</div>
            </div>
          </div>

          <h1 className="detail-title" style={{ marginTop: 18 }}>{d.foodName}</h1>

          <div className="detail-info">
            <div className="info-row">
              <div className="info-label"><Icon.Calendar /> 소비기한</div>
              <div className="info-value">
                <span className="font-en exp-date">{d.expired}</span>
                <span className={`d-pill ${daysLeft <= 14 ? "warn" : ""}`}>{daysLeft < 0 ? `D+${Math.abs(daysLeft)}` : `D-${daysLeft}`}</span>
              </div>
            </div>
            <div className="info-row">
              <div className="info-label"><Icon.Users /> 정원</div>
              <div className="info-value"><CapacityBar approved={d.approvedCount} total={d.capacity} /></div>
            </div>
          </div>

          <div className="detail-desc">
            {(d.details || "").split("\n").map((p, i) => <p key={i}>{p}</p>)}
          </div>

          {/* ============ 등록자: 받은 요청 관리 ============ */}
          {isOwner ? (
            <OwnerRequests foodId={d.foodId} onChange={load} />
          ) : (
            <>
              <div className="detail-cta-row">
                <button className="btn ghost lg" onClick={openChat} disabled={chatBusy}>
                  <Icon.Chat /> {chatBusy ? "여는 중…" : "채팅하기"}
                </button>
                <button
                  className="btn primary lg cta"
                  onClick={() => {
                    if (!user) { router.push("/login"); return; }
                    setReqError(null); setRequestSent(false); setRequestModal(true);
                  }}
                  disabled={!!user && (d.statusTx !== "IN_PROGRESS" || full || (myRequest && myRequest.status === "REQUEST"))}
                >
                  {!user
                    ? "로그인하고 요청하기"
                    : myRequest && myRequest.status === "REQUEST"
                    ? "요청을 보냈어요"
                    : d.statusTx !== "IN_PROGRESS"
                    ? "요청할 수 없는 상태예요"
                    : full
                    ? "정원이 다 찼어요"
                    : "나눔 요청 보내기"}
                </button>
              </div>
              {myRequest && myRequest.status === "REQUEST" && (
                <button
                  className="link-cancel"
                  onClick={() => {
                    if (!confirm("요청을 취소할까요?")) return;
                    API.requests.cancel(d.foodId, myRequest.requestId)
                      .then(() => { setMyRequest(null); load(); })
                      .catch((e) => alert(e.message || "취소에 실패했어요."));
                  }}
                >
                  요청 취소하기
                </button>
              )}
              <div className="cta-hint">본인이 등록한 물품과 중복 요청은 보낼 수 없어요.</div>
            </>
          )}
        </div>
      </div>

      {requestModal && (
        <RequestModal
          food={d}
          sent={requestSent}
          error={reqError}
          onClose={() => { setRequestModal(false); setRequestSent(false); setReqError(null); }}
          onSubmit={submitRequest}
        />
      )}

      {toast && <div className="detail-toast"><Icon.Chat /> {toast}</div>}

      <style>{`
        .detail { padding: 0 0 40px; }
        .detail-crumb { display: flex; align-items: center; gap: 8px; padding: 16px 32px; font-size: 12.5px; color: var(--ink-4); }
        .crumb-back { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-2); font-weight: 500; padding: 4px 8px; margin-left: -8px; border-radius: 6px; }
        .crumb-back:hover { background: var(--bg-2); }
        .crumb-sep { color: var(--ink-5); }
        .detail-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 48px; padding: 0 32px; max-width: 1280px; margin: 0 auto; }
        .carousel { position: relative; background: var(--surface-2); border-radius: var(--r-img); overflow: hidden; }
        .carousel .ph { aspect-ratio: 4/3; border-radius: var(--r-img); }
        .carousel-tl { position: absolute; top: 14px; left: 14px; }
        .carousel-tr.exp-tag { position: absolute; top: 14px; right: 14px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--accent); color: var(--ink); border-radius: 999px; font-size: 11px; font-weight: 700; }
        .thumb-star { position: absolute; top: 4px; right: 4px; font-size: 11px; background: var(--accent); width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; }
        .carousel-counter { position: absolute; bottom: 14px; right: 14px; background: rgba(31,29,24,0.72); color: var(--bg); padding: 4px 10px; border-radius: 999px; font-size: 11.5px; display: inline-flex; gap: 3px; backdrop-filter: blur(6px); }
        .carousel-counter .font-en { font-family: var(--font-en); font-weight: 600; }
        .carousel-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.9); color: var(--ink); display: grid; place-items: center; box-shadow: 0 2px 8px rgba(31,29,24,0.12); transition: all 0.12s; }
        .carousel-arrow:hover { background: #fff; transform: translateY(-50%) scale(1.06); }
        .carousel-arrow.left { left: 14px; }
        .carousel-arrow.right { right: 14px; }
        .carousel-thumbs { display: flex; gap: 8px; margin-top: 10px; }
        .thumb { position: relative; flex: 1; padding: 0; border-radius: 8px; overflow: hidden; background: transparent; border: 2px solid transparent; transition: all 0.12s; }
        .thumb .ph { aspect-ratio: 1/1; border-radius: 6px; }
        .thumb:hover { border-color: var(--line-2); }
        .thumb.on { border-color: var(--primary); }
        .detail-right { display: flex; flex-direction: column; }
        .detail-owner { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
        .owner-name { font-weight: 700; font-size: 14.5px; }
        .owner-sub { font-size: 11.5px; color: var(--ink-4); margin-top: 2px; }
        .region-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--bg-2); border-radius: 999px; font-size: 11.5px; font-weight: 600; color: var(--ink-3); }
        .detail-title { font-size: 28px; font-weight: 800; line-height: 1.25; letter-spacing: -0.025em; margin-top: 4px; margin-bottom: 16px; }
        .detail-info { background: var(--bg-2); border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; }
        .info-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px dashed var(--line-2); }
        .info-row:last-child { border-bottom: 0; }
        .info-label { display: inline-flex; align-items: center; gap: 6px; width: 110px; font-size: 12.5px; font-weight: 600; color: var(--ink-3); }
        .info-value { flex: 1; font-size: 13.5px; display: flex; align-items: center; gap: 10px; }
        .exp-date { font-family: var(--font-en); font-size: 15px; font-weight: 700; color: var(--ink); letter-spacing: -0.01em; }
        .d-pill { font-family: var(--font-en); font-size: 11px; font-weight: 700; padding: 2px 8px; background: var(--primary-100); color: var(--primary-700); border-radius: 999px; letter-spacing: 0.02em; }
        .d-pill.warn { background: var(--accent-100); color: var(--accent-700); }
        .detail-desc { font-size: 14px; line-height: 1.7; color: var(--ink-2); margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--line); min-height: 40px; }
        .detail-desc p + p { margin-top: 12px; }
        .detail-cta-row { display: flex; gap: 8px; }
        .cta { flex: 1; }
        .cta-hint { text-align: center; font-size: 11.5px; color: var(--ink-4); margin-top: 10px; }
        .link-cancel { display: block; margin: 10px auto 0; font-size: 12px; color: var(--danger); text-decoration: underline; text-underline-offset: 2px; }
        .detail-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; background: var(--ink); color: var(--bg); border-radius: 999px; font-size: 13px; font-weight: 600; box-shadow: var(--shadow-pop); z-index: 300; animation: toastIn 0.2s ease; }
        @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 8px); } }
        @media (max-width: 900px) {
          .detail-crumb { padding: 12px 16px; }
          .detail-grid { grid-template-columns: 1fr; gap: 20px; padding: 0 16px; }
          .detail-title { font-size: 22px; }
        }
      `}</style>
    </div>
  );
}

/* ============ 등록자용: 받은 요청 목록 + 수락/거절 ============ */
function OwnerRequests({ foodId, onChange }) {
  const [list, setList] = useState(null); // null=loading
  const [err, setErr] = useState(null);

  const load = useCallback(() => {
    setErr(null);
    API.requests.received(foodId)
      .then((rs) => setList(Array.isArray(rs) ? rs : []))
      .catch((e) => { setErr(e); setList([]); });
  }, [foodId]);

  useEffect(() => load(), [load]);

  const act = (requestId, kind) => {
    const fn = kind === "approve"
      ? () => API.requests.approve(foodId, requestId)
      : () => API.requests.reject(foodId, requestId);
    fn()
      .then(() => { load(); onChange && onChange(); })
      .catch((e) => alert(e.message || "처리에 실패했어요."));
  };

  const pending = (list || []).filter((r) => r.status === "REQUEST");
  const decided = (list || []).filter((r) => r.status !== "REQUEST");

  return (
    <div className="owner-req">
      <div className="owner-req-head">
        <b>받은 나눔 요청</b>
        {list && <span className="num-pill">{pending.length}</span>}
      </div>
      {list === null ? (
        <div style={{ padding: 24, display: "grid", placeItems: "center" }}><Spinner size={22} /></div>
      ) : err ? (
        <div className="owner-req-empty">요청을 불러오지 못했어요</div>
      ) : (list.length === 0) ? (
        <div className="owner-req-empty">아직 받은 요청이 없어요</div>
      ) : (
        <>
          {pending.map((r) => (
            <div className="req-card" key={r.requestFoodId}>
              <Avatar name={r.requesterNickName || "?"} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="req-name">{r.requesterNickName || "이웃"}</div>
                <div className="req-sub">나눔을 요청했어요</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn ghost sm" onClick={() => act(r.requestFoodId, "reject")}>거절</button>
                <button className="btn primary sm" onClick={() => act(r.requestFoodId, "approve")}>수락</button>
              </div>
            </div>
          ))}
          {decided.map((r) => (
            <div className="req-card muted" key={r.requestFoodId}>
              <Avatar name={r.requesterNickName || "?"} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="req-name">{r.requesterNickName || "이웃"}</div>
                <div className="req-sub">{r.status === "APPROVED" ? "수락됨" : "거절됨"}</div>
              </div>
              <span className={`badge ${r.status === "APPROVED" ? "progress" : "incomplete"}`}>
                {r.status === "APPROVED" ? "수락" : "거절"}
              </span>
            </div>
          ))}
        </>
      )}
      <style>{`
        .owner-req { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
        .owner-req-head { display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 10px; }
        .owner-req-head b { font-weight: 700; }
        .num-pill { display: inline-block; padding: 1px 7px; background: var(--danger); color: #fff; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .owner-req-empty { padding: 28px 0; text-align: center; color: var(--ink-4); font-size: 12.5px; }
        .req-card { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px dashed var(--line); }
        .req-card:first-of-type { border-top: 0; }
        .req-card.muted { opacity: 0.7; }
        .req-name { font-size: 13px; font-weight: 700; }
        .req-sub { font-size: 11.5px; color: var(--ink-4); margin-top: 1px; }
      `}</style>
    </div>
  );
}

/* ============ Request Modal ============ */
function RequestModal({ food, sent, error, onClose, onSubmit }) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="닫기"><Icon.X /></button>

        {!sent ? (
          <>
            <div className="eyebrow" style={{ color: "var(--primary)" }}>NEW REQUEST</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 4 }}>나눔 요청 보내기</h2>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6, marginBottom: 18, lineHeight: 1.6 }}>
              <b>{food.foodName}</b> 나눔을 요청해요. 등록자가 수락하면 채팅으로 픽업을 조율할 수 있어요.
            </p>

            <div className="modal-summary">
              <Photo label="나눔마켓" src={(food.images && food.images[0] && food.images[0].accessUrl) || undefined} ratio="1/1" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{food.foodName}</div>
                <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}>
                  소비기한 {food.expired} · 정원 {food.approvedCount}/{food.capacity}명
                </div>
              </div>
            </div>

            <div className="modal-rules">
              <Icon.Lock style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <b>안내</b>
                <ul>
                  <li>본인이 등록한 물품에는 요청할 수 없어요</li>
                  <li>같은 물품에 중복 요청은 불가합니다</li>
                  <li>진행중 상태인 물품에만 요청할 수 있어요</li>
                </ul>
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 14, padding: "10px 12px", background: "#FBEAE5", border: "1px solid var(--danger-100)", borderRadius: 8, color: "var(--danger)", fontSize: 12.5 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>취소</button>
              <button className="btn primary" style={{ flex: 2 }} onClick={onSubmit}>요청 보내기</button>
            </div>
          </>
        ) : (
          <div style={{ padding: "16px 0", textAlign: "center" }}>
            <div className="success-check"><Icon.Check /></div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginTop: 14 }}>요청을 보냈어요</h2>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6 }}>등록자가 수락하면 채팅으로 알려드릴게요.</p>
          </div>
        )}
      </div>

      <style>{`
        .modal-scrim { position: fixed; inset: 0; background: rgba(31,29,24,0.45); backdrop-filter: blur(2px); z-index: 200; display: grid; place-items: center; padding: 20px; }
        .modal { width: 100%; max-width: 460px; background: var(--surface); border-radius: 14px; padding: 28px; position: relative; box-shadow: var(--shadow-pop); }
        .modal-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; color: var(--ink-3); }
        .modal-close:hover { background: var(--bg-2); color: var(--ink); }
        .modal-summary { display: flex; gap: 12px; align-items: center; padding: 12px; background: var(--bg-2); border-radius: 10px; }
        .modal-summary .ph { width: 56px; height: 56px; aspect-ratio: 1/1; flex-shrink: 0; }
        .modal-rules { display: flex; gap: 10px; padding: 12px 14px; background: var(--primary-50); border: 1px solid var(--primary-100); border-radius: 10px; color: var(--primary-700); font-size: 12px; line-height: 1.5; margin-top: 14px; }
        .modal-rules svg { color: var(--primary); }
        .modal-rules b { font-weight: 700; display: block; margin-bottom: 4px; color: var(--ink); font-size: 12.5px; }
        .modal-rules ul { padding-left: 14px; color: var(--ink-3); font-size: 11.5px; }
        .modal-rules li { list-style: disc; margin-top: 2px; }
        .success-check { width: 64px; height: 64px; margin: 0 auto; background: var(--primary); color: #FBF9F2; border-radius: 50%; display: grid; place-items: center; }
        .success-check svg { width: 28px; height: 28px; }
      `}</style>
    </div>
  );
}

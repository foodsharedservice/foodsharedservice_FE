"use client";

/* DetailScreen.jsx — D-02 물품 상세
   API: GET /foods/{foodId}
   Request action: POST /foods/{foodId}/requests  (no body) */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { StatusBadge, Photo, Avatar, CapacityBar } from "@/components/ui";
import API from "@/lib/api";

const DETAIL_DATA = {
  foodId: 100,
  ownerNickName: "sunny_kim",
  foodName: "참치캔 6개입 (미개봉)",
  expired: "2026-06-25",
  capacity: 3,
  approvedCount: 1,
  details:
    "동생이 사놓고 안 먹어서 나눔합니다. 박스째로 가져가셔도 좋고, 한 캔만 필요해도 환영해요. 모두 미개봉이고 직사광선 안 닿는 곳에 보관했습니다.\n\n픽업 가능 시간은 평일 저녁 7-9시, 주말 오후입니다. 서초역 2번 출구 인근에서 만나면 좋아요.",
  statusTx: "IN_PROGRESS",
  createdAt: "2026-06-13T10:32:00",
  images: [
    { imageId: 10, accessUrl: "https://.../1.jpg", imageType: "BASIC", label: "참치캔 — 전체", emoji: "🐟" },
    { imageId: 11, accessUrl: "https://.../2.jpg", imageType: "BASIC", label: "참치캔 — 라벨", emoji: "📷" },
    { imageId: 13, accessUrl: "https://.../3.jpg", imageType: "BASIC", label: "참치캔 — 박스", emoji: "📦" },
    { imageId: 12, accessUrl: "https://.../exp.jpg", imageType: "EXPIRED", label: "소비기한 사진", emoji: "📅" },
  ],
};

export default function DetailScreen({ foodId }) {
  const router = useRouter();
  const [d, setD] = useState(DETAIL_DATA);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [requestModal, setRequestModal] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [toast, setToast] = useState(null);

  // GET /foods/{foodId} (백엔드 없으면 mock 유지)
  useEffect(() => {
    let alive = true;
    if (!foodId) return;
    API.foods.detail(foodId)
      .then((data) => {
        if (alive && data && data.images && data.images.length) {
          setD(data);
          setPhotoIdx(0);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [foodId]);

  const today = new Date("2026-06-13");
  const expDate = new Date(d.expired);
  const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

  const prev = () => setPhotoIdx((i) => (i - 1 + d.images.length) % d.images.length);
  const next = () => setPhotoIdx((i) => (i + 1) % d.images.length);

  useEffect(() => {
    const onKey = (e) => {
      if (requestModal) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestModal, d.images.length]);

  const cur = d.images[photoIdx] || d.images[0];
  const isExpImage = cur.imageType === "EXPIRED";

  const submitRequest = () => {
    // POST /foods/{foodId}/requests → { requestFoodId, status:"REQUEST" }
    API.requests.create(d.foodId).catch(() => {});
    setRequestSent(true);
    setTimeout(() => setRequestModal(false), 1400);
  };

  const openChat = () => {
    // POST /chat/rooms { foodId } → { roomId, foodId, created }
    API.chat.createRoom(d.foodId).catch(() => {});
    setToast(`@${d.ownerNickName} 님과의 채팅방을 열었어요`);
    setTimeout(() => setToast(null), 2200);
  };

  const relTime = "32분 전";

  return (
    <div className="detail">
      <div className="detail-crumb">
        <button className="crumb-back" onClick={() => router.push("/")}>
          <Icon.ChevronLeft /> 홈으로
        </button>
        <span className="crumb-sep">/</span>
        <span style={{ color: "var(--ink)" }}>{d.foodName}</span>
      </div>

      <div className="detail-grid">
        {/* ============ Left: image carousel ============ */}
        <div className="detail-left">
          <div className="carousel">
            <Photo label={cur.label} emoji={cur.emoji} className={isExpImage ? "exp-photo" : ""} />
            <div className="carousel-tl"><StatusBadge status={d.statusTx} solid /></div>
            {isExpImage && (
              <div className="carousel-tr exp-tag"><Icon.Calendar /> 소비기한 인증 사진</div>
            )}
            <div className="carousel-counter">
              <span className="font-en">{photoIdx + 1}</span><span>/</span><span className="font-en">{d.images.length}</span>
            </div>
            <button className="carousel-arrow left" onClick={prev} aria-label="이전"><Icon.ChevronLeft /></button>
            <button className="carousel-arrow right" onClick={next} aria-label="다음"><Icon.ChevronRight /></button>
          </div>

          <div className="carousel-thumbs">
            {d.images.map((img, i) => (
              <button key={img.imageId} className={`thumb ${i === photoIdx ? "on" : ""}`} onClick={() => setPhotoIdx(i)}>
                <Photo label="" emoji={img.emoji} ratio="1/1" />
                {img.imageType === "EXPIRED" && <div className="thumb-star">⭐</div>}
              </button>
            ))}
          </div>
        </div>

        {/* ============ Right: info ============ */}
        <div className="detail-right">
          <div className="detail-owner">
            <Avatar name={d.ownerNickName} size={42} />
            <div style={{ flex: 1 }}>
              <div className="owner-name">{d.ownerNickName}</div>
              <div className="owner-sub">등록자</div>
            </div>
          </div>

          <div className="eyebrow" style={{ marginTop: 18 }}>{relTime}</div>
          <h1 className="detail-title">{d.foodName}</h1>

          <div className="detail-info">
            <div className="info-row">
              <div className="info-label"><Icon.Calendar /> 소비기한</div>
              <div className="info-value">
                <span className="font-en exp-date">{d.expired}</span>
                <span className={`d-pill ${daysLeft <= 14 ? "warn" : ""}`}>D-{daysLeft}</span>
              </div>
            </div>
            <div className="info-row">
              <div className="info-label"><Icon.Users /> 정원</div>
              <div className="info-value"><CapacityBar approved={d.approvedCount} total={d.capacity} /></div>
            </div>
          </div>

          <div className="detail-desc">
            {d.details.split("\n").map((p, i) => <p key={i}>{p}</p>)}
          </div>

          <div className="detail-cta-row">
            <button className="btn ghost lg" onClick={openChat}><Icon.Chat /> 채팅하기</button>
            <button className="btn primary lg cta" onClick={() => setRequestModal(true)} disabled={d.approvedCount >= d.capacity}>
              {d.approvedCount >= d.capacity ? "정원이 다 찼어요" : "나눔 요청 보내기"}
            </button>
          </div>
          <div className="cta-hint">본인이 등록한 물품과 중복 요청은 보낼 수 없어요.</div>
        </div>
      </div>

      {requestModal && (
        <RequestModal
          food={d}
          sent={requestSent}
          onClose={() => { setRequestModal(false); setRequestSent(false); }}
          onSubmit={submitRequest}
        />
      )}

      {toast && (<div className="detail-toast"><Icon.Chat /> {toast}</div>)}

      <style>{`
        .detail { padding: 0 0 40px; }
        .detail-crumb { display: flex; align-items: center; gap: 8px; padding: 16px 32px; font-size: 12.5px; color: var(--ink-4); }
        .crumb-back { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-2); font-weight: 500; padding: 4px 8px; margin-left: -8px; border-radius: 6px; }
        .crumb-back:hover { background: var(--bg-2); }
        .crumb-sep { color: var(--ink-5); }
        .detail-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 48px; padding: 0 32px; max-width: 1280px; margin: 0 auto; }
        .carousel { position: relative; background: var(--surface-2); border-radius: var(--r-img); overflow: hidden; }
        .carousel .ph { aspect-ratio: 4/3; border-radius: var(--r-img); }
        .carousel .exp-photo { background: repeating-linear-gradient(135deg, var(--accent-100) 0 12px, var(--accent-50) 12px 24px); }
        .carousel-tl { position: absolute; top: 14px; left: 14px; }
        .carousel-tr.exp-tag { position: absolute; top: 14px; right: 14px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--accent); color: var(--ink); border-radius: 999px; font-size: 11px; font-weight: 700; }
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
        .thumb-star { position: absolute; top: 4px; right: 4px; font-size: 11px; background: var(--accent); width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; }
        .detail-right { display: flex; flex-direction: column; }
        .detail-owner { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
        .owner-name { font-weight: 700; font-size: 14.5px; }
        .owner-sub { font-size: 11.5px; color: var(--ink-4); margin-top: 2px; }
        .detail-title { font-size: 28px; font-weight: 800; line-height: 1.25; letter-spacing: -0.025em; margin-top: 4px; margin-bottom: 16px; }
        .detail-info { background: var(--bg-2); border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; }
        .info-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px dashed var(--line-2); }
        .info-row:last-child { border-bottom: 0; }
        .info-label { display: inline-flex; align-items: center; gap: 6px; width: 110px; font-size: 12.5px; font-weight: 600; color: var(--ink-3); }
        .info-value { flex: 1; font-size: 13.5px; display: flex; align-items: center; gap: 10px; }
        .exp-date { font-family: var(--font-en); font-size: 15px; font-weight: 700; color: var(--ink); letter-spacing: -0.01em; }
        .d-pill { font-family: var(--font-en); font-size: 11px; font-weight: 700; padding: 2px 8px; background: var(--primary-100); color: var(--primary-700); border-radius: 999px; letter-spacing: 0.02em; }
        .d-pill.warn { background: var(--accent-100); color: var(--accent-700); }
        .detail-desc { font-size: 14px; line-height: 1.7; color: var(--ink-2); margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--line); }
        .detail-desc p + p { margin-top: 12px; }
        .detail-cta-row { display: flex; gap: 8px; }
        .cta { flex: 1; }
        .cta-hint { text-align: center; font-size: 11.5px; color: var(--ink-4); margin-top: 10px; }
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

/* ============ Request Modal ============ */
function RequestModal({ food, sent, onClose, onSubmit }) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="닫기"><Icon.X /></button>

        {!sent ? (
          <>
            <div className="eyebrow" style={{ color: "var(--primary)" }}>NEW REQUEST</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 4 }}>나눔 요청 보내기</h2>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6, marginBottom: 18, lineHeight: 1.6 }}>
              <b>@{food.ownerNickName}</b> 님에게 <b>{food.foodName}</b> 나눔을 요청해요. 등록자가 수락하면 알림으로 알려드릴게요.
            </p>

            <div className="modal-summary">
              <Photo label="" emoji="🐟" ratio="1/1" />
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

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>취소</button>
              <button className="btn primary" style={{ flex: 2 }} onClick={onSubmit}>요청 보내기</button>
            </div>
          </>
        ) : (
          <div style={{ padding: "16px 0", textAlign: "center" }}>
            <div className="success-check"><Icon.Check /></div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginTop: 14 }}>요청을 보냈어요</h2>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6 }}>등록자가 수락하면 알림으로 알려드릴게요.</p>
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

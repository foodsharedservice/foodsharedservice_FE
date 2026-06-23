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
      <div className="pb-10">
        <div className="container py-4">
          <button
            className="inline-flex items-center gap-1 -ml-2 px-2 py-1 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => router.push("/")}
          >
            <Icon.ChevronLeft /> 홈으로
          </button>
        </div>
        <StateBox kind="loading" title="물품 정보를 불러오는 중…" />
      </div>
    );
  }
  if (error || !d) {
    const notFound = error && error.status === 404;
    return (
      <div className="pb-10">
        <div className="container py-4">
          <button
            className="inline-flex items-center gap-1 -ml-2 px-2 py-1 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => router.push("/")}
          >
            <Icon.ChevronLeft /> 홈으로
          </button>
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
    <div className="pb-12">
      {/* ============ Breadcrumb ============ */}
      <div className="container py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
          <button
            className="inline-flex items-center gap-1 -ml-2 px-2 py-1 rounded-md font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors flex-shrink-0"
            onClick={() => router.push("/")}
          >
            <Icon.ChevronLeft /> 홈으로
          </button>
          <span className="text-border flex-shrink-0">/</span>
          <span className="text-foreground truncate">{d.foodName}</span>
        </div>
      </div>

      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* ============ Left: image carousel ============ */}
          <div className="animate-fade-in-up">
            <div className="relative rounded-2xl overflow-hidden bg-muted shadow-warm">
              <Photo label="나눔마켓" src={curUrl} ratio="4/3" className="rounded-2xl" />

              <div className="absolute top-3.5 left-3.5">
                <StatusBadge status={d.statusTx} solid />
              </div>

              {isExpImage && (
                <div className="absolute top-3.5 right-3.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber text-white text-[11px] font-bold shadow-warm">
                  <Icon.Calendar /> 소비기한 인증 사진
                </div>
              )}

              {images.length > 0 && (
                <div className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-foreground/70 text-background text-xs font-semibold backdrop-blur-sm">
                  <span>{photoIdx + 1}</span><span>/</span><span>{images.length}</span>
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    className="absolute top-1/2 left-3 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-white/90 text-foreground shadow-warm hover:bg-white hover:scale-105 transition-all"
                    onClick={prev}
                    aria-label="이전"
                  >
                    <Icon.ChevronLeft />
                  </button>
                  <button
                    className="absolute top-1/2 right-3 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-white/90 text-foreground shadow-warm hover:bg-white hover:scale-105 transition-all"
                    onClick={next}
                    aria-label="다음"
                  >
                    <Icon.ChevronRight />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 mt-2.5">
                {images.map((img, i) => (
                  <button
                    key={img.imageId ?? i}
                    className={`relative flex-1 rounded-lg overflow-hidden border-2 transition-colors ${i === photoIdx ? "border-primary" : "border-transparent hover:border-border"}`}
                    onClick={() => setPhotoIdx(i)}
                  >
                    <Photo label="" src={img.accessUrl} ratio="1/1" />
                    {img.imageType === "EXPIRED" && (
                      <div className="absolute top-1 right-1 w-[18px] h-[18px] grid place-items-center rounded-full bg-amber text-[11px]">⭐</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ============ Right: info ============ */}
          <div className="flex flex-col animate-fade-in-up stagger-1">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <Avatar name={d.ownerNickName || (isOwner ? (user && user.nickName) || "나" : "?")} size={42} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-foreground">{isOwner ? "내가 등록한 물품" : (d.ownerNickName || "이웃")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">등록자</div>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-snug mt-4 mb-4">{d.foodName}</h1>

            <div className="bg-muted rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between gap-3 py-2.5 border-b border-dashed border-border">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground flex-shrink-0">
                  <Icon.Calendar /> 소비기한
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[15px] font-bold text-foreground">{d.expired}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${daysLeft <= 14 ? "bg-amber/15 text-amber-dark" : "bg-primary/10 text-primary"}`}>
                    {daysLeft < 0 ? `D+${Math.abs(daysLeft)}` : `D-${daysLeft}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground flex-shrink-0">
                  <Icon.Users /> 정원
                </div>
                <div className="flex items-center"><CapacityBar approved={d.approvedCount} total={d.capacity} /></div>
              </div>
            </div>

            <div className="text-sm leading-relaxed text-foreground/80 mb-6 pb-6 border-b border-border min-h-[40px]">
              {(d.details || "").split("\n").map((p, i) => (
                <p key={i} className="[&+p]:mt-3">{p}</p>
              ))}
            </div>

            {/* ============ 등록자: 받은 요청 관리 ============ */}
            {isOwner ? (
              <OwnerRequests foodId={d.foodId} onChange={load} />
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-full bg-card border border-border text-foreground/80 font-medium hover:border-amber hover:text-amber transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={openChat}
                    disabled={chatBusy}
                  >
                    <Icon.Chat /> {chatBusy ? "여는 중…" : "채팅하기"}
                  </button>
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-amber text-white font-semibold shadow-warm hover:bg-amber-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="block mx-auto mt-2.5 text-xs text-destructive underline underline-offset-2 hover:opacity-80 transition-opacity"
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
                <div className="text-center text-xs text-muted-foreground mt-2.5">본인이 등록한 물품과 중복 요청은 보낼 수 없어요.</div>
              </>
            )}
          </div>
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

      {toast && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[300] inline-flex items-center gap-2 px-4 py-3 rounded-full bg-foreground text-background text-sm font-semibold shadow-warm-lg animate-fade-in-up">
          <Icon.Chat /> {toast}
        </div>
      )}
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
    <div className="bg-card rounded-2xl border border-border shadow-warm p-4">
      <div className="flex items-center gap-2 text-sm font-bold mb-2.5">
        <b className="font-bold">받은 나눔 요청</b>
        {list && <span className="inline-block px-1.5 py-0.5 rounded-full bg-destructive text-white text-[11px] font-bold">{pending.length}</span>}
      </div>
      {list === null ? (
        <div className="grid place-items-center py-6"><Spinner size={22} /></div>
      ) : err ? (
        <div className="py-7 text-center text-muted-foreground text-xs">요청을 불러오지 못했어요</div>
      ) : (list.length === 0) ? (
        <div className="py-7 text-center text-muted-foreground text-xs">아직 받은 요청이 없어요</div>
      ) : (
        <>
          {pending.map((r) => (
            <div className="flex items-center gap-2.5 py-2.5 border-t border-dashed border-border first-of-type:border-t-0" key={r.requestFoodId}>
              <Avatar name={r.requesterNickName || "?"} size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">{r.requesterNickName || "이웃"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">나눔을 요청했어요</div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button className="inline-flex items-center justify-center h-8 px-3 rounded-full bg-card border border-border text-foreground/80 text-xs font-medium hover:border-amber hover:text-amber transition-colors" onClick={() => act(r.requestFoodId, "reject")}>거절</button>
                <button className="inline-flex items-center justify-center h-8 px-3 rounded-full bg-amber text-white text-xs font-semibold shadow-warm hover:bg-amber-dark transition-colors" onClick={() => act(r.requestFoodId, "approve")}>수락</button>
              </div>
            </div>
          ))}
          {decided.map((r) => (
            <div className="flex items-center gap-2.5 py-2.5 border-t border-dashed border-border first-of-type:border-t-0 opacity-70" key={r.requestFoodId}>
              <Avatar name={r.requesterNickName || "?"} size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">{r.requesterNickName || "이웃"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{r.status === "APPROVED" ? "수락됨" : "거절됨"}</div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${r.status === "APPROVED" ? "badge-in-progress" : "badge-incomplete"}`}>
                {r.status === "APPROVED" ? "수락" : "거절"}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ============ Request Modal ============ */
function RequestModal({ food, sent, error, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-[200] bg-foreground/45 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-2xl shadow-warm-lg p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <button
          className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          onClick={onClose}
          aria-label="닫기"
        >
          <Icon.X />
        </button>

        {!sent ? (
          <>
            <div className="text-xs font-bold tracking-widest uppercase text-primary">NEW REQUEST</div>
            <h2 className="text-xl font-bold tracking-tight text-foreground mt-1">나눔 요청 보내기</h2>
            <p className="text-sm text-muted-foreground mt-1.5 mb-4 leading-relaxed">
              <b className="font-semibold text-foreground">{food.foodName}</b> 나눔을 요청해요. 등록자가 수락하면 채팅으로 픽업을 조율할 수 있어요.
            </p>

            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden">
                <Photo label="나눔마켓" src={(food.images && food.images[0] && food.images[0].accessUrl) || undefined} ratio="1/1" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground truncate">{food.foodName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  소비기한 {food.expired} · 정원 {food.approvedCount}/{food.capacity}명
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 p-3.5 mt-3.5 rounded-xl bg-primary/5 border border-primary/15 text-primary text-xs leading-relaxed">
              <span className="flex-shrink-0 mt-0.5 text-primary"><Icon.Lock /></span>
              <div>
                <b className="block font-bold text-foreground mb-1">안내</b>
                <ul className="list-disc pl-3.5 text-muted-foreground space-y-0.5">
                  <li>본인이 등록한 물품에는 요청할 수 없어요</li>
                  <li>같은 물품에 중복 요청은 불가합니다</li>
                  <li>진행중 상태인 물품에만 요청할 수 있어요</li>
                </ul>
              </div>
            </div>

            {error && (
              <div className="mt-3.5 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs">
                {error}
              </div>
            )}

            <div className="flex gap-2.5 mt-4">
              <button
                className="flex-1 inline-flex items-center justify-center h-11 px-5 rounded-full bg-card border border-border text-foreground/80 font-medium hover:border-amber hover:text-amber transition-colors"
                onClick={onClose}
              >
                취소
              </button>
              <button
                className="flex-[2] inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-amber text-white font-semibold shadow-warm hover:bg-amber-dark transition-colors"
                onClick={onSubmit}
              >
                요청 보내기
              </button>
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            <div className="w-16 h-16 mx-auto grid place-items-center rounded-full bg-primary text-white">
              <Icon.Check style={{ width: 28, height: 28 }} />
            </div>
            <h2 className="text-xl font-bold text-foreground mt-3.5">요청을 보냈어요</h2>
            <p className="text-sm text-muted-foreground mt-1.5">등록자가 수락하면 채팅으로 알려드릴게요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

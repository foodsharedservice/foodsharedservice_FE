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
import {
  Calendar, Users, ChevronLeft, ChevronRight, X, Check,
  MessageSquare, ShieldCheck,
} from "lucide-react";
import { Photo, Avatar, StateBox, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

const STATUS_META = {
  IN_PROGRESS: { label: "나눔중", cls: "badge-in-progress" },
  COMPLETED: { label: "나눔완료", cls: "badge-completed" },
  INCOMPLETE: { label: "나눔취소", cls: "badge-incomplete" },
  EXPIRED: { label: "기간만료", cls: "badge-expired" },
};

function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function formatDateTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

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
      <div className="min-h-screen bg-background pt-20">
        <div className="container py-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <button className="inline-flex items-center gap-1 hover:text-amber transition-colors" onClick={() => router.push("/")}>
              <ChevronLeft className="w-4 h-4" /> 홈으로
            </button>
          </div>
          <StateBox kind="loading" title="물품 정보를 불러오는 중…" />
        </div>
      </div>
    );
  }
  if (error || !d) {
    const notFound = error && error.status === 404;
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="container py-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <button className="inline-flex items-center gap-1 hover:text-amber transition-colors" onClick={() => router.push("/")}>
              <ChevronLeft className="w-4 h-4" /> 홈으로
            </button>
          </div>
          <StateBox
            kind="error"
            title={notFound ? "존재하지 않는 물품이에요" : "물품 정보를 불러오지 못했어요"}
            sub={notFound ? "삭제되었거나 잘못된 주소일 수 있어요." : `서버에 연결할 수 없습니다. (${(error && (error.code || error.status || error.message)) || "네트워크 오류"})`}
            onRetry={notFound ? undefined : load}
          />
        </div>
      </div>
    );
  }

  const expDate = new Date(d.expired);
  const daysLeft = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
  const cur = images[photoIdx];
  const curUrl = cur && cur.accessUrl;
  const isExpImage = cur && cur.imageType === "EXPIRED";
  const full = d.approvedCount >= d.capacity;
  const status = STATUS_META[d.statusTx] || { label: d.statusTx, cls: "badge-in-progress" };
  const pct = d.capacity ? Math.min(100, (d.approvedCount / d.capacity) * 100) : 0;

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
    <div className="min-h-screen bg-background pt-20">
      <div className="container py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <button className="inline-flex items-center gap-1 hover:text-amber transition-colors" onClick={() => router.push("/")}>
            물품 목록
          </button>
          <span>/</span>
          <span className="text-foreground font-medium line-clamp-1">{d.foodName}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">
          {/* ============ Left: image gallery ============ */}
          <div>
            {/* Main Image */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted mb-3 shadow-warm">
              <Photo label="나눔마켓" src={curUrl} className="w-full h-full" />
              {isExpImage && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center gap-1 bg-amber/90 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    소비기한 인증
                  </span>
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    aria-label="이전"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={next}
                    aria-label="다음"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.imageId ?? i}
                    onClick={() => setPhotoIdx(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      i === photoIdx
                        ? "border-amber shadow-warm"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <Photo label="" src={img.accessUrl} ratio="1/1" className="w-full h-full" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ============ Right: info ============ */}
          <div>
            {/* Status */}
            <div className="flex items-start gap-3 mb-4">
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${status.cls}`}>
                {status.label}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight mb-4">
              {d.foodName}
            </h1>

            {/* Owner */}
            <div className="flex items-center gap-3 mb-6">
              <Avatar name={d.ownerNickName || (isOwner ? (user && user.nickName) || "나" : "?")} size={36} />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isOwner ? "내가 등록한 물품" : (d.ownerNickName || "이웃")}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(d.createdAt)} 등록</p>
              </div>
            </div>

            <div className="border-t border-border mb-6" />

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-cream rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-amber" />
                  <span className="text-xs text-muted-foreground font-medium">소비기한</span>
                </div>
                <p className="font-semibold text-foreground text-sm">{formatDate(d.expired)}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${
                  daysLeft <= 14 ? "bg-red-100 text-red-700" : "bg-amber/10 text-amber-dark"
                }`}>
                  {daysLeft < 0 ? `D+${Math.abs(daysLeft)}` : daysLeft === 0 ? "오늘 만료" : `D-${daysLeft}`}
                </span>
              </div>

              <div className="bg-cream rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-amber" />
                  <span className="text-xs text-muted-foreground font-medium">나눔 인원</span>
                </div>
                <p className="font-semibold text-foreground text-sm">
                  {d.approvedCount} / {d.capacity}명
                </p>
                <div className="w-full h-1.5 bg-muted rounded-full mt-2">
                  <div className="h-full bg-amber rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">물품 설명</h3>
              <div className="text-muted-foreground leading-relaxed text-sm bg-cream rounded-xl p-4">
                {(d.details || "").split("\n").map((p, i) => (
                  <p key={i} className={i > 0 ? "mt-3" : ""}>{p}</p>
                ))}
              </div>
            </div>

            {/* ============ Action area ============ */}
            {isOwner ? (
              <OwnerRequests foodId={d.foodId} onChange={load} />
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold bg-amber text-white hover:bg-amber-dark shadow-warm-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

                <button
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold border border-amber text-amber hover:bg-amber/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={openChat}
                  disabled={chatBusy}
                >
                  <MessageSquare className="w-4 h-4" /> {chatBusy ? "여는 중…" : "채팅하기"}
                </button>

                {myRequest && myRequest.status === "REQUEST" && (
                  <button
                    className="mx-auto text-xs text-red-500 underline underline-offset-2 hover:text-red-600"
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

                <p className="text-center text-xs text-muted-foreground">
                  본인이 등록한 물품과 중복 요청은 보낼 수 없어요.
                </p>
              </div>
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
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[300] inline-flex items-center gap-2 px-4 py-3 rounded-full bg-foreground text-background text-sm font-semibold shadow-lg">
          <MessageSquare className="w-4 h-4" /> {toast}
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
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-amber" />
        <b className="text-sm font-semibold text-foreground">받은 나눔 요청</b>
        {list && (
          <span className="inline-block px-2 py-0.5 rounded-full bg-amber text-white text-xs font-bold">
            {pending.length}
          </span>
        )}
      </div>

      {list === null ? (
        <div className="py-6 grid place-items-center"><Spinner size={22} /></div>
      ) : err ? (
        <div className="py-7 text-center text-muted-foreground text-sm">요청을 불러오지 못했어요</div>
      ) : list.length === 0 ? (
        <div className="py-7 text-center text-muted-foreground text-sm">아직 받은 요청이 없어요</div>
      ) : (
        <div className="space-y-2">
          {pending.map((r) => (
            <div className="flex items-center justify-between bg-cream rounded-xl p-3" key={r.requestFoodId}>
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={r.requesterNickName || "?"} size={34} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{r.requesterNickName || "이웃"}</p>
                  <p className="text-xs text-muted-foreground">나눔을 요청했어요</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
                  onClick={() => act(r.requestFoodId, "reject")}
                >
                  거절
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold bg-amber text-white hover:bg-amber-dark transition-colors"
                  onClick={() => act(r.requestFoodId, "approve")}
                >
                  수락
                </button>
              </div>
            </div>
          ))}
          {decided.map((r) => (
            <div className="flex items-center justify-between bg-cream/60 rounded-xl p-3 opacity-80" key={r.requestFoodId}>
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={r.requesterNickName || "?"} size={34} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{r.requesterNickName || "이웃"}</p>
                  <p className="text-xs text-muted-foreground">{r.status === "APPROVED" ? "수락됨" : "거절됨"}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                r.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {r.status === "APPROVED" ? "수락" : "거절"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ Request Modal ============ */
function RequestModal({ food, sent, error, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="relative bg-card rounded-2xl p-6 w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
        <button
          className="absolute top-4 right-4 w-8 h-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={onClose}
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>

        {!sent ? (
          <>
            <h2 className="text-xl font-extrabold text-foreground">나눔 요청 보내기</h2>
            <p className="text-sm text-muted-foreground mt-1.5 mb-4 leading-relaxed">
              <b className="text-foreground">{food.foodName}</b> 나눔을 요청해요. 등록자가 수락하면 채팅으로 픽업을 조율할 수 있어요.
            </p>

            <div className="flex gap-3 items-center bg-cream rounded-xl p-3">
              <div className="w-14 h-14 flex-shrink-0">
                <Photo label="나눔마켓" src={(food.images && food.images[0] && food.images[0].accessUrl) || undefined} ratio="1/1" className="w-full h-full rounded-lg overflow-hidden" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground line-clamp-1">{food.foodName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  소비기한 {formatDate(food.expired)} · 정원 {food.approvedCount}/{food.capacity}명
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-4 p-3.5 rounded-xl bg-amber/10 text-sm leading-relaxed">
              <ShieldCheck className="w-5 h-5 text-amber flex-shrink-0 mt-0.5" />
              <div>
                <b className="block text-foreground text-sm mb-1">안내</b>
                <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                  <li>본인이 등록한 물품에는 요청할 수 없어요</li>
                  <li>같은 물품에 중복 요청은 불가합니다</li>
                  <li>진행중 상태인 물품에만 요청할 수 있어요</li>
                </ul>
              </div>
            </div>

            {error && (
              <div className="mt-3.5 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                className="flex-1 inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold border border-border text-foreground hover:bg-muted transition-colors"
                onClick={onClose}
              >
                취소
              </button>
              <button
                className="flex-[2] inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold bg-amber text-white hover:bg-amber-dark transition-colors"
                onClick={onSubmit}
              >
                요청 보내기
              </button>
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500 text-white grid place-items-center">
              <Check className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-foreground mt-3.5">요청을 보냈어요</h2>
            <p className="text-sm text-muted-foreground mt-1.5">등록자가 수락하면 채팅으로 알려드릴게요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/* HomeScreen.jsx — 나눔마켓 홈 (Warm Market)
   히어로 + 서비스 소개 + 실시간 나눔 피드(무한 스크롤) + CTA + 푸터
   API: GET /foods (목록·무한스크롤), GET /foods/recent (히어로 미리보기)
   실제 API 데이터만 사용 (mock 폴백 없음). 실패 시 에러 UI 표시. */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { StateBox, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

/* zip 디자인에서 쓰는 아이콘 중 repo 아이콘셋에 없는 것은 로컬로 정의한다. */
function ShieldCheckIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function ZapIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 12 10h8a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 12 14z" />
    </svg>
  );
}
function SproutIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6c-.9.8-1.6 2-2.1 3.6-.7-.5-1.2-1.4-1.4-2.6.7-1.3 1.7-2.2 3.5-1z" />
    </svg>
  );
}

const HERO_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663787031264/X9QCmjHK3KpAWyKFiSUYQq/hero-food-sharing-ntYUJHbVS9Xr28czMMtfkh.webp";

const FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "IN_PROGRESS", label: "나눔중" },
  { id: "COMPLETED", label: "나눔완료" },
  { id: "EXPIRED", label: "기간만료" },
];

const STATUS_LABELS = {
  IN_PROGRESS: "나눔중",
  COMPLETED: "나눔완료",
  INCOMPLETE: "나눔취소",
  EXPIRED: "기간만료",
};

const PAGE_SIZE = 50; // 백엔드 최대 페이지 크기

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}
function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}
function expiryBadgeClass(dateStr) {
  const days = daysUntil(dateStr);
  if (days <= 7) return "bg-red-100 text-red-700";
  if (days <= 30) return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}
function statusBadgeClass(status) {
  return ({
    IN_PROGRESS: "badge-in-progress",
    COMPLETED: "badge-completed",
    INCOMPLETE: "badge-incomplete",
    EXPIRED: "badge-expired",
  })[status] || "badge-in-progress";
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const sentinelRef = useRef(null);

  // 정렬은 서버 sort 파라미터로 처리 (허용 필드: foodId, expired, capacity)
  const sortParam = sort === "expiring" ? "expired,asc" : "foodId,desc";

  const fetchPage = useCallback((pageNum, sortP) => {
    return API.foods.list({ page: pageNum, size: PAGE_SIZE, sort: sortP }).then((data) => {
      const content = data && Array.isArray(data.content) ? data.content : [];
      const total = (data && data.totalElements) || 0;
      const hasNext =
        data && typeof data.hasNext === "boolean"
          ? data.hasNext
          : (pageNum + 1) * PAGE_SIZE < total;
      return { content, hasNext };
    });
  }, []);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchPage(0, sortParam)
      .then(({ content, hasNext }) => {
        if (!alive) return;
        setRows(content);
        setPage(0);
        setHasNext(hasNext);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fetchPage, sortParam]);

  useEffect(() => load(), [load]);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    fetchPage(page + 1, sortParam)
      .then(({ content, hasNext }) => {
        setRows((prev) => [...prev, ...content]);
        setPage((p) => p + 1);
        setHasNext(hasNext);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  // 하단 sentinel이 보이면 자동으로 다음 페이지 로드 (무한 스크롤)
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNext) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNext, loadingMore, page, sortParam]);

  const inProgressCount = rows.filter((i) => i.statusTx === "IN_PROGRESS").length;
  const items = rows.filter((it) => filter === "ALL" || it.statusTx === filter);

  return (
    <div className="min-h-screen">
      {/* ============ Hero ============ */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-olive">
          <img src={HERO_IMG} alt="음식 나눔" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 container pt-24 pb-16">
          <div className="max-w-xl">
            <span className="animate-fade-in-up inline-block mb-6 rounded-full bg-amber/20 text-amber-light border border-amber/30 backdrop-blur-sm px-3 py-1 text-sm font-medium">
              🌱 음식 낭비를 줄이는 따뜻한 방법
            </span>
            <h1 className="animate-fade-in-up stagger-1 text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
              남은 음식의<br />
              <span className="text-amber-light">새 주인</span>을<br />
              찾아드립니다
            </h1>
            <p className="animate-fade-in-up stagger-2 text-lg text-white/80 mb-8 leading-relaxed">
              미개봉 가공식품을 이웃과 나눠요.<br />
              소비기한 AI 인식으로 안전하게, 채팅으로 편리하게.
            </p>
            <div className="animate-fade-in-up stagger-3 flex flex-wrap gap-3">
              <button
                onClick={() => document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-amber text-white font-semibold shadow-warm-lg hover:bg-amber-dark transition-colors"
              >
                나눔 물품 보기 <Icon.ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push(user ? "/register" : "/signup")}
                className="h-12 px-6 rounded-full bg-white/10 border border-white/30 text-white backdrop-blur-sm hover:bg-white/20 transition-colors font-semibold"
              >
                {user ? "물품 등록하기" : "무료로 시작하기"}
              </button>
            </div>
            <div className="animate-fade-in-up stagger-4 flex gap-8 mt-12">
              <Stat value={`${inProgressCount}+`} label="지금 나눔중" />
              <Stat value={`${rows.length}+`} label="등록된 물품" />
              <Stat value="AI" label="소비기한 인식" />
            </div>
          </div>
        </div>

        <button
          onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce"
          aria-label="아래로"
        >
          <span className="block w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center pt-2">
            <span className="w-1 h-2 bg-white/60 rounded-full" />
          </span>
        </button>
      </section>

      {/* ============ Features ============ */}
      <section id="features" className="py-20 bg-background">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-4">왜 나눔마켓인가요?</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              안전하고 신뢰할 수 있는 음식 나눔을 위한 세 가지 약속
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <ShieldCheckIcon className="w-7 h-7" />, title: "AI 소비기한 인식", desc: "소비기한 사진을 찍으면 AI가 날짜를 자동으로 인식합니다. 안전한 식품만 나눔할 수 있어요.", color: "bg-green-50 text-green-600", delay: "stagger-1" },
              { icon: <Icon.Heart className="w-7 h-7" />, title: "이웃과 함께", desc: "가공식품·미개봉 식품만 등록 가능해 위생 걱정 없이 나눔에 참여할 수 있습니다.", color: "bg-amber/10 text-amber-dark", delay: "stagger-2" },
              { icon: <ZapIcon className="w-7 h-7" />, title: "실시간 채팅", desc: "나눔 신청 후 등록자와 1:1 채팅으로 수령 장소와 시간을 편리하게 조율하세요.", color: "bg-blue-50 text-blue-600", delay: "stagger-3" },
            ].map((f) => (
              <div key={f.title} className={`animate-fade-in-up ${f.delay} bg-card rounded-2xl p-8 border border-border shadow-warm`}>
                <div className={`w-14 h-14 rounded-2xl ${f.color} flex items-center justify-center mb-5`}>{f.icon}</div>
                <h3 className="text-xl font-bold text-foreground mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 나눔 피드 ============ */}
      <section id="feed" className="py-16 bg-cream border-t border-border scroll-mt-16">
        <div className="container">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">나눔 물품 목록</h2>
              <p className="text-muted-foreground">이웃이 나눔하는 미개봉 가공식품을 찾아보세요</p>
            </div>
            <button
              onClick={() => setSort(sort === "recent" ? "expiring" : "recent")}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-card border border-border text-sm font-medium text-foreground/80 hover:border-amber hover:text-amber transition-colors"
            >
              {sort === "recent" ? "최신순" : "마감 임박순"} <Icon.ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* 필터 칩 */}
          <div className="flex gap-2 flex-wrap mb-8">
            {FILTERS.map((f) => {
              const count = f.id === "ALL" ? rows.length : rows.filter((it) => it.statusTx === f.id).length;
              const on = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${on ? "bg-amber text-white shadow-warm" : "bg-card text-muted-foreground border border-border hover:border-amber hover:text-amber"}`}
                >
                  {f.label} <span className="opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <StateBox kind="loading" title="물품을 불러오는 중…" />
          ) : error ? (
            <StateBox
              kind="error"
              title="물품을 불러오지 못했어요"
              sub={`서버에 연결할 수 없습니다. (${error.code || error.status || error.message || "네트워크 오류"})`}
              onRetry={load}
            />
          ) : items.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🍱</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">물품이 없어요</h3>
              <p className="text-muted-foreground mb-6">아직 등록된 나눔 물품이 없어요.</p>
              {user && (
                <button onClick={() => router.push("/register")} className="h-11 px-6 rounded-full bg-amber text-white font-semibold hover:bg-amber-dark transition-colors">
                  첫 번째 물품 등록하기
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {items.map((food, i) => (
                  <div key={food.foodId} className={`animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}>
                    <FoodCard food={food} onClick={() => router.push(`/foods/${food.foodId}`)} />
                  </div>
                ))}
              </div>
              {hasNext && (
                <div ref={sentinelRef} className="flex justify-center pt-10">
                  {loadingMore && <Spinner size={24} />}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="py-20 bg-amber relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white -translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="container relative z-10 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">지금 바로 나눔을 시작해보세요</h2>
          <p className="text-white/85 text-lg mb-8 max-w-md mx-auto">남은 식품을 이웃과 나누고, 음식 낭비를 함께 줄여나가요.</p>
          <button
            onClick={() => router.push(user ? "/register" : "/signup")}
            className="h-12 px-8 rounded-full bg-white text-primary hover:bg-white/90 font-bold shadow-warm-lg transition-colors"
          >
            {user ? "물품 등록하기" : "무료 회원가입"}
          </button>
        </div>
      </section>

      {/* ============ Footer ============ */}
      <footer className="bg-foreground text-white/60 py-10">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-amber text-white grid place-items-center"><SproutIcon className="w-4 h-4" /></span>
              <span className="text-white font-semibold">나눔마켓</span>
            </div>
            <p className="text-sm text-center">© 2026 나눔마켓. 음식 낭비를 줄이는 따뜻한 커뮤니티.</p>
            <div className="flex gap-4 text-sm">
              <span className="hover:text-white transition-colors cursor-pointer">이용약관</span>
              <span className="hover:text-white transition-colors cursor-pointer">개인정보처리방침</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-white/60">{label}</div>
    </div>
  );
}

/* ============ Food Card (Warm Market) ============ */
function FoodCard({ food, onClick }) {
  const daysLeft = daysUntil(food.expired);
  const isFull = food.approvedCount >= food.capacity;
  const overlay = food.statusTx === "COMPLETED" || food.statusTx === "INCOMPLETE";

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-card rounded-2xl overflow-hidden card-lift border border-border shadow-warm"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {food.thumbnailUrl ? (
          <img
            src={food.thumbnailUrl}
            alt={food.foodName}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-4xl bg-muted">🍱</div>
        )}
        <div className="absolute top-3 left-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadgeClass(food.statusTx)}`}>
            {STATUS_LABELS[food.statusTx]}
          </span>
        </div>
        {overlay && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="text-white font-bold text-lg drop-shadow">
              {food.statusTx === "COMPLETED" ? "나눔완료" : "나눔취소"}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-foreground text-base leading-snug line-clamp-2 mb-3 min-h-[2.6em]">
          {food.foodName}
        </h3>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Icon.Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">{formatDate(food.expired)}</span>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ml-auto ${expiryBadgeClass(food.expired)}`}>
              {daysLeft <= 0 ? "만료됨" : `D-${daysLeft}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon.Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">{food.approvedCount} / {food.capacity}명</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden ml-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isFull ? "bg-muted-foreground" : "bg-amber"}`}
                style={{ width: `${Math.min((food.approvedCount / food.capacity) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

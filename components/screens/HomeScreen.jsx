"use client";

/* HomeScreen.jsx — D-01 홈 피드
   API: GET /foods?status={status}&page={page}&size={size}
   실제 API 데이터만 사용 (mock 폴백 없음). 실패 시 에러 UI 표시. */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { StatusBadge, Photo, StateBox, Spinner } from "@/components/ui";
import API from "@/lib/api";

const FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "IN_PROGRESS", label: "진행중" },
  { id: "COMPLETED", label: "완료" },
  { id: "EXPIRED", label: "만료" },
];

const PAGE_SIZE = 50; // 백엔드 최대 페이지 크기

export default function HomeScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [heroFoods, setHeroFoods] = useState(null); // 히어로 대표사진(최근 등록 2개) — null=로딩전/실패
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

  // 히어로 placeholder 카드 → 최근 등록 음식 2개의 대표사진으로 교체.
  // 로딩 전·실패 시에는 heroFoods를 채우지 않아 기존 placeholder가 유지된다.
  useEffect(() => {
    let alive = true;
    API.foods.recent({ size: 2 })
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.content) ? data.content : []);
        if (list.length > 0) setHeroFoods(list.slice(0, 2));
      })
      .catch(() => {}); // 실패 시 placeholder 유지
    return () => { alive = false; };
  }, []);

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
    <div className="home">
      {/* ============ Hero ============ */}
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-text">
            <div className="eyebrow" style={{ color: "var(--primary)" }}>FOOD SHARING SERVICE</div>
            <h1 className="home-hero-title">
              미개봉 식품, <br />
              버리지 말고 <em>이웃과 나눠요</em>
            </h1>
            <p className="home-hero-sub">
              지금 <b>{inProgressCount}개</b>의 미개봉 가공식품이 나눔을 기다리고 있어요.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button className="btn primary lg" onClick={() => router.push("/register")}>
                <Icon.Plus /> 나눔 등록하기
              </button>
              <button className="btn ghost lg">사용 안내</button>
            </div>
          </div>
          <div className="home-hero-art" aria-hidden="true">
            <HeroCard className="art-1" food={heroFoods?.[0]} fallback={{ status: "IN_PROGRESS", label: "D-12" }} />
            <HeroCard className="art-2" food={heroFoods?.[1]} fallback={{ status: "COMPLETED", label: "2/2" }} />
            <div className="art-tag">미개봉 · 가공식품만</div>
          </div>
        </div>
      </section>

      {/* ============ Feed toolbar ============ */}
      <div className="feed-toolbar">
        <div className="tab-row">
          {FILTERS.map((f) => (
            <button key={f.id} className={`tab ${filter === f.id ? "on" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}
              <span className="num">{f.id === "ALL" ? rows.length : rows.filter((it) => it.statusTx === f.id).length}</span>
            </button>
          ))}
        </div>
        <div className="sort-wrap">
          <button className="sort-btn" onClick={() => setSort(sort === "recent" ? "expiring" : "recent")}>
            {sort === "recent" ? "최신순" : "마감 임박순"} <Icon.ChevronDown />
          </button>
        </div>
      </div>

      {/* ============ Feed grid ============ */}
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
        <StateBox kind="empty" title="아직 등록된 물품이 없어요" sub="첫 번째 나눔을 등록해보세요." />
      ) : (
        <>
          <div className="feed-grid">
            {items.map((it) => (
              <FoodCard key={it.foodId} item={it} onClick={() => router.push(`/foods/${it.foodId}`)} />
            ))}
          </div>
          {hasNext && (
            <div className="feed-foot" ref={sentinelRef}>
              {loadingMore && <Spinner size={24} />}
            </div>
          )}
        </>
      )}

      <style>{`
        .home { padding: 0; }
        .home-hero {
          padding: 36px 32px 28px;
          background:
            radial-gradient(800px 240px at 80% -10%, var(--accent-50) 0%, transparent 50%),
            linear-gradient(180deg, var(--primary-50) 0%, transparent 70%);
          border-bottom: 1px solid var(--line);
        }
        .home-hero-inner { max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: 1.1fr 1fr; gap: 40px; align-items: center; }
        .home-hero-title { font-size: 40px; font-weight: 800; line-height: 1.18; letter-spacing: -0.025em; margin-top: 12px; color: var(--ink); }
        .home-hero-title em { font-style: normal; color: var(--primary); position: relative; display: inline-block; }
        .home-hero-title em::after { content: ""; position: absolute; left: -2px; right: -2px; bottom: 2px; height: 10px; background: var(--accent); opacity: 0.42; z-index: -1; border-radius: 4px; }
        .home-hero-sub { font-size: 15px; color: var(--ink-3); margin-top: 14px; line-height: 1.6; }
        .home-hero-sub b { color: var(--primary); font-weight: 700; }
        .home-hero-art { position: relative; height: 260px; }
        .art-card { position: absolute; width: 200px; background: var(--surface); border-radius: 12px; border: 1px solid var(--line); box-shadow: var(--shadow-pop); padding: 8px; transform-origin: center; }
        .art-card .ph { aspect-ratio: 4/3; }
        .art-card-meta { display: flex; align-items: center; justify-content: space-between; padding: 8px 4px 2px; }
        .art-1 { top: 0; left: 30px; transform: rotate(-4deg); }
        .art-2 { bottom: 0; right: 20px; transform: rotate(3deg); }
        .art-tag { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-2deg); background: var(--ink); color: var(--bg); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 12px; border-radius: 4px; white-space: nowrap; z-index: 2; }
        .feed-toolbar { display: flex; align-items: flex-end; gap: 24px; padding: 28px 32px 0; border-bottom: 1px solid var(--line); }
        .sort-wrap { margin-left: auto; padding-bottom: 10px; }
        .sort-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 8px; color: var(--ink-2); font-size: 12.5px; font-weight: 500; }
        .sort-btn:hover { background: var(--bg-2); }
        .feed-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px 18px; padding: 24px 32px 32px; }
        .feed-foot { display: flex; justify-content: center; padding: 0 0 48px; }
        @media (max-width: 900px) {
          .home-hero { padding: 20px 16px 18px; }
          .home-hero-inner { grid-template-columns: 1fr; gap: 16px; }
          .home-hero-title { font-size: 26px; }
          .home-hero-art { height: 150px; order: -1; }
          .feed-toolbar { padding: 16px 16px 0; gap: 12px; }
          .feed-grid { grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; }
        }
      `}</style>
    </div>
  );
}

/* ============ Hero Card ============
   히어로 대표사진 카드. food가 있으면 최근 등록 음식의 대표사진/상태/라벨을,
   없으면(로딩 전·실패) fallback placeholder를 렌더링한다.
   라벨: 완료(COMPLETED)면 n/N(승인/정원), 그 외에는 D-day. */
function heroDLabel(food) {
  if (food.statusTx === "COMPLETED") return `${food.approvedCount}/${food.capacity}`;
  const d = Math.ceil((new Date(food.expired) - new Date()) / (1000 * 60 * 60 * 24));
  return d < 0 ? `D+${Math.abs(d)}` : d === 0 ? "D-DAY" : `D-${d}`;
}

function HeroCard({ className, food, fallback }) {
  const status = food ? food.statusTx : fallback.status;
  const label = food ? heroDLabel(food) : fallback.label;
  return (
    <div className={`art-card ${className}`}>
      <Photo label="냠냠" src={food?.thumbnailUrl} />
      <div className="art-card-meta">
        <StatusBadge status={status} />
        <span className="eyebrow" style={{ fontSize: 9.5 }}>{label}</span>
      </div>
    </div>
  );
}

/* ============ Food Card ============ */
function FoodCard({ item, onClick }) {
  const expDate = new Date(item.expired);
  const d = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
  const isExpired = item.statusTx === "EXPIRED";
  const dLabel = d < 0 ? `D+${Math.abs(d)}` : d === 0 ? "D-DAY" : `D-${d}`;
  const showDTag = item.statusTx === "IN_PROGRESS" || item.statusTx === "EXPIRED";

  return (
    <button className="food-card card interactive" onClick={onClick}>
      <div className="food-card-img">
        <Photo label="냠냠" src={item.thumbnailUrl} />
        <div className="food-card-overlay">
          <StatusBadge status={item.statusTx} solid={item.statusTx === "IN_PROGRESS"} />
        </div>
        {showDTag && <div className={`d-tag ${isExpired ? "expired" : ""}`}>{dLabel}</div>}
      </div>
      <div className="food-card-body">
        <div className="food-card-title">{item.foodName}</div>
        <div className="food-card-meta">
          <span className="food-card-exp">
            <span className="eyebrow" style={{ fontSize: 9.5, marginRight: 4 }}>소비기한</span>
            <span className="font-en">{item.expired}</span>
          </span>
          <span className="food-card-cap">
            <span className="cap-num">{item.approvedCount}/{item.capacity}</span>
            <span style={{ color: "var(--ink-4)" }}>명</span>
          </span>
        </div>
      </div>

      <style>{`
        .food-card { padding: 0; overflow: hidden; text-align: left; cursor: pointer; display: flex; flex-direction: column; }
        .food-card-img { position: relative; padding: 10px 10px 0; }
        .food-card-img .ph { aspect-ratio: 4/3; }
        .food-card-overlay { position: absolute; top: 18px; left: 18px; }
        .d-tag { position: absolute; top: 18px; right: 18px; background: rgba(31,29,24,0.78); color: var(--bg); font-family: var(--font-en); font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; padding: 3px 7px; border-radius: 4px; backdrop-filter: blur(6px); }
        .d-tag.expired { background: var(--danger); }
        .food-card-body { padding: 14px 14px 14px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .food-card-title { font-size: 14.5px; font-weight: 700; color: var(--ink); line-height: 1.4; letter-spacing: -0.01em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .food-card-meta { display: flex; align-items: baseline; justify-content: space-between; margin-top: auto; padding-top: 8px; font-size: 11.5px; color: var(--ink-3); gap: 8px; border-top: 1px dashed var(--line); }
        .food-card-exp { display: inline-flex; align-items: baseline; min-width: 0; overflow: hidden; }
        .food-card-exp .font-en { font-family: var(--font-en); color: var(--ink-2); font-weight: 600; font-size: 11.5px; white-space: nowrap; }
        .food-card-cap { display: inline-flex; align-items: baseline; gap: 2px; white-space: nowrap; }
        .cap-num { font-family: var(--font-en); font-weight: 700; color: var(--primary); }
      `}</style>
    </button>
  );
}

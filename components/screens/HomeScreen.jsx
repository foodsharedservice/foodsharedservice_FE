"use client";

/* HomeScreen.jsx — 홈 피드 (번개장터 스타일 그리드)
   API: GET /foods?page=&size=&sort=  → PageResponse<FoodListResponse>
   - sort: foodId,desc(최신) | expired,asc(마감임박)
   - 상태 필터/검색은 불러온 목록에서 클라이언트 필터링
   실제 API 데이터만 사용. */

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/icons";
import { StatusBadge, Photo, StateBox } from "@/components/ui";
import API from "@/lib/api";

const FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "IN_PROGRESS", label: "나눔중" },
  { id: "COMPLETED", label: "나눔완료" },
  { id: "DONE", label: "마감" },
];

const PAGE_SIZE = 24;

export default function HomeScreen() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = (sp.get("q") || "").trim().toLowerCase();

  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("foodId,desc");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(async (p, sortKey, append) => {
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await API.foods.list({ page: p, size: PAGE_SIZE, sort: sortKey });
      const content = data && Array.isArray(data.content) ? data.content : [];
      setRows((prev) => (append ? [...prev, ...content] : content));
      setHasNext(!!(data && data.hasNext));
      setPage(p);
    } catch (e) {
      if (!append) setError(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(0, sort, false);
  }, [sort, fetchPage]);

  const matchStatus = (it) => {
    if (filter === "ALL") return true;
    if (filter === "DONE") return it.statusTx === "EXPIRED" || it.statusTx === "INCOMPLETE";
    return it.statusTx === filter;
  };
  const matchQuery = (it) => !q || (it.foodName || "").toLowerCase().includes(q);

  const items = rows.filter((it) => matchStatus(it) && matchQuery(it));
  const counts = {
    ALL: rows.length,
    IN_PROGRESS: rows.filter((i) => i.statusTx === "IN_PROGRESS").length,
    COMPLETED: rows.filter((i) => i.statusTx === "COMPLETED").length,
    DONE: rows.filter((i) => i.statusTx === "EXPIRED" || i.statusTx === "INCOMPLETE").length,
  };

  return (
    <div className="home">
      {/* ===== promo banner ===== */}
      <section className="home-banner">
        <div className="home-banner-inner">
          <div>
            <div className="home-banner-kicker">⚡ 우리 동네 나눔 마켓</div>
            <h1 className="home-banner-title">
              안 쓰는 물건, 남는 식품<br />이웃과 <em>무료로 나눠요</em>
            </h1>
            <p className="home-banner-sub">
              사진 한 장이면 끝. 소비기한은 AI가 직접 읽어 확인해드려요.
            </p>
            <button className="btn accent lg" onClick={() => router.push("/register")}>
              <Icon.Plus /> 지금 나눔하기
            </button>
          </div>
          <div className="home-banner-art" aria-hidden="true">⚡</div>
        </div>
      </section>

      {/* ===== toolbar ===== */}
      <div className="feed-toolbar">
        <div className="tab-row">
          {FILTERS.map((f) => (
            <button key={f.id} className={`tab ${filter === f.id ? "on" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}
              <span className="num">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="sort-wrap">
          <button
            className="chip"
            onClick={() => setSort((s) => (s === "foodId,desc" ? "expired,asc" : "foodId,desc"))}
          >
            {sort === "foodId,desc" ? "최신순" : "마감임박순"} <Icon.ChevronDown />
          </button>
        </div>
      </div>

      {q && (
        <div className="search-note">
          <b>“{sp.get("q")}”</b> 검색 결과 {items.length}건
          <button className="link" onClick={() => router.push("/")} style={{ marginLeft: 8 }}>전체보기</button>
        </div>
      )}

      {/* ===== grid ===== */}
      {loading ? (
        <StateBox kind="loading" title="물품을 불러오는 중…" />
      ) : error ? (
        <StateBox
          kind="error"
          title="물품을 불러오지 못했어요"
          sub={`서버에 연결할 수 없습니다. (${error.code || error.status || error.message || "네트워크 오류"})`}
          onRetry={() => fetchPage(0, sort, false)}
        />
      ) : items.length === 0 ? (
        <StateBox
          kind="empty"
          title={q ? "검색 결과가 없어요" : "아직 등록된 물품이 없어요"}
          sub={q ? "다른 검색어로 시도해보세요." : "첫 번째 나눔을 등록해보세요."}
        />
      ) : (
        <>
          <div className="feed-grid">
            {items.map((it) => (
              <FoodCard key={it.foodId} item={it} onClick={() => router.push(`/foods/${it.foodId}`)} />
            ))}
          </div>
          {hasNext && !q && (
            <div className="feed-foot">
              <button className="btn ghost lg" disabled={loadingMore} onClick={() => fetchPage(page + 1, sort, true)}>
                {loadingMore ? "불러오는 중…" : "더 보기"}
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        .home { max-width: var(--maxw); margin: 0 auto; padding: 0 24px 60px; }
        .home-banner { margin: 22px 0 8px; border-radius: 16px; overflow: hidden; background: linear-gradient(120deg, #FF3621, #FF7a4d); color: #fff; }
        .home-banner-inner { display: flex; align-items: center; justify-content: space-between; padding: 32px 36px; gap: 20px; }
        .home-banner-kicker { font-size: 13px; font-weight: 700; opacity: 0.95; }
        .home-banner-title { font-size: 30px; font-weight: 800; line-height: 1.25; letter-spacing: -0.03em; margin: 10px 0 12px; }
        .home-banner-title em { font-style: normal; text-decoration: underline; text-decoration-thickness: 4px; text-underline-offset: 4px; }
        .home-banner-sub { font-size: 14px; opacity: 0.92; margin-bottom: 20px; }
        .home-banner .btn.accent { background: #fff; color: var(--primary); }
        .home-banner .btn.accent:hover { background: #fff; opacity: 0.92; }
        .home-banner-art { font-size: 130px; line-height: 1; opacity: 0.85; filter: drop-shadow(0 8px 20px rgba(0,0,0,0.2)); }
        .feed-toolbar { display: flex; align-items: center; gap: 16px; margin-top: 18px; border-bottom: 1px solid var(--line); }
        .sort-wrap { margin-left: auto; padding-bottom: 8px; }
        .search-note { padding: 16px 2px 0; font-size: 13.5px; color: var(--ink-2); }
        .feed-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 22px 16px; padding: 22px 0 12px; }
        .feed-foot { display: flex; justify-content: center; padding: 16px 0; }
        @media (max-width: 1100px) { .feed-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 900px) {
          .home { padding: 0 14px 50px; }
          .home-banner-inner { padding: 22px; }
          .home-banner-title { font-size: 22px; }
          .home-banner-art { display: none; }
          .feed-grid { grid-template-columns: repeat(2, 1fr); gap: 18px 12px; }
        }
        @media (max-width: 480px) { .feed-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}

/* ============ Food Card ============ */
function FoodCard({ item, onClick }) {
  const expDate = item.expired ? new Date(item.expired) : null;
  const days = expDate ? Math.ceil((expDate - new Date()) / 86400000) : null;
  const dLabel = days == null ? "" : days < 0 ? `만료 ${Math.abs(days)}일` : days === 0 ? "D-DAY" : `D-${days}`;
  const isDone = item.statusTx === "COMPLETED" || item.statusTx === "EXPIRED" || item.statusTx === "INCOMPLETE";

  return (
    <button className="fcard" onClick={onClick}>
      <div className="fcard-img">
        <Photo label="나눔장터" src={item.thumbnailUrl} ratio="1/1" />
        {isDone && <div className="fcard-veil"><StatusBadge status={item.statusTx} solid /></div>}
        {!isDone && days != null && (
          <div className={`fcard-dday ${days <= 7 ? "soon" : ""}`}>{dLabel}</div>
        )}
      </div>
      <div className="fcard-body">
        <div className="fcard-title">{item.foodName}</div>
        <div className="fcard-price">무료나눔</div>
        <div className="fcard-meta">
          <span className="fcard-cap"><b>{item.approvedCount}</b>/{item.capacity}명</span>
          {item.expired && <span className="fcard-exp">~{item.expired}</span>}
        </div>
      </div>

      <style>{`
        .fcard { text-align: left; background: none; display: flex; flex-direction: column; gap: 8px; }
        .fcard-img { position: relative; border-radius: var(--r-img); overflow: hidden; }
        .fcard-img .ph { border-radius: var(--r-img); transition: transform .2s; }
        .fcard:hover .fcard-img .ph { transform: scale(1.03); }
        .fcard-veil { position: absolute; inset: 0; background: rgba(255,255,255,0.66); display: grid; place-items: center; }
        .fcard-dday { position: absolute; left: 8px; bottom: 8px; padding: 3px 8px; border-radius: 6px; background: rgba(0,0,0,0.7); color: #fff; font-family: var(--font-en); font-size: 11px; font-weight: 700; backdrop-filter: blur(4px); }
        .fcard-dday.soon { background: var(--primary); }
        .fcard-body { display: flex; flex-direction: column; gap: 3px; }
        .fcard-title { font-size: 14px; font-weight: 500; color: var(--ink-2); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.8em; }
        .fcard-price { font-size: 16px; font-weight: 800; color: var(--ink); letter-spacing: -0.02em; }
        .fcard-meta { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--ink-4); }
        .fcard-cap b { color: var(--primary); font-family: var(--font-en); }
        .fcard-exp { margin-left: auto; font-family: var(--font-en); }
      `}</style>
    </button>
  );
}

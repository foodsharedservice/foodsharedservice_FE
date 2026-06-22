"use client";

/* HomeScreen.jsx — D-01 홈 피드
   API: GET /foods?status={status}&page={page}&size={size} */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { StatusBadge, Photo } from "@/components/ui";
import API from "@/lib/api";

const HOME_ITEMS = [
  { foodId: 1, foodName: "참치캔 6개입 (미개봉)", expired: "2026-06-25", approvedCount: 1, capacity: 3, statusTx: "IN_PROGRESS", emoji: "🐟" },
  { foodId: 2, foodName: "스팸 클래식 200g x 4", expired: "2026-07-15", approvedCount: 0, capacity: 2, statusTx: "IN_PROGRESS", emoji: "🥫" },
  { foodId: 3, foodName: "오뚜기 카레 (백미)", expired: "2026-08-02", approvedCount: 1, capacity: 1, statusTx: "COMPLETED", emoji: "🍛" },
  { foodId: 4, foodName: "농심 신라면 5개입", expired: "2026-06-02", approvedCount: 0, capacity: 5, statusTx: "EXPIRED", emoji: "🍜" },
  { foodId: 5, foodName: "맥심 모카골드 100T", expired: "2026-08-30", approvedCount: 0, capacity: 5, statusTx: "IN_PROGRESS", emoji: "☕" },
  { foodId: 6, foodName: "코코아 분말 (미개봉)", expired: "2026-09-15", approvedCount: 2, capacity: 4, statusTx: "IN_PROGRESS", emoji: "🍫" },
  { foodId: 7, foodName: "비비고 김밥김 10봉", expired: "2026-07-30", approvedCount: 0, capacity: 3, statusTx: "IN_PROGRESS", emoji: "🍙" },
  { foodId: 8, foodName: "햇반 12개입", expired: "2026-10-10", approvedCount: 1, capacity: 2, statusTx: "IN_PROGRESS", emoji: "🍚" },
  { foodId: 9, foodName: "초코파이 박스 24입", expired: "2026-09-05", approvedCount: 0, capacity: 4, statusTx: "IN_PROGRESS", emoji: "🍪" },
  { foodId: 10, foodName: "참기름 320ml", expired: "2027-02-14", approvedCount: 1, capacity: 2, statusTx: "IN_PROGRESS", emoji: "🫒" },
  { foodId: 11, foodName: "오뚜기 잼 (딸기)", expired: "2026-11-20", approvedCount: 0, capacity: 3, statusTx: "IN_PROGRESS", emoji: "🍓" },
  { foodId: 12, foodName: "녹차티백 100개입", expired: "2027-01-30", approvedCount: 0, capacity: 5, statusTx: "INCOMPLETE", emoji: "🍵" },
];

const FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "IN_PROGRESS", label: "진행중" },
  { id: "COMPLETED", label: "완료" },
  { id: "EXPIRED", label: "만료" },
];

export default function HomeScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const [rows, setRows] = useState(HOME_ITEMS);

  // GET /foods?status=&page=&size=  (백엔드 없으면 mock 폴백)
  useEffect(() => {
    let alive = true;
    const status = filter === "ALL" ? undefined : filter;
    API.foods.list({ status, page: 0, size: 20 })
      .then((data) => {
        if (alive && data && Array.isArray(data.content) && data.content.length) setRows(data.content);
      })
      .catch(() => { if (alive) setRows(HOME_ITEMS); });
    return () => { alive = false; };
  }, [filter]);

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
              지금 <b>{HOME_ITEMS.filter((i) => i.statusTx === "IN_PROGRESS").length}개</b>의 미개봉 가공식품이 나눔을 기다리고 있어요.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button className="btn primary lg" onClick={() => router.push("/register")}>
                <Icon.Plus /> 나눔 등록하기
              </button>
              <button className="btn ghost lg">사용 안내</button>
            </div>
          </div>
          <div className="home-hero-art" aria-hidden="true">
            <div className="art-card art-1">
              <Photo label="bread basket" emoji="🥐" />
              <div className="art-card-meta">
                <StatusBadge status="IN_PROGRESS" />
                <span className="eyebrow" style={{ fontSize: 9.5 }}>D-12</span>
              </div>
            </div>
            <div className="art-card art-2">
              <Photo label="canned tuna" emoji="🥫" />
              <div className="art-card-meta">
                <StatusBadge status="COMPLETED" />
                <span className="eyebrow" style={{ fontSize: 9.5 }}>2/2</span>
              </div>
            </div>
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
              <span className="num">{f.id === "ALL" ? HOME_ITEMS.length : HOME_ITEMS.filter((it) => it.statusTx === f.id).length}</span>
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
      <div className="feed-grid">
        {items.map((it) => (
          <FoodCard key={it.foodId} item={it} onClick={() => router.push(`/foods/${it.foodId}`)} />
        ))}
        {items.length === 0 && (
          <div style={{ gridColumn: "1/-1", padding: "80px 0", textAlign: "center", color: "var(--ink-4)" }}>
            조건에 맞는 물품이 없어요
          </div>
        )}
      </div>

      <div className="feed-foot">
        <button className="btn ghost">더 보기</button>
      </div>

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

/* ============ Food Card ============ */
function FoodCard({ item, onClick }) {
  const today = new Date("2026-06-13");
  const expDate = new Date(item.expired);
  const d = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
  const isExpired = item.statusTx === "EXPIRED";
  const dLabel = d < 0 ? `D+${Math.abs(d)}` : d === 0 ? "D-DAY" : `D-${d}`;
  const showDTag = item.statusTx === "IN_PROGRESS" || item.statusTx === "EXPIRED";

  return (
    <button className="food-card card interactive" onClick={onClick}>
      <div className="food-card-img">
        <Photo label="thumbnailUrl" emoji={item.emoji} />
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

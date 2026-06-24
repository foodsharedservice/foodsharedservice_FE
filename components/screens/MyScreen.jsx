"use client";

/* MyScreen.jsx — D-08 마이페이지 (실제 API)
   GET    /members/me                  프로필
   PATCH  /members/me                  정보 수정(닉네임/주소)
   DELETE /members/me                  회원 탈퇴
   POST   /auth/logout                 로그아웃
   DELETE /foods/{foodId}              내 물품 삭제
   PATCH  /foods/{foodId}              내 물품 수정
   GET    /members/me/foods            내가 등록한 물품 목록
   GET    /members/me/requests         내가 보낸 요청 목록
   DELETE /foods/{foodId}/requests/{requestId}  요청 취소 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Photo, StatusBadge, Avatar, StateBox } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import AddressSearch from "@/components/AddressSearch";
import API from "@/lib/api";

/* zip 디자인에서 쓰는 lucide 아이콘(repo 아이콘셋에 없어 로컬 정의) */
function PackageIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
}
function BookOpenIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
function LogOutIcon(p) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

const MY_FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "IN_PROGRESS", label: "진행중" },
  { id: "COMPLETED", label: "완료" },
  { id: "DONE", label: "만료/미완료" },
];

const REQUEST_STATUS_LABEL = {
  REQUEST: "대기중",
  APPROVED: "수락됨",
  REJECTED: "거절됨",
  CANCELLED: "취소됨",
};

const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-amber text-white font-semibold shadow-warm hover:bg-amber-dark transition-colors disabled:opacity-50";
const GHOST_BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-card border border-border text-foreground font-medium hover:border-amber hover:text-amber transition-colors";
const DANGER_GHOST_BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-card border border-destructive/60 text-destructive font-medium hover:bg-destructive/10 transition-colors";
const SM_BTN = "h-9 px-4 text-sm";
const INPUT =
  "w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber transition";
const FIELD_LABEL = "block text-sm font-semibold text-foreground mb-2";

function requestStatusBadgeClass(status) {
  if (status === "APPROVED") return "bg-blue-100 text-blue-700";
  if (status === "REQUEST") return "bg-amber/10 text-amber-dark";
  return "bg-destructive/10 text-destructive";
}

export default function MyScreen() {
  const router = useRouter();
  const { user, loading: authLoading, setUser, refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("foods"); // "foods" | "requests"
  const [editFoodTarget, setEditFoodTarget] = useState(null); // food object to edit

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([API.members.me(), API.foods.myFoods().catch(() => [])])
      .then(([me, res]) => {
        if (!alive) return;
        setProfile(me);
        const list = Array.isArray(res) ? res : (res && res.content) || [];
        setFoods(list);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, router]);

  const removeFood = (foodId) => {
    if (!window.confirm("이 물품을 삭제할까요?")) return;
    API.foods.remove(foodId)
      .then(() => setFoods((prev) => prev.filter((f) => f.foodId !== foodId)))
      .catch((e) => alert(e.message || "삭제에 실패했어요."));
  };

  const logout = async () => {
    try { await API.auth.logout(); } catch {}
    setUser(null);
    router.push("/login");
  };

  const withdraw = async () => {
    if (!window.confirm("정말 탈퇴하시겠어요? 탈퇴한 이메일은 재가입할 수 없어요.")) return;
    try { await API.members.remove(); } catch {}
    setUser(null);
    router.push("/login");
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="container py-10">
        <StateBox kind="loading" title="내 정보를 불러오는 중…" />
      </div>
    );
  }
  if (!user) return null;
  if (error) {
    return (
      <div className="container py-10">
        <StateBox kind="error" title="내 정보를 불러오지 못했어요"
          sub={`서버에 연결할 수 없습니다. (${error.code || error.status || error.message || "네트워크 오류"})`}
          onRetry={() => router.refresh()} />
      </div>
    );
  }

  const p = profile || user;
  const total = foods.length;
  const activeCount = foods.filter((f) => f.statusTx === "IN_PROGRESS").length;
  const completedCount = foods.filter((f) => f.statusTx === "COMPLETED").length;

  const filtered = foods.filter((f) => {
    if (filter === "ALL") return true;
    if (filter === "DONE") return f.statusTx === "EXPIRED" || f.statusTx === "INCOMPLETE";
    return f.statusTx === filter;
  });

  return (
    <div className="animate-fade-in-up">
      {/* ============ Cream 헤더 밴드 ============ */}
      <div className="bg-cream border-b border-border">
        <div className="container py-8 lg:py-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold tracking-widest text-amber-dark mb-1.5">MY PAGE</div>
              <h1 className="text-3xl font-extrabold text-foreground mb-1">내 나눔 활동</h1>
              <p className="text-muted-foreground">{p.nickName}님의 나눔 기록을 확인하세요</p>
            </div>
            <button className={`${PRIMARY_BTN} gap-2`} onClick={() => router.push("/register")}>
              <Icon.Plus width={16} height={16} />
              새 물품 등록
            </button>
          </div>
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-7">
          {/* ============ Sidebar ============ */}
          <aside className="lg:sticky lg:top-20 self-start flex flex-col gap-4">
            <div className="bg-card rounded-2xl border border-border shadow-warm p-6">
              <div className="flex flex-col items-center text-center pb-5 border-b border-border">
                <Avatar name={p.nickName} size={64} />
                <div className="mt-3 font-bold text-lg text-foreground truncate max-w-full">{p.nickName}</div>
                <div className="text-sm text-muted-foreground truncate max-w-full mt-0.5">{p.email}</div>
              </div>
              <div className="mt-5 grid grid-cols-3 divide-x divide-border">
                <div className="flex flex-col items-center gap-0.5">
                  <b className="text-lg font-bold text-amber-dark">{total}</b>
                  <span className="text-xs text-muted-foreground">등록</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <b className="text-lg font-bold text-amber-dark">{activeCount}</b>
                  <span className="text-xs text-muted-foreground">진행중</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <b className="text-lg font-bold text-amber-dark">{completedCount}</b>
                  <span className="text-xs text-muted-foreground">완료</span>
                </div>
              </div>
            </div>

            <nav className="flex flex-col gap-2">
              <MenuItem icon={<PackageIcon />} label="내가 등록한 물품" active={activeTab === "foods"} onClick={() => setActiveTab("foods")} />
              <MenuItem icon={<BookOpenIcon />} label="보낸 요청" active={activeTab === "requests"} onClick={() => setActiveTab("requests")} />
              <MenuItem icon={<Icon.Chat width={18} height={18} />} label="채팅 목록" onClick={() => router.push("/chat")} />
              <MenuItem icon={<Icon.Pencil width={18} height={18} />} label="정보 수정" onClick={() => setEditOpen(true)} />
              <MenuItem icon={<LogOutIcon />} label="로그아웃" onClick={logout} />
              <MenuItem icon={<Icon.Trash width={18} height={18} />} label="회원 탈퇴" danger onClick={withdraw} />
            </nav>
          </aside>

          {/* ============ Main ============ */}
          <div>
            {activeTab === "foods" ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-2 mb-5">
                  <h2 className="text-2xl font-bold text-foreground">내 등록 물품</h2>
                  <div className="text-sm text-muted-foreground">총 {total}건 · 진행중 {activeCount}건</div>
                </div>

                <div className="flex gap-1 bg-muted rounded-xl p-1 mb-6 w-fit overflow-x-auto">
                  {MY_FILTERS.map((f) => {
                    const on = filter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-4">
                  {filtered.map((f, i) => (
                    <div key={f.foodId} className={`flex gap-4 items-center bg-card rounded-2xl border border-border shadow-warm hover:border-amber transition-colors p-4 animate-fade-in-up stagger-${(i % 6) + 1}`}>
                      <Photo
                        label="나눔마켓"
                        src={f.thumbnailUrl || undefined}
                        ratio="1/1"
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl flex-shrink-0 overflow-hidden"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground truncate">{f.foodName}</div>
                        <div className="text-sm text-muted-foreground mt-1">소비기한 {f.expired}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                          <StatusBadge status={f.statusTx} />
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                            {f.approvedCount}/{f.capacity}명
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col gap-1.5 flex-shrink-0">
                        <button className={`${GHOST_BTN} ${SM_BTN}`} onClick={() => router.push(`/foods/${f.foodId}`)}>보기</button>
                        {f.statusTx === "IN_PROGRESS" && (
                          <button className={`${GHOST_BTN} ${SM_BTN}`} onClick={() => setEditFoodTarget(f)}>수정</button>
                        )}
                        {(f.statusTx === "IN_PROGRESS" || f.statusTx === "EXPIRED") && (
                          <button className={`${DANGER_GHOST_BTN} ${SM_BTN}`} onClick={() => removeFood(f.foodId)}>삭제</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <div className="bg-card rounded-2xl border border-border p-12 text-center">
                      <div className="text-muted-foreground grid place-items-center mb-4 opacity-50">
                        <PackageIcon width={48} height={48} />
                      </div>
                      {total === 0 ? (
                        <>
                          <p className="text-foreground font-semibold mb-1">등록한 물품이 없어요</p>
                          <p className="text-sm text-muted-foreground mb-6">미개봉 가공식품을 이웃과 나눠보세요!</p>
                          <button className={PRIMARY_BTN} onClick={() => router.push("/register")}>나눔 등록하기</button>
                        </>
                      ) : (
                        <p className="text-muted-foreground">해당하는 물품이 없어요</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <MySentRequests />
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <EditProfileModal
          profile={p}
          onClose={() => setEditOpen(false)}
          onSaved={async () => { setEditOpen(false); const me = await API.members.me().catch(() => null); if (me) setProfile(me); refresh && refresh(); }}
        />
      )}

      {editFoodTarget && (
        <EditFoodModal
          food={editFoodTarget}
          onClose={() => setEditFoodTarget(null)}
          onSaved={(updated) => {
            setFoods((prev) => prev.map((f) => f.foodId === updated.foodId ? { ...f, ...updated } : f));
            setEditFoodTarget(null);
          }}
        />
      )}
    </div>
  );
}

/* ============ 사이드바 메뉴 아이템 ============ */
function MenuItem({ icon, label, active, danger, onClick }) {
  const base = "flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all";
  const tone = active
    ? "bg-amber text-white shadow-warm font-semibold"
    : danger
    ? "bg-card border border-destructive/60 text-destructive hover:bg-destructive/10"
    : "bg-card border border-border text-foreground hover:bg-muted";
  return (
    <button className={`${base} ${tone}`} onClick={onClick}>
      <span className="grid place-items-center w-5 h-5 flex-shrink-0">{icon}</span>
      {label}
    </button>
  );
}

/* ============ 보낸 요청 목록 ============ */
function MySentRequests() {
  const router = useRouter();
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(() => {
    setErr(null);
    API.requests.mySent()
      .then((res) => setList(Array.isArray(res) ? res : (res && res.content) || []))
      .catch((e) => { setErr(e); setList([]); });
  }, []);

  useEffect(() => load(), [load]);

  const cancel = (foodId, requestId) => {
    if (!window.confirm("요청을 취소할까요?")) return;
    API.requests.cancel(foodId, requestId)
      .then(() => setList((prev) => prev.filter((r) => r.requestId !== requestId)))
      .catch((e) => alert(e.message || "취소에 실패했어요."));
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2 mb-5">
        <h2 className="text-2xl font-bold text-foreground">보낸 요청</h2>
        {list && <div className="text-sm text-muted-foreground">총 {list.length}건</div>}
      </div>

      {list === null ? (
        <StateBox kind="loading" title="요청 목록을 불러오는 중…" />
      ) : err ? (
        <StateBox kind="error" title="요청 목록을 불러오지 못했어요" onRetry={load} />
      ) : list.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <div className="text-muted-foreground grid place-items-center mb-4 opacity-50">
            <BookOpenIcon width={48} height={48} />
          </div>
          <p className="text-foreground font-semibold mb-1">보낸 요청이 없어요</p>
          <p className="text-sm text-muted-foreground mb-6">마음에 드는 물품에 나눔을 신청해보세요!</p>
          <button className={PRIMARY_BTN} onClick={() => router.push("/foods")}>물품 목록 보기</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((r, i) => (
            <div key={r.requestId} className={`flex gap-4 items-center bg-card rounded-2xl border border-border shadow-warm hover:border-amber transition-colors p-4 animate-fade-in-up stagger-${(i % 6) + 1}`}>
              <Photo
                label="나눔마켓"
                src={r.thumbnailUrl || undefined}
                ratio="1/1"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl flex-shrink-0 overflow-hidden"
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground truncate">{r.foodName || "물품"}</div>
                {r.ownerNickName && <div className="text-sm text-muted-foreground mt-1">등록자 {r.ownerNickName}</div>}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${requestStatusBadgeClass(r.status)}`}>
                    {REQUEST_STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-row sm:flex-col gap-1.5 flex-shrink-0">
                <button className={`${GHOST_BTN} ${SM_BTN}`} onClick={() => router.push(`/foods/${r.foodId}`)}>보기</button>
                {r.status === "REQUEST" && (
                  <button className={`${DANGER_GHOST_BTN} ${SM_BTN}`} onClick={() => cancel(r.foodId, r.requestId)}>취소</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ============ 음식 수정 모달 (PATCH /foods/{foodId}) ============ */
function EditFoodModal({ food, onClose, onSaved }) {
  const [foodName, setFoodName] = useState(food.foodName || "");
  const [capacity, setCapacity] = useState(food.capacity || 3);
  const [details, setDetails] = useState("");
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    API.foods.detail(food.foodId)
      .then((d) => { setDetails(d.details || ""); setDetailsLoaded(true); })
      .catch(() => setDetailsLoaded(true));
  }, [food.foodId]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {};
      if (foodName.trim() !== food.foodName) body.foodName = foodName.trim();
      if (capacity !== food.capacity) body.capacity = capacity;
      if (detailsLoaded) body.details = details.trim();
      const updated = await API.foods.update(food.foodId, body);
      onSaved && onSaved({ ...food, foodName: foodName.trim(), capacity, ...(updated || {}) });
    } catch (e) {
      const map = { VALIDATION_FAILED: "입력값을 확인해주세요.", FOOD_NOT_FOUND: "존재하지 않는 물품이에요." };
      setError(map[e.code] || e.message || "수정에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-foreground/45 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-2xl shadow-warm-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted" onClick={onClose} aria-label="닫기"><Icon.X /></button>
        <div className="text-xs font-bold tracking-widest text-amber-dark">EDIT FOOD</div>
        <h2 className="text-xl font-bold text-foreground mt-1 mb-4">물품 수정</h2>

        <label className={FIELD_LABEL}>물품 이름</label>
        <input className={INPUT} value={foodName} onChange={(e) => setFoodName(e.target.value)} maxLength={30} />

        <div className="flex items-center justify-between mt-4 mb-2">
          <span className="text-sm font-semibold text-foreground">정원 수</span>
          <span className="text-xs text-muted-foreground">최대 10명</span>
        </div>
        <div className="flex items-center gap-3 py-1">
          <button className="w-9 h-9 grid place-items-center rounded-lg bg-card border border-border text-foreground hover:border-amber hover:text-amber transition-colors" onClick={() => setCapacity((c) => Math.max(1, c - 1))} aria-label="감소"><Icon.Minus /></button>
          <span className="min-w-[60px] text-center text-xl font-bold text-foreground">{capacity}명</span>
          <button className="w-9 h-9 grid place-items-center rounded-lg bg-card border border-border text-foreground hover:border-amber hover:text-amber transition-colors" onClick={() => setCapacity((c) => Math.min(10, c + 1))} aria-label="증가"><Icon.Plus /></button>
        </div>

        <label className={`${FIELD_LABEL} mt-4`}>상세 내용</label>
        {!detailsLoaded ? (
          <div className="py-5 text-center text-xs text-muted-foreground">불러오는 중…</div>
        ) : (
          <textarea className={`${INPUT} h-auto min-h-[120px] py-3 resize-y`} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={4} />
        )}

        {error && (
          <div className="mt-3.5 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>
        )}

        <div className="flex gap-2 mt-5">
          <button className={`${GHOST_BTN} h-11 px-6 flex-1`} onClick={onClose}>취소</button>
          <button className={`${PRIMARY_BTN} flex-[2]`} onClick={save} disabled={busy || !foodName.trim()}>{busy ? "저장 중…" : "저장하기"}</button>
        </div>
      </div>
    </div>
  );
}

/* ============ 정보 수정 모달 (PATCH /members/me) ============ */
function EditProfileModal({ profile, onClose, onSaved }) {
  const [nick, setNick] = useState(profile.nickName || "");
  const [road, setRoad] = useState((profile.address && profile.address.roadAddress) || "");
  const [detail, setDetail] = useState((profile.address && profile.address.detailAddress) || "");
  const [addrOpen, setAddrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {};
      if (nick && nick !== profile.nickName) body.nickName = nick;
      if (road) body.address = { roadAddress: road, detailAddress: detail };
      await API.members.update(body);
      onSaved && onSaved();
    } catch (e) {
      const map = { NICKNAME_DUPLICATED: "이미 사용 중인 닉네임이에요.", VALIDATION_FAILED: "입력값을 확인해주세요. (닉네임 2~10자)" };
      setError(map[e.code] || e.message || "수정에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-foreground/45 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-2xl shadow-warm-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted" onClick={onClose} aria-label="닫기"><Icon.X /></button>
        <div className="text-xs font-bold tracking-widest text-amber-dark">EDIT PROFILE</div>
        <h2 className="text-xl font-bold text-foreground mt-1 mb-4">정보 수정</h2>

        <label className={FIELD_LABEL}>닉네임 <span className="font-normal text-muted-foreground">2–10자</span></label>
        <input className={INPUT} value={nick} onChange={(e) => setNick(e.target.value)} maxLength={10} />

        <label className={`${FIELD_LABEL} mt-4`}>주소</label>
        <div className="flex gap-2">
          <input className={`${INPUT} cursor-pointer`} value={road} readOnly onClick={() => setAddrOpen(true)} placeholder="도로명 주소 검색" />
          <button className={`${GHOST_BTN} h-12 px-4 whitespace-nowrap`} onClick={() => setAddrOpen(true)}>주소 검색</button>
        </div>
        <input className={`${INPUT} mt-2`} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="상세주소 (선택)" />

        {error && (
          <div className="mt-3.5 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>
        )}

        <div className="flex gap-2 mt-5">
          <button className={`${GHOST_BTN} h-11 px-6 flex-1`} onClick={onClose}>취소</button>
          <button className={`${PRIMARY_BTN} flex-[2]`} onClick={save} disabled={busy}>{busy ? "저장 중…" : "저장하기"}</button>
        </div>
      </div>

      <AddressSearch open={addrOpen} onClose={() => setAddrOpen(false)} onComplete={(data) => {
        const building = data.buildingName && data.buildingName !== "N" ? ` (${data.buildingName})` : "";
        setRoad((data.roadAddress || data.jibunAddress || "") + building);
      }} />
    </div>
  );
}

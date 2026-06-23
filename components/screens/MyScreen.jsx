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
import {
  Package,
  FileText,
  MessageSquare,
  Edit2,
  Trash2,
  PlusCircle,
  Minus,
  X,
  Check,
  LogOut,
} from "lucide-react";
import { Photo, StatusBadge, Avatar, StateBox } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import AddressSearch from "@/components/AddressSearch";
import API from "@/lib/api";

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
      <div className="min-h-screen bg-background pt-20">
        <div className="container py-8">
          <StateBox kind="loading" title="내 정보를 불러오는 중…" />
        </div>
      </div>
    );
  }
  if (!user) return null;
  if (error) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="container py-8">
          <StateBox kind="error" title="내 정보를 불러오지 못했어요"
            sub={`서버에 연결할 수 없습니다. (${error.code || error.status || error.message || "네트워크 오류"})`}
            onRetry={() => router.refresh()} />
        </div>
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
    <div className="min-h-screen bg-background pt-20">
      {/* ============ Cream header band ============ */}
      <div className="bg-cream border-b border-border">
        <div className="container py-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-amber text-white grid place-items-center text-2xl font-bold flex-shrink-0">
                  {(p.nickName || "U").trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-foreground truncate">{p.nickName}</div>
                  <div className="text-sm text-muted-foreground truncate">{p.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-xl font-extrabold text-foreground">{total}</span>
                  <span className="text-xs text-muted-foreground">등록</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-extrabold text-foreground">{activeCount}</span>
                  <span className="text-xs text-muted-foreground">진행중</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-extrabold text-foreground">{completedCount}</span>
                  <span className="text-xs text-muted-foreground">완료</span>
                </div>
              </div>

              <h1 className="text-3xl font-extrabold text-foreground">내 나눔 활동</h1>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-amber px-3 py-1.5 rounded-lg border border-border bg-card hover:border-amber transition-colors"
                  onClick={() => setEditOpen(true)}
                >
                  <Edit2 className="w-4 h-4" /> 정보 수정
                </button>
                <button
                  className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-amber px-3 py-1.5 rounded-lg border border-border bg-card hover:border-amber transition-colors"
                  onClick={() => router.push("/chat")}
                >
                  <MessageSquare className="w-4 h-4" /> 채팅 목록
                </button>
                <button
                  className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-amber px-3 py-1.5 rounded-lg border border-border bg-card hover:border-amber transition-colors"
                  onClick={logout}
                >
                  <LogOut className="w-4 h-4" /> 로그아웃
                </button>
                <button
                  className="inline-flex items-center gap-1.5 text-sm text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg border border-destructive transition-colors"
                  onClick={withdraw}
                >
                  <Trash2 className="w-4 h-4" /> 회원 탈퇴
                </button>
              </div>
            </div>

            <button
              className="inline-flex items-center gap-2 bg-amber text-white hover:bg-amber-dark shadow-warm px-4 py-2.5 rounded-xl font-medium transition-colors self-start md:self-auto"
              onClick={() => router.push("/register")}
            >
              <PlusCircle className="w-4 h-4" />
              새 물품 등록
            </button>
          </div>
        </div>
      </div>

      {/* ============ Tabs + content ============ */}
      <div className="container py-8">
        {/* Tab switcher */}
        <div className="inline-flex bg-muted rounded-xl p-1 mb-8">
          <button
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "foods" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("foods")}
          >
            <Package className="w-4 h-4" />
            내 등록 물품
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "requests" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("requests")}
          >
            <FileText className="w-4 h-4" />
            보낸 요청
          </button>
        </div>

        {activeTab === "foods" ? (
          <>
            <div className="flex items-end justify-between gap-4 mb-4">
              <h2 className="text-2xl font-bold text-foreground">내가 등록한 물품</h2>
              <div className="text-sm text-muted-foreground">총 {total}건 · 진행중 {activeCount}건</div>
            </div>

            {/* Status filter chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              {MY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === f.id
                      ? "bg-amber text-white"
                      : "bg-card border border-border text-foreground hover:border-amber"
                  }`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Foods list */}
            <div className="space-y-4">
              {filtered.map((f) => (
                <div
                  className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4 hover:border-amber transition-colors"
                  key={f.foodId}
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                    <Photo label="나눔마켓" src={f.thumbnailUrl || undefined} ratio="1/1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{f.foodName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">소비기한 {f.expired}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge status={f.statusTx} />
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                        {f.approvedCount}/{f.capacity}명
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    <button
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:border-amber transition-colors"
                      onClick={() => router.push(`/foods/${f.foodId}`)}
                    >
                      보기
                    </button>
                    {f.statusTx === "IN_PROGRESS" && (
                      <button
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:border-amber transition-colors"
                        onClick={() => setEditFoodTarget(f)}
                      >
                        <Edit2 className="w-3.5 h-3.5" /> 수정
                      </button>
                    )}
                    {(f.statusTx === "IN_PROGRESS" || f.statusTx === "EXPIRED") && (
                      <button
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => removeFood(f.foodId)}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 삭제
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-16">
                  {total === 0 ? (
                    <>
                      <Package className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground mb-5">아직 등록한 물품이 없어요</p>
                      <button
                        className="bg-amber text-white hover:bg-amber-dark px-4 py-2 rounded-xl font-medium transition-colors"
                        onClick={() => router.push("/register")}
                      >
                        나눔 등록하기
                      </button>
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
      <div className="flex items-end justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-foreground">보낸 요청</h2>
        {list && <div className="text-sm text-muted-foreground">총 {list.length}건</div>}
      </div>

      {list === null ? (
        <StateBox kind="loading" title="요청 목록을 불러오는 중…" />
      ) : err ? (
        <StateBox kind="error" title="요청 목록을 불러오지 못했어요" onRetry={load} />
      ) : list.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">보낸 요청이 없어요</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <div
              className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4 hover:border-amber transition-colors"
              key={r.requestId}
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                <Photo label="나눔마켓" src={r.thumbnailUrl || undefined} ratio="1/1" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">{r.foodName || "물품"}</div>
                {r.ownerNickName && (
                  <div className="text-sm text-muted-foreground mt-0.5">등록자 {r.ownerNickName}</div>
                )}
                <div className="mt-2">
                  <span
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                      r.status === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : r.status === "REQUEST"
                        ? "bg-amber/10 text-amber-dark"
                        : r.status === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {REQUEST_STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                <button
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:border-amber transition-colors"
                  onClick={() => router.push(`/foods/${r.foodId}`)}
                >
                  보기
                </button>
                {r.status === "REQUEST" && (
                  <button
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => cancel(r.foodId, r.requestId)}
                  >
                    취소
                  </button>
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
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-md shadow-warm-lg relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 w-8 h-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={onClose}
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-foreground mb-5">물품 수정</h2>

        <label className="block text-sm font-medium text-foreground mb-1.5">물품 이름</label>
        <input
          className="w-full h-11 px-3 rounded-xl border border-border bg-card focus:border-amber focus:outline-none"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          maxLength={30}
        />

        <div className="flex justify-between items-center mt-4 mb-1.5">
          <label className="text-sm font-medium text-foreground">정원 수</label>
          <span className="text-xs text-muted-foreground">최대 10명</span>
        </div>
        <div className="flex items-center gap-3 py-1">
          <button
            className="w-9 h-9 rounded-lg border border-border bg-card text-foreground grid place-items-center hover:border-amber hover:text-amber transition-colors"
            onClick={() => setCapacity((c) => Math.max(1, c - 1))}
            aria-label="감소"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="min-w-[60px] text-center text-xl font-bold text-foreground">{capacity}명</span>
          <button
            className="w-9 h-9 rounded-lg border border-border bg-card text-foreground grid place-items-center hover:border-amber hover:text-amber transition-colors"
            onClick={() => setCapacity((c) => Math.min(10, c + 1))}
            aria-label="증가"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-sm font-medium text-foreground mt-4 mb-1.5">상세 내용</label>
        {!detailsLoaded ? (
          <div className="py-5 text-center text-muted-foreground text-xs">불러오는 중…</div>
        ) : (
          <textarea
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card focus:border-amber focus:outline-none resize-none"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            rows={4}
          />
        )}

        {error && (
          <div className="mt-4 px-3 py-2.5 rounded-lg bg-red-50 text-destructive text-sm">{error}</div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            className="flex-1 h-11 rounded-xl border border-border bg-card text-foreground font-medium hover:border-amber transition-colors"
            onClick={onClose}
          >
            취소
          </button>
          <button
            className="flex-[2] inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-amber text-white font-medium hover:bg-amber-dark transition-colors disabled:opacity-50"
            onClick={save}
            disabled={busy || !foodName.trim()}
          >
            {busy ? "저장 중…" : (<><Check className="w-4 h-4" /> 저장하기</>)}
          </button>
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
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-md shadow-warm-lg relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 w-8 h-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={onClose}
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-foreground mb-5">정보 수정</h2>

        <label className="block text-sm font-medium text-foreground mb-1.5">
          닉네임 <span className="text-xs text-muted-foreground font-normal">2–10자</span>
        </label>
        <input
          className="w-full h-11 px-3 rounded-xl border border-border bg-card focus:border-amber focus:outline-none"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={10}
        />

        <label className="block text-sm font-medium text-foreground mt-4 mb-1.5">주소</label>
        <div className="flex gap-2">
          <input
            className="flex-1 h-11 px-3 rounded-xl border border-border bg-card focus:border-amber focus:outline-none cursor-pointer"
            value={road}
            readOnly
            onClick={() => setAddrOpen(true)}
            placeholder="도로명 주소 검색"
          />
          <button
            className="px-4 h-11 rounded-xl border border-border bg-card text-foreground font-medium hover:border-amber transition-colors flex-shrink-0"
            onClick={() => setAddrOpen(true)}
          >
            주소 검색
          </button>
        </div>
        <input
          className="w-full h-11 px-3 mt-2 rounded-xl border border-border bg-card focus:border-amber focus:outline-none"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="상세주소 (선택)"
        />

        {error && (
          <div className="mt-4 px-3 py-2.5 rounded-lg bg-red-50 text-destructive text-sm">{error}</div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            className="flex-1 h-11 rounded-xl border border-border bg-card text-foreground font-medium hover:border-amber transition-colors"
            onClick={onClose}
          >
            취소
          </button>
          <button
            className="flex-[2] inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-amber text-white font-medium hover:bg-amber-dark transition-colors disabled:opacity-50"
            onClick={save}
            disabled={busy}
          >
            {busy ? "저장 중…" : (<><Check className="w-4 h-4" /> 저장하기</>)}
          </button>
        </div>
      </div>

      <AddressSearch open={addrOpen} onClose={() => setAddrOpen(false)} onComplete={(data) => {
        const building = data.buildingName && data.buildingName !== "N" ? ` (${data.buildingName})` : "";
        setRoad((data.roadAddress || data.jibunAddress || "") + building);
      }} />
    </div>
  );
}

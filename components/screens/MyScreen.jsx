"use client";

/* MyScreen.jsx — 마이페이지(내 정보 / 내 등록 물품 / 내 신청 물품)
   manus 참고 디자인(Profile.tsx) 그대로 포팅 + 실제 API 연결.
   좌측 사이드바(내정보·내 등록 물품·내 신청 물품·로그아웃) + 우측 콘텐츠. */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Package, FileText, LogOut, Edit2, Trash2, Plus, Minus, X, Search } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import AddressSearch from "@/components/AddressSearch";
import API from "@/lib/api";

const INPUT =
  "w-full h-11 rounded-xl border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber transition";
const STATUS_LABELS = { IN_PROGRESS: "나눔중", COMPLETED: "나눔완료", INCOMPLETE: "나눔취소", EXPIRED: "기간만료" };
const REQ_LABELS = { REQUEST: "대기중", APPROVED: "승인됨", REJECTED: "거절됨", CANCELLED: "취소됨" };

function daysUntil(dateStr) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const e = new Date(dateStr); e.setHours(0, 0, 0, 0);
  return Math.ceil((e - t) / 86400000);
}
function fmtDate(s) {
  if (!s) return "-";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default function MyScreen() {
  const router = useRouter();
  const { user, loading: authLoading, setUser, refresh } = useAuth();
  const [tab, setTab] = useState("profile"); // profile | foods | requests
  const [profile, setProfile] = useState(null);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editFoodTarget, setEditFoodTarget] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    setLoading(true); setError(null);
    Promise.all([API.members.me(), API.foods.myFoods().catch(() => [])])
      .then(([me, res]) => {
        if (!alive) return;
        setProfile(me);
        setFoods(Array.isArray(res) ? res : (res && res.content) || []);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, router]);

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
  const removeFood = (foodId) => {
    if (!window.confirm("이 물품을 삭제할까요?")) return;
    API.foods.remove(foodId)
      .then(() => setFoods((prev) => prev.filter((f) => f.foodId !== foodId)))
      .catch((e) => alert(e.message || "삭제에 실패했어요."));
  };

  if (authLoading || (user && loading)) {
    return <div className="min-h-[calc(100vh-4rem)] bg-background grid place-items-center"><Spinner size={30} /></div>;
  }
  if (!user) return null;

  const p = profile || user;
  const navItem = (key, icon, label) => (
    <button onClick={() => setTab(key)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
        tab === key ? "bg-amber text-white shadow-warm" : "bg-card text-foreground hover:bg-muted border border-border"}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="flex md:flex-col gap-2 md:w-52 md:flex-shrink-0 overflow-x-auto md:overflow-visible">
            {navItem("profile", <User className="w-5 h-5" />, "내정보")}
            {navItem("foods", <Package className="w-5 h-5" />, "내 등록 물품")}
            {navItem("requests", <FileText className="w-5 h-5" />, "내 신청 물품")}
            <button onClick={logout}
              className="md:mt-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium border border-destructive text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap">
              <LogOut className="w-4 h-4" /> 로그아웃
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {error ? (
              <div className="bg-card rounded-2xl p-12 text-center border border-border text-muted-foreground">내 정보를 불러오지 못했어요</div>
            ) : tab === "profile" ? (
              <div className="bg-card rounded-2xl p-6 shadow-warm border border-border animate-fade-in">
                <div className="flex flex-col items-center text-center pb-4 border-b border-border">
                  <div className="w-16 h-16 rounded-full bg-amber text-white grid place-items-center text-2xl font-bold mb-3">
                    {(p.nickName || "U").charAt(0).toUpperCase()}
                  </div>
                  <h1 className="text-xl font-bold text-foreground">{p.nickName}</h1>
                  <p className="text-sm text-muted-foreground mt-1">{p.email}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-5">
                  <Info label="닉네임" value={p.nickName} />
                  <Info label="이메일" value={p.email} />
                  <Info label="가입일" value={fmtDate(p.createdAt)} />
                </div>
                {p.address && p.address.roadAddress && (
                  <div className="pb-5"><Info label="주소" value={`${p.address.roadAddress}${p.address.detailAddress ? " " + p.address.detailAddress : ""}`} /></div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setEditOpen(true)}
                    className="flex-1 h-11 inline-flex items-center justify-center gap-2 bg-amber text-white hover:bg-amber-dark rounded-xl text-sm font-semibold transition-colors">
                    <Edit2 className="w-3.5 h-3.5" /> 프로필 수정
                  </button>
                  <button onClick={withdraw}
                    className="flex-1 h-11 inline-flex items-center justify-center gap-2 border border-destructive text-destructive hover:bg-destructive/10 rounded-xl text-sm font-semibold transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> 회원 탈퇴
                  </button>
                </div>
              </div>
            ) : tab === "foods" ? (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-foreground">내 등록 물품</h2>
                  <button onClick={() => router.push("/register")}
                    className="h-10 px-4 inline-flex items-center gap-1.5 bg-amber text-white hover:bg-amber-dark rounded-xl text-sm font-semibold shadow-warm transition-colors">
                    <Package className="w-4 h-4" /> 새 물품 등록
                  </button>
                </div>
                {foods.length === 0 ? (
                  <div className="bg-card rounded-2xl p-12 text-center border border-border">
                    <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground mb-4">등록한 물품이 없습니다</p>
                    <button onClick={() => router.push("/register")} className="h-10 px-5 bg-amber text-white rounded-xl text-sm font-semibold hover:bg-amber-dark">물품 등록하기</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {foods.map((food) => {
                      const d = daysUntil(food.expired);
                      return (
                        <div key={food.foodId} className="bg-card rounded-2xl p-4 sm:p-6 border border-border hover:shadow-warm transition-shadow">
                          <div className="flex gap-4 sm:gap-6">
                            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                              {food.thumbnailUrl ? <img src={food.thumbnailUrl} alt={food.foodName} className="w-full h-full object-cover" />
                                : <div className="w-full h-full grid place-items-center text-3xl">🍱</div>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 line-clamp-2">{food.foodName}</h3>
                              <div className="space-y-1 text-sm text-muted-foreground mb-4">
                                <p>소비기한: <span className="font-semibold text-foreground">{d <= 0 ? "만료" : `D-${d}`}</span></p>
                                <p>신청 현황: <span className="font-semibold text-foreground">{food.approvedCount} / {food.capacity}명</span></p>
                                <p>상태: <span className="font-semibold text-amber">{STATUS_LABELS[food.statusTx] || food.statusTx}</span></p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button onClick={() => router.push(`/foods/${food.foodId}`)}
                                  className="h-9 px-3 inline-flex items-center gap-1 border border-border bg-card text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">보기</button>
                                {food.statusTx === "IN_PROGRESS" && (
                                  <button onClick={() => setEditFoodTarget(food)}
                                    className="h-9 px-3 inline-flex items-center gap-1 bg-amber text-white rounded-lg text-sm font-medium hover:bg-amber-dark transition-colors">
                                    <Edit2 className="w-4 h-4" /> 수정
                                  </button>
                                )}
                                {(food.statusTx === "IN_PROGRESS" || food.statusTx === "EXPIRED") && (
                                  <button onClick={() => removeFood(food.foodId)}
                                    className="h-9 px-3 inline-flex items-center gap-1 border border-destructive text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors">
                                    <Trash2 className="w-4 h-4" /> 삭제
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <MySentRequests />
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <EditProfileModal profile={p} onClose={() => setEditOpen(false)}
          onSaved={async () => { setEditOpen(false); const me = await API.members.me().catch(() => null); if (me) setProfile(me); refresh && refresh(); }} />
      )}
      {editFoodTarget && (
        <EditFoodModal food={editFoodTarget} onClose={() => setEditFoodTarget(null)}
          onSaved={(updated) => { setFoods((prev) => prev.map((f) => f.foodId === updated.foodId ? { ...f, ...updated } : f)); setEditFoodTarget(null); }} />
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-1 break-words">{value}</p>
    </div>
  );
}

function Spinner({ size = 28 }) {
  return <span className="border-2 border-amber/30 border-t-amber rounded-full animate-spin" style={{ width: size, height: size }} />;
}

/* ============ 내 신청 물품 ============ */
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

  const badgeCls = (s) =>
    s === "APPROVED" ? "bg-blue-100 text-blue-700" :
    s === "REQUEST" ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700";

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground">내 신청 물품</h2>
      {list === null ? (
        <div className="py-16 grid place-items-center"><Spinner /></div>
      ) : err ? (
        <div className="bg-card rounded-2xl p-12 text-center border border-border text-muted-foreground">신청 목록을 불러오지 못했어요</div>
      ) : list.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center border border-border">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">신청한 물품이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <div key={r.requestId} className="bg-card rounded-2xl p-6 border border-border hover:shadow-warm transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground truncate cursor-pointer hover:text-amber" onClick={() => router.push(`/foods/${r.foodId}`)}>
                    {r.foodName || "물품"}
                  </h3>
                  {r.ownerNickName && <p className="text-sm text-muted-foreground mt-1">등록자: {r.ownerNickName}</p>}
                </div>
                <span className={`text-xs font-bold px-4 py-2 rounded-full flex-shrink-0 ${badgeCls(r.status)}`}>
                  {r.status === "APPROVED" ? "✓ 승인됨" : r.status === "REQUEST" ? "⏳ 대기중" : `✕ ${REQ_LABELS[r.status] || r.status}`}
                </span>
              </div>
              <p className="text-sm text-foreground mb-4">
                {r.status === "REQUEST" && "아직 나눔자의 응답을 기다리고 있습니다."}
                {r.status === "APPROVED" && "나눔자가 승인했습니다. 채팅으로 연락하세요."}
                {r.status === "REJECTED" && "죄송하지만 나눔자가 거절했습니다."}
              </p>
              {r.status === "REQUEST" && (
                <button onClick={() => cancel(r.foodId, r.requestId)}
                  className="h-9 px-3 inline-flex items-center border border-destructive text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors">신청 취소</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ 모달 ============ */
function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-warm-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
        <h2 className="text-xl font-bold text-foreground mb-5">{title}</h2>
        {children}
      </div>
    </div>
  );
}

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
    setBusy(true); setError(null);
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
    } finally { setBusy(false); }
  };

  return (
    <ModalShell title="물품 수정" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">물품 이름</label>
          <input className={INPUT} value={foodName} maxLength={30} onChange={(e) => setFoodName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">나눔 인원</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setCapacity((c) => Math.max(1, c - 1))} className="w-9 h-9 rounded-lg border border-border grid place-items-center hover:border-amber hover:text-amber"><Minus className="w-4 h-4" /></button>
            <span className="min-w-[3rem] text-center text-lg font-bold">{capacity}명</span>
            <button onClick={() => setCapacity((c) => Math.min(10, c + 1))} className="w-9 h-9 rounded-lg border border-border grid place-items-center hover:border-amber hover:text-amber"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">상세 내용</label>
          {!detailsLoaded ? <p className="text-sm text-muted-foreground py-3 text-center">불러오는 중…</p>
            : <textarea className={`${INPUT} h-auto py-3 resize-none`} rows={4} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border bg-card font-medium hover:bg-muted">취소</button>
          <button onClick={save} disabled={busy || !foodName.trim()} className="flex-[2] h-11 rounded-xl bg-amber text-white font-semibold hover:bg-amber-dark disabled:opacity-50">{busy ? "저장 중…" : "저장하기"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function EditProfileModal({ profile, onClose, onSaved }) {
  const [nick, setNick] = useState(profile.nickName || "");
  const [road, setRoad] = useState((profile.address && profile.address.roadAddress) || "");
  const [detail, setDetail] = useState((profile.address && profile.address.detailAddress) || "");
  const [addrOpen, setAddrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const body = {};
      if (nick && nick !== profile.nickName) body.nickName = nick;
      if (road) body.address = { roadAddress: road, detailAddress: detail };
      await API.members.update(body);
      onSaved && onSaved();
    } catch (e) {
      const map = { NICKNAME_DUPLICATED: "이미 사용 중인 닉네임이에요.", VALIDATION_FAILED: "입력값을 확인해주세요. (닉네임 2~10자)" };
      setError(map[e.code] || e.message || "수정에 실패했어요.");
    } finally { setBusy(false); }
  };

  return (
    <ModalShell title="프로필 수정" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">닉네임 <span className="text-muted-foreground text-xs">2–10자</span></label>
          <input className={INPUT} value={nick} maxLength={10} onChange={(e) => setNick(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">도로명 주소</label>
          <div className="flex gap-2">
            <input className={`${INPUT} flex-1 cursor-pointer`} value={road} readOnly onClick={() => setAddrOpen(true)} placeholder="주소 검색" />
            <button onClick={() => setAddrOpen(true)} className="h-11 px-4 inline-flex items-center gap-1 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted"><Search className="w-3.5 h-3.5" /> 검색</button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">상세 주소 <span className="text-muted-foreground text-xs">(선택)</span></label>
          <input className={INPUT} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="101동 202호" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border bg-card font-medium hover:bg-muted">취소</button>
          <button onClick={save} disabled={busy} className="flex-[2] h-11 rounded-xl bg-amber text-white font-semibold hover:bg-amber-dark disabled:opacity-50">{busy ? "저장 중…" : "저장하기"}</button>
        </div>
      </div>
      <AddressSearch open={addrOpen} onClose={() => setAddrOpen(false)} onComplete={(data) => {
        const building = data.buildingName && data.buildingName !== "N" ? ` (${data.buildingName})` : "";
        setRoad((data.roadAddress || data.jibunAddress || "") + building);
      }} />
    </ModalShell>
  );
}

"use client";

/* components/AppHeader.jsx — 나눔마켓 상단 네비게이션 (Warm Market)
   - 홈(/)에서는 히어로 위에 투명하게 떠 있다가 스크롤하면 흰 배경으로 전환
   - 그 외 페이지에서는 항상 흰 배경 sticky 헤더
   - 알림(받은 나눔 요청) 드롭다운 로직은 그대로 유지
     (통합 알림 API가 없어 내 물품 foodId별 GET /foods/{id}/requests를 합산) */

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Sprout, PlusCircle, Bell, MessageSquare, Menu, X, Package, User, LogOut,
} from "lucide-react";
import { Avatar, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

/* 내 물품 목록을 정규화해 [{ foodId, foodName }] 배열로 반환 */
async function fetchMyFoods() {
  const res = await API.foods.myFoods();
  const list = Array.isArray(res) ? res : (res && res.content) || [];
  return list.map((f) => ({ foodId: f.foodId, foodName: f.foodName }));
}

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [bellOpen, setBellOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHome = pathname === "/";
  // 홈 히어로 위에 투명하게 올라간 상태(스크롤 전)인지
  const overHero = isHome && !scrolled;

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  // 받은 나눔 요청(REQUEST) 개수 → 벨 뱃지
  useEffect(() => {
    if (!user) { setNotifCount(0); return; }
    let alive = true;
    (async () => {
      try {
        const foods = await fetchMyFoods();
        if (!foods.length) { if (alive) setNotifCount(0); return; }
        const counts = await Promise.all(
          foods.map((f) =>
            API.requests.received(f.foodId)
              .then((rs) => (rs || []).filter((r) => r.status === "REQUEST").length)
              .catch(() => 0)
          )
        );
        if (alive) setNotifCount(counts.reduce((a, b) => a + b, 0));
      } catch {
        if (alive) setNotifCount(0);
      }
    })();
    return () => { alive = false; };
  }, [user, pathname, bellOpen]);

  const go = (path) => { setMobileOpen(false); router.push(path); };

  const logout = async () => {
    try { await API.auth.logout(); } catch {}
    setMobileOpen(false);
    window.location.href = "/login";
  };

  const headerCls = overHero
    ? "fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-transparent"
    : isHome
    ? "fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/95 backdrop-blur-xl shadow-sm border-b border-border"
    : "sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-border";

  const linkCls = overHero
    ? "text-white/90 hover:text-white"
    : "text-foreground/70 hover:text-foreground";

  return (
    <header className={headerCls}>
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <button onClick={() => go("/")} className="flex items-center gap-2.5 group">
            <span className="w-9 h-9 rounded-xl bg-amber text-white grid place-items-center shadow-warm flex-shrink-0">
              <Sprout className="w-5 h-5" />
            </span>
            <span className={`text-lg font-bold tracking-tight ${overHero ? "text-white" : "text-foreground"}`}>
              나눔마켓
            </span>
          </button>

          {/* 데스크톱 내비 */}
          <nav className="hidden md:flex items-center gap-1">
            <button onClick={() => go("/")} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${linkCls}`}>물품 목록</button>
            {user && (
              <>
                <button onClick={() => go("/mypage")} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${linkCls}`}>내 나눔</button>
                <button onClick={() => go("/chat")} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${linkCls}`}>채팅</button>
              </>
            )}
          </nav>

          {/* 데스크톱 액션 */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <button
                  onClick={() => go("/register")}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-amber text-white text-sm font-semibold shadow-warm hover:bg-amber-dark transition-colors"
                >
                  <PlusCircle className="w-4 h-4" /> 물품 등록
                </button>
                <button
                  onClick={() => setBellOpen((v) => !v)}
                  aria-label="알림"
                  className={`relative w-10 h-10 grid place-items-center rounded-full transition-colors ${overHero ? "text-white hover:bg-white/15" : "text-foreground/70 hover:bg-muted"}`}
                >
                  <Bell className="w-5 h-5" />
                  {notifCount > 0 && !bellOpen && (
                    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold grid place-items-center border-2 border-white">
                      {notifCount}
                    </span>
                  )}
                </button>
                <button onClick={() => go("/mypage")} className="flex items-center gap-2 rounded-full hover:bg-muted transition-colors pl-1 pr-2.5 py-1">
                  <span className="w-8 h-8 rounded-full bg-amber text-white grid place-items-center text-xs font-bold">
                    {(user.nickName || "U").charAt(0).toUpperCase()}
                  </span>
                  <span className={`text-sm font-medium ${overHero ? "text-white" : "text-foreground"}`}>{user.nickName}</span>
                </button>
              </>
            ) : loading ? (
              <Spinner size={18} />
            ) : (
              <>
                <button onClick={() => go("/login")} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${linkCls}`}>로그인</button>
                <button onClick={() => go("/signup")} className="h-9 px-4 rounded-full bg-amber text-white text-sm font-semibold shadow-warm hover:bg-amber-dark transition-colors">회원가입</button>
              </>
            )}
          </div>

          {/* 모바일 토글 */}
          <button
            className={`md:hidden p-2 rounded-lg transition-colors ${overHero ? "text-white hover:bg-white/15" : "text-foreground hover:bg-muted"}`}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="메뉴"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-border animate-fade-in">
          <div className="container py-4 flex flex-col gap-1">
            <MobileItem icon={<Package className="w-4 h-4" />} label="물품 목록" onClick={() => go("/")} />
            {user ? (
              <>
                <MobileItem icon={<User className="w-4 h-4" />} label="내 나눔" onClick={() => go("/mypage")} />
                <MobileItem icon={<MessageSquare className="w-4 h-4" />} label="채팅" onClick={() => go("/chat")} />
                <button onClick={() => go("/register")} className="mt-2 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-amber text-white font-semibold hover:bg-amber-dark transition-colors">
                  <PlusCircle className="w-4 h-4" /> 물품 등록
                </button>
                <button onClick={logout} className="mt-1 inline-flex items-center gap-2 px-3 h-11 rounded-xl text-destructive hover:bg-muted transition-colors text-sm font-medium">
                  <LogOut className="w-4 h-4" /> 로그아웃
                </button>
              </>
            ) : (
              <>
                <MobileItem icon={<User className="w-4 h-4" />} label="로그인" onClick={() => go("/login")} />
                <button onClick={() => go("/signup")} className="mt-2 inline-flex items-center justify-center h-11 rounded-xl bg-amber text-white font-semibold hover:bg-amber-dark transition-colors">회원가입</button>
              </>
            )}
          </div>
        </div>
      )}

      {bellOpen && user && (
        <BellDropdown
          onClose={() => setBellOpen(false)}
          onOpenFood={(foodId) => { setBellOpen(false); router.push(`/foods/${foodId}`); }}
        />
      )}
    </header>
  );
}

function MobileItem({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 px-3 h-11 rounded-xl text-foreground hover:bg-muted transition-colors text-sm font-medium text-left">
      {icon} {label}
    </button>
  );
}

/* ============ Bell Dropdown — 받은 나눔 요청 집계 ============ */
function BellDropdown({ onClose, onOpenFood }) {
  const [received, setReceived] = useState(null); // null=loading
  const [error, setError] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        const tgt = e.target.closest("[aria-label='알림']");
        if (!tgt) onClose && onClose();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const foods = await fetchMyFoods();
      if (!foods.length) { setReceived([]); return; }
      const lists = await Promise.all(
        foods.map((f) =>
          API.requests.received(f.foodId)
            .then((rs) => (rs || [])
              .filter((r) => r.status === "REQUEST")
              .map((r) => ({ ...r, foodId: f.foodId, foodName: f.foodName })))
            .catch(() => [])
        )
      );
      setReceived(lists.flat());
    } catch (e) {
      setError(e);
      setReceived([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handle = (foodId, requestId, kind) => {
    const fn = kind === "approve" ? API.requests.approve : API.requests.reject;
    fn(foodId, requestId).catch(() => {});
    setReceived((prev) => (prev || []).filter((r) => r.requestFoodId !== requestId));
  };

  const newCount = (received || []).length;

  return (
    <>
      <div className="fixed inset-0 bg-foreground/15 z-[80]" onClick={onClose} />
      <div
        ref={ref}
        className="absolute top-[68px] right-4 md:right-8 left-4 md:left-auto md:w-[380px] max-h-[calc(100vh-100px)] bg-card rounded-2xl border border-border shadow-warm-lg z-[90] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold flex items-center gap-2">
            받은 요청
            {newCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-destructive text-white text-[11px] font-bold">{newCount}</span>}
          </h3>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-2 overflow-y-auto flex-1 min-h-[120px]">
          {received === null ? (
            <div className="grid place-items-center py-12"><Spinner size={24} /></div>
          ) : error ? (
            <div className="py-14 text-center text-muted-foreground text-sm">알림을 불러오지 못했어요</div>
          ) : received.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground text-sm">받은 요청이 없어요</div>
          ) : (
            received.map((r) => (
              <div key={r.requestFoodId} className="rounded-xl border border-amber/30 bg-amber/5 p-3 mb-1.5">
                <div className="flex gap-2.5 items-start">
                  <Avatar name={r.requesterNickName || "?"} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm"><b className="font-bold">{r.requesterNickName || "이웃"}</b></div>
                    <div className="text-xs text-foreground/70 mt-0.5 cursor-pointer" onClick={() => onOpenFood(r.foodId)}>
                      <b className="font-semibold">{r.foodName}</b>에 나눔 요청 →
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2.5">
                  <button className="flex-1 h-8 rounded-lg border border-border text-sm font-medium hover:bg-muted" onClick={() => handle(r.foodId, r.requestFoodId, "reject")}>거절</button>
                  <button className="flex-[1.4] h-8 rounded-lg bg-amber text-white text-sm font-semibold hover:bg-amber-dark" onClick={() => handle(r.foodId, r.requestFoodId, "approve")}>수락</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

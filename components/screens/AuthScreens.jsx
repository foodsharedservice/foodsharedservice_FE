"use client";

/* AuthScreens.jsx — D-00 로그인 / D-07 회원가입
   실제 API 인증 기반. 성공해야 화면이 진행되고, 실패 시 에러를 표시한다. */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Photo, FormError } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import AddressSearch from "@/components/AddressSearch";
import API from "@/lib/api";

/* ============ 공유 스타일 토큰 ============ */
const INPUT_BASE =
  "w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber transition";
const BTN_PRIMARY =
  "w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-amber text-white font-semibold shadow-warm hover:bg-amber-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_GHOST =
  "inline-flex items-center justify-center gap-1.5 h-12 px-5 rounded-full bg-card border border-border text-foreground/80 font-medium hover:border-amber hover:text-amber transition-colors";
const BTN_SIDE =
  "inline-flex items-center justify-center gap-1.5 h-12 px-4 whitespace-nowrap rounded-full bg-card border border-border text-foreground/80 font-medium hover:border-amber hover:text-amber transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const LABEL = "block text-sm font-semibold text-foreground mb-2";
const HINT = "font-normal text-muted-foreground text-xs";

/* ============ shared brand panel ============ */
function AuthBrandPane() {
  return (
    <div className="relative overflow-hidden bg-primary text-white p-8 sm:p-12 flex flex-col min-h-[180px] lg:min-h-screen">
      {/* amber radial accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, color-mix(in oklch, var(--color-amber) 35%, transparent), transparent 55%)",
        }}
      />
      <div className="relative z-10 flex flex-col flex-1">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-amber text-white grid place-items-center shadow-warm">
            <Icon.Check />
          </span>
          <span className="text-lg font-bold tracking-tight">나눔마켓</span>
        </div>

        <div className="mt-auto pt-8 lg:pt-0 lg:my-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight">
            남은 음식의<br />
            <em className="text-amber-light not-italic">새 주인을 찾아드려요</em>
          </h2>
          <p className="mt-4 max-w-sm text-white/75 leading-relaxed hidden sm:block">
            미개봉 가공식품을 우리 동네 이웃과 나누는 따뜻한 거래. 소비기한은 AI가 직접 읽어 확인해요.
          </p>

          <div className="mt-8 gap-4 hidden sm:flex" aria-hidden="true">
            <div className="w-40 bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/15">
              <Photo label="" emoji="🥫" />
              <div className="flex items-center justify-between px-1 pt-2 text-xs text-white/85">
                <span>참치캔 6개</span><span className="font-semibold text-amber-light">D-12</span>
              </div>
            </div>
            <div className="w-40 bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/15">
              <Photo label="" emoji="🍪" />
              <div className="flex items-center justify-between px-1 pt-2 text-xs text-white/85">
                <span>초코파이</span><span className="font-semibold text-amber-light">2/4</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ D-00 LOGIN ============ */
export function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      // POST /auth/login { email, password } → { memberId, nickName }
      const data = await API.auth.login(email, pw);
      setUser(data || { nickName: email });
      router.push("/");
    } catch (e) {
      setError(e.code === "LOGIN_FAILED" ? "이메일 또는 비밀번호가 일치하지 않아요." : (e.message || "로그인에 실패했어요."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <AuthBrandPane />
      <div className="flex items-center justify-center p-6 sm:p-10 bg-background overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="text-xs font-semibold tracking-widest uppercase text-amber">WELCOME BACK</div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">로그인</h1>
          <p className="mt-2 text-muted-foreground">이메일과 비밀번호로 로그인하세요.</p>

          <div className="mt-8">
            <label className={LABEL}>이메일</label>
            <input className={INPUT_BASE} type="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="mt-5">
            <label className={LABEL}>비밀번호</label>
            <input className={INPUT_BASE} type="password" placeholder="••••••••••"
              value={pw} onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>

          <FormError>{error}</FormError>

          <div className="mt-4 flex items-center justify-end gap-4 text-sm text-muted-foreground">
            <span className="hover:text-primary transition-colors cursor-pointer">이메일 찾기</span>
            <span className="hover:text-primary transition-colors cursor-pointer">비밀번호 찾기</span>
          </div>

          <div className="mt-6">
            <button className={BTN_PRIMARY} onClick={submit} disabled={busy || !email || !pw}>
              {busy ? "로그인 중…" : "로그인"}
            </button>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground text-xs my-5">
            <span className="flex-1 h-px bg-border" />
            또는
            <span className="flex-1 h-px bg-border" />
          </div>

          <button className={`${BTN_GHOST} w-full`} onClick={() => router.push("/signup")}>회원 가입</button>

          <div className="mt-6 text-center text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => router.push("/")}>
            비회원으로 둘러보기 →
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ D-07 SIGNUP ============ */
export function SignupScreen() {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [nickState, setNickState] = useState(null); // null | "ok" | "dup"
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [emailToken, setEmailToken] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [pw, setPw] = useState("");
  const [road, setRoad] = useState("");
  const [detailAddr, setDetailAddr] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const detailRef = useRef(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Daum 우편번호 검색 완료 → 도로명 주소 자동 입력 후 상세주소로 포커스
  const handleAddress = useCallback((data) => {
    const building = data.buildingName && data.buildingName !== "N" ? ` (${data.buildingName})` : "";
    const road = data.roadAddress || data.autoRoadAddress || data.jibunAddress || "";
    setRoad(road + building);
    setTimeout(() => detailRef.current && detailRef.current.focus(), 50);
  }, []);

  useEffect(() => {
    if (!codeSent || verified || seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [codeSent, verified, seconds]);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const checkNick = async () => {
    setError(null);
    try {
      const d = await API.members.checkNickname(nick); // { available }
      setNickState(d && d.available ? "ok" : "dup");
    } catch (e) {
      setNickState(null);
      setError(e.message || "닉네임 확인에 실패했어요.");
    }
  };

  const sendCode = async () => {
    setError(null);
    try {
      const d = await API.auth.sendEmailCode(email); // { expiresIn }
      setCodeSent(true);
      setVerified(false);
      setSeconds((d && d.expiresIn) || 300);
    } catch (e) {
      setError(e.code === "EMAIL_DUPLICATED" ? "이미 가입된 이메일이에요." : (e.message || "코드 발송에 실패했어요."));
    }
  };

  const verifyCode = async () => {
    setError(null);
    try {
      const d = await API.auth.verifyEmailCode(email, code); // { verified, emailVerifyToken }
      if (d && d.verified) {
        setVerified(true);
        setEmailToken(d.emailVerifyToken || null);
      } else {
        setError("인증 코드가 일치하지 않아요.");
      }
    } catch (e) {
      const map = { CODE_MISMATCH: "인증 코드가 일치하지 않아요.", CODE_EXPIRED: "코드가 만료됐어요. 재발송해주세요." };
      setError(map[e.code] || e.message || "인증에 실패했어요.");
    }
  };

  // 비밀번호 규칙: 8-20자 + 영문 대소문자 + 특수문자
  const pwMet = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,20}$/.test(pw);
  const canSubmit = nickState === "ok" && verified && pwMet && road.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      // POST /members { email, emailVerifyToken, password, nickName, address } → { memberId }
      await API.members.signup({
        email,
        emailVerifyToken: emailToken,
        password: pw,
        nickName: nick,
        address: { roadAddress: road, detailAddress: detailAddr },
      });
      router.push("/login");
    } catch (e) {
      const map = {
        EMAIL_DUPLICATED: "이미 사용 중인 이메일이에요.",
        NICKNAME_DUPLICATED: "이미 사용 중인 닉네임이에요.",
        PASSWORD_POLICY_VIOLATION: "비밀번호 정책을 확인해주세요.",
        EMAIL_NOT_VERIFIED: "이메일 인증을 먼저 완료해주세요.",
      };
      setError(map[e.code] || e.message || "회원가입에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <AuthBrandPane />
      <div className="flex items-center justify-center p-6 sm:p-10 bg-background overflow-y-auto">
        <div className="w-full max-w-lg">
          <div className="text-xs font-semibold tracking-widest uppercase text-amber">CREATE ACCOUNT</div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">회원 가입</h1>
          <p className="mt-2 text-muted-foreground">필수 정보를 입력해주세요.</p>

          {/* 닉네임 */}
          <div className="mt-8">
            <label className={LABEL}>닉네임 <span className={HINT}>2–10자, 중복 불가</span></label>
            <div className="flex gap-2 items-stretch">
              <input
                className={`${INPUT_BASE} flex-1 ${nickState === "ok" ? "border-primary" : nickState === "dup" ? "border-destructive" : ""}`}
                placeholder="나눔러" value={nick}
                onChange={(e) => { setNick(e.target.value); setNickState(null); }} />
              <button className={BTN_SIDE} onClick={checkNick} disabled={nick.length < 2}>중복확인</button>
            </div>
            {nickState === "ok" && <div className="text-xs mt-1.5 flex items-center gap-1 text-primary"><Icon.Check /> 사용 가능한 닉네임이에요</div>}
            {nickState === "dup" && <div className="text-xs mt-1.5 flex items-center gap-1 text-destructive"><Icon.X /> 이미 사용 중이에요</div>}
          </div>

          {/* 이메일 */}
          <div className="mt-5">
            <label className={LABEL}>이메일</label>
            <div className="flex gap-2 items-stretch">
              <input className={`${INPUT_BASE} flex-1`} type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className={BTN_SIDE} onClick={sendCode} disabled={!email.includes("@")}>
                {codeSent ? "재발송" : "코드 발송"}
              </button>
            </div>
            {codeSent && <div className="text-xs mt-1.5 flex items-center gap-1 text-muted-foreground">이메일로 6자리 코드를 보냈어요</div>}
          </div>

          {/* 인증 코드 */}
          {codeSent && (
            <div className="mt-5">
              <label className={LABEL}>인증 코드</label>
              <div className="flex gap-2 items-stretch">
                <div className="relative flex-1">
                  <input
                    className={`${INPUT_BASE} tracking-[0.4em] text-center text-lg font-semibold font-mono`}
                    placeholder="______" maxLength={6}
                    value={code} disabled={verified}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))} />
                  {!verified && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">{mmss}</span>}
                </div>
                <button className={BTN_SIDE} onClick={verifyCode} disabled={code.length !== 6 || verified}>확인</button>
              </div>
              {verified && <div className="text-xs mt-1.5 flex items-center gap-1 text-primary"><Icon.Check /> 이메일 인증 완료</div>}
              {!verified && seconds === 0 && <div className="text-xs mt-1.5 flex items-center gap-1 text-destructive">코드가 만료됐어요. 재발송해주세요</div>}
            </div>
          )}

          {/* 비밀번호 */}
          <div className="mt-5">
            <label className={LABEL}>비밀번호</label>
            <input className={INPUT_BASE} type="password" placeholder="••••••••••"
              value={pw} onChange={(e) => setPw(e.target.value)} />
            <div className={`text-xs mt-1.5 flex items-center gap-1 ${pwMet ? "text-primary" : "text-muted-foreground"}`}>
              {pwMet ? <Icon.Check /> : <span className="w-[13px] text-center">·</span>}
              영문 대·소문자 + 특수문자 포함 8–20자
            </div>
          </div>

          {/* 주소 */}
          <div className="mt-5">
            <label className={LABEL}>주소</label>
            <div className="flex gap-2 items-stretch">
              <input className={`${INPUT_BASE} flex-1 cursor-pointer`} placeholder="도로명 주소 검색" value={road}
                readOnly onClick={() => setAddrOpen(true)} />
              <button className={BTN_SIDE} onClick={() => setAddrOpen(true)}>주소 검색</button>
            </div>
            <input ref={detailRef} className={`${INPUT_BASE} mt-2`} placeholder="상세주소 (선택)"
              value={detailAddr} onChange={(e) => setDetailAddr(e.target.value)} />
          </div>

          <FormError>{error}</FormError>

          <div className="mt-6">
            <button className={BTN_PRIMARY} onClick={submit} disabled={!canSubmit}>
              {busy ? "가입 중…" : canSubmit ? "가입 완료" : "필수 항목을 모두 입력해주세요"}
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => router.push("/login")}>
            이미 계정이 있으신가요? 로그인 →
          </div>
        </div>
      </div>

      <AddressSearch open={addrOpen} onClose={() => setAddrOpen(false)} onComplete={handleAddress} />
    </div>
  );
}

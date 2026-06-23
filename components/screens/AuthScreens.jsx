"use client";

/* AuthScreens.jsx — 로그인 / 회원가입 (Warm Market 센터 카드)
   실제 API 인증 기반. 성공해야 화면이 진행되고, 실패 시 에러를 표시한다. */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sprout, Eye, EyeOff, LogIn, Mail, ArrowRight, Check, X, CheckCircle2 } from "lucide-react";
import { FormError } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import AddressSearch from "@/components/AddressSearch";
import API from "@/lib/api";

const inputCls =
  "w-full h-11 px-3.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:border-amber focus:ring-2 focus:ring-amber/20 focus:outline-none transition-colors";
const labelCls = "block text-sm font-medium text-foreground mb-1.5";
const amberBtn =
  "w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-amber text-white font-semibold shadow-warm hover:bg-amber-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

function Brand() {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-7">
      <span className="w-10 h-10 rounded-xl bg-amber text-white grid place-items-center shadow-warm">
        <Sprout className="w-5 h-5" />
      </span>
      <span className="text-xl font-bold text-foreground">나눔마켓</span>
    </div>
  );
}

/* ============ 로그인 ============ */
export function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const data = await API.auth.login(email, pw); // { memberId, nickName }
      setUser(data || { nickName: email });
      router.push("/");
    } catch (e) {
      setError(e.code === "LOGIN_FAILED" ? "이메일 또는 비밀번호가 일치하지 않아요." : (e.message || "로그인에 실패했어요."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 pt-20 pb-10">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="bg-card rounded-3xl p-8 md:p-10 border border-border shadow-warm-lg">
          <Brand />
          <h1 className="text-2xl font-extrabold text-foreground text-center mb-1">로그인</h1>
          <p className="text-muted-foreground text-center text-sm mb-8">따뜻한 나눔에 함께해요</p>

          <div className="space-y-5">
            <div>
              <label className={labelCls} htmlFor="email">이메일</label>
              <input id="email" type="email" className={inputCls} placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="pw">비밀번호</label>
              <div className="relative">
                <input id="pw" type={showPw ? "text" : "password"} className={`${inputCls} pr-10`} placeholder="••••••••••"
                  value={pw} onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <FormError>{error}</FormError>

            <button className={amberBtn} onClick={submit} disabled={busy || !email || !pw}>
              {busy ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 로그인 중…</>
              ) : (
                <><LogIn className="w-4 h-4" /> 로그인</>
              )}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              아직 계정이 없으신가요?{" "}
              <button onClick={() => router.push("/signup")} className="text-amber font-semibold hover:text-amber-dark transition-colors">회원가입</button>
            </p>
          </div>
          <button onClick={() => router.push("/")} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-amber transition-colors">
            비회원으로 둘러보기 →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ 회원가입 ============ */
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
  const [showPw, setShowPw] = useState(false);
  const [road, setRoad] = useState("");
  const [detailAddr, setDetailAddr] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const detailRef = useRef(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleAddress = useCallback((data) => {
    const building = data.buildingName && data.buildingName !== "N" ? ` (${data.buildingName})` : "";
    const r = data.roadAddress || data.autoRoadAddress || data.jibunAddress || "";
    setRoad(r + building);
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
      const d = await API.members.checkNickname(nick);
      setNickState(d && d.available ? "ok" : "dup");
    } catch (e) {
      setNickState(null);
      setError(e.message || "닉네임 확인에 실패했어요.");
    }
  };

  const sendCode = async () => {
    setError(null);
    try {
      const d = await API.auth.sendEmailCode(email);
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
      const d = await API.auth.verifyEmailCode(email, code);
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
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 pt-20 pb-10">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="bg-card rounded-3xl p-8 md:p-10 border border-border shadow-warm-lg">
          <Brand />
          <h1 className="text-2xl font-extrabold text-foreground text-center mb-1">회원가입</h1>
          <p className="text-muted-foreground text-center text-sm mb-7">따뜻한 나눔 커뮤니티에 오신 것을 환영합니다</p>

          <div className="space-y-5">
            {/* 닉네임 */}
            <div>
              <label className={labelCls}>닉네임 <span className="text-muted-foreground font-normal text-xs">2–10자, 중복 불가</span></label>
              <div className="flex gap-2">
                <input className={`${inputCls} flex-1 ${nickState === "ok" ? "border-green-500" : nickState === "dup" ? "border-destructive" : ""}`}
                  placeholder="나눔러" value={nick}
                  onChange={(e) => { setNick(e.target.value); setNickState(null); }} />
                <button onClick={checkNick} disabled={nick.length < 2}
                  className="h-11 px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:border-amber hover:text-amber disabled:opacity-50 transition-colors whitespace-nowrap">중복확인</button>
              </div>
              {nickState === "ok" && <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> 사용 가능한 닉네임이에요</p>}
              {nickState === "dup" && <p className="mt-1.5 text-xs text-destructive flex items-center gap-1"><X className="w-3.5 h-3.5" /> 이미 사용 중이에요</p>}
            </div>

            {/* 이메일 */}
            <div>
              <label className={labelCls}>이메일</label>
              <div className="flex gap-2">
                <input className={`${inputCls} flex-1`} type="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                <button onClick={sendCode} disabled={!email.includes("@")}
                  className="h-11 px-4 rounded-xl bg-amber text-white text-sm font-semibold hover:bg-amber-dark disabled:opacity-50 transition-colors whitespace-nowrap inline-flex items-center gap-1.5">
                  <Mail className="w-4 h-4" /> {codeSent ? "재발송" : "코드 발송"}
                </button>
              </div>
              {codeSent && <p className="mt-1.5 text-xs text-muted-foreground">이메일로 6자리 코드를 보냈어요</p>}
            </div>

            {/* 인증 코드 */}
            {codeSent && (
              <div>
                <label className={labelCls}>인증 코드</label>
                <div className="flex gap-2 items-center">
                  <input className={`${inputCls} flex-1 tracking-[0.3em] text-center font-semibold`} placeholder="______" maxLength={6}
                    value={code} disabled={verified}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))} />
                  {!verified && <span className="text-xs font-semibold text-destructive tabular-nums">{mmss}</span>}
                  <button onClick={verifyCode} disabled={code.length !== 6 || verified}
                    className="h-11 px-4 rounded-xl border border-border text-sm font-medium hover:border-amber hover:text-amber disabled:opacity-50 transition-colors whitespace-nowrap">확인</button>
                </div>
                {verified && <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> 이메일 인증 완료</p>}
                {!verified && seconds === 0 && <p className="mt-1.5 text-xs text-destructive">코드가 만료됐어요. 재발송해주세요</p>}
              </div>
            )}

            {/* 비밀번호 */}
            <div>
              <label className={labelCls}>비밀번호</label>
              <div className="relative">
                <input className={`${inputCls} pr-10`} type={showPw ? "text" : "password"} placeholder="••••••••••"
                  value={pw} onChange={(e) => setPw(e.target.value)} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className={`mt-1.5 text-xs flex items-center gap-1 ${pwMet ? "text-green-600" : "text-muted-foreground"}`}>
                {pwMet ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 text-center">·</span>}
                영문 대·소문자 + 특수문자 포함 8–20자
              </p>
            </div>

            {/* 주소 */}
            <div>
              <label className={labelCls}>주소</label>
              <div className="flex gap-2">
                <input className={`${inputCls} flex-1 cursor-pointer`} placeholder="도로명 주소 검색" value={road}
                  readOnly onClick={() => setAddrOpen(true)} />
                <button onClick={() => setAddrOpen(true)}
                  className="h-11 px-4 rounded-xl border border-border text-sm font-medium hover:border-amber hover:text-amber transition-colors whitespace-nowrap">주소 검색</button>
              </div>
              <input ref={detailRef} className={`${inputCls} mt-2`} placeholder="상세주소 (선택)"
                value={detailAddr} onChange={(e) => setDetailAddr(e.target.value)} />
            </div>

            <FormError>{error}</FormError>

            <button className={amberBtn} onClick={submit} disabled={!canSubmit}>
              {busy ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 가입 중…</>
              ) : canSubmit ? (
                <><ArrowRight className="w-4 h-4" /> 가입 완료</>
              ) : "필수 항목을 모두 입력해주세요"}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <button onClick={() => router.push("/login")} className="text-amber font-semibold hover:text-amber-dark transition-colors">로그인</button>
            </p>
          </div>
        </div>
      </div>

      <AddressSearch open={addrOpen} onClose={() => setAddrOpen(false)} onComplete={handleAddress} />
    </div>
  );
}

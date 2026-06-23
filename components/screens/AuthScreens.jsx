"use client";

/* AuthScreens.jsx — 로그인 / 회원가입
   manus 참고 디자인(Login.tsx / Register.tsx) 그대로 포팅 + 실제 API 연결.
   - 로그인: 중앙 카드 (이메일/비밀번호)
   - 회원가입: 3단계 위저드 (이메일 인증 → 코드 확인 → 정보 입력) */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, Mail, ArrowRight, CheckCircle2, Search } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import AddressSearch from "@/components/AddressSearch";
import API from "@/lib/api";

const LOGO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663787031264/X9QCmjHK3KpAWyKFiSUYQq/logo-icon-6qpxFro6XBABtB6tshwecE.png";

const INPUT =
  "w-full h-11 rounded-xl border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber transition";

function CardLogo() {
  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl overflow-hidden shadow-warm bg-amber">
        <img src={LOGO} alt="나눔마켓" className="w-full h-full object-cover" />
      </div>
      <span className="text-xl font-bold text-foreground">나눔마켓</span>
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}

/* ============ 로그인 ============ */
export function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const data = await API.auth.login(email, pw);
      setUser(data || { nickName: email });
      router.push("/");
    } catch (err) {
      setError(err.code === "LOGIN_FAILED" ? "이메일 또는 비밀번호가 일치하지 않아요." : (err.message || "로그인에 실패했어요."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-fade-in-up">
        <div
          className="bg-card rounded-3xl p-8 md:p-10 border border-border"
          style={{ boxShadow: "0 8px 40px oklch(0.70 0.16 55 / 0.12)" }}
        >
          <CardLogo />
          <h1 className="text-2xl font-extrabold text-foreground text-center mb-1">로그인</h1>
          <p className="text-muted-foreground text-center text-sm mb-8">따뜻한 나눔에 함께해요</p>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">이메일</label>
              <input id="email" type="email" placeholder="user@example.com" className={INPUT}
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">비밀번호</label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} placeholder="비밀번호를 입력하세요"
                  className={`${INPUT} pr-10`} value={pw} onChange={(e) => setPw(e.target.value)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button type="submit" disabled={loading || !email || !pw}
              className="w-full h-12 inline-flex items-center justify-center gap-2 bg-amber text-white hover:bg-amber-dark shadow-warm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none">
              {loading ? <><Spinner /> 로그인 중...</> : <><LogIn className="w-4 h-4" /> 로그인</>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              아직 계정이 없으신가요?{" "}
              <button onClick={() => router.push("/signup")} className="text-amber font-semibold hover:text-amber-dark transition-colors">회원가입</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ 회원가입 (3단계) ============ */
export function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState("email"); // email | verify | register
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [emailVerifyToken, setEmailVerifyToken] = useState(null);
  const [seconds, setSeconds] = useState(0);

  const [nick, setNick] = useState("");
  const [nickState, setNickState] = useState(null); // ok | dup
  const [pw, setPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [road, setRoad] = useState("");
  const [detailAddr, setDetailAddr] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const detailRef = useRef(null);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step !== "verify" || seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [step, seconds]);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const handleAddress = useCallback((data) => {
    const building = data.buildingName && data.buildingName !== "N" ? ` (${data.buildingName})` : "";
    const r = data.roadAddress || data.autoRoadAddress || data.jibunAddress || "";
    setRoad(r + building);
    setTimeout(() => detailRef.current && detailRef.current.focus(), 50);
  }, []);

  const handleSendCode = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("올바른 이메일을 입력해주세요.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const d = await API.auth.sendEmailCode(email);
      setSeconds((d && d.expiresIn) || 300);
      setOtp("");
      setStep("verify");
    } catch (err) {
      setError(err.code === "EMAIL_DUPLICATED" ? "이미 가입된 이메일이에요." : (err.message || "코드 발송에 실패했어요."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) { setError("6자리 인증 코드를 입력해주세요."); return; }
    setError(null);
    setLoading(true);
    try {
      const d = await API.auth.verifyEmailCode(email, otp);
      if (d && d.verified) {
        setEmailVerifyToken(d.emailVerifyToken || null);
        setStep("register");
      } else {
        setError("인증 코드가 일치하지 않아요.");
      }
    } catch (err) {
      const map = { CODE_MISMATCH: "인증 코드가 일치하지 않아요.", CODE_EXPIRED: "코드가 만료됐어요. 재발송해주세요." };
      setError(map[err.code] || err.message || "인증에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  const checkNick = async () => {
    setError(null);
    try {
      const d = await API.members.checkNickname(nick);
      setNickState(d && d.available ? "ok" : "dup");
    } catch (err) {
      setNickState(null);
      setError(err.message || "닉네임 확인에 실패했어요.");
    }
  };

  const pwMet = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,20}$/.test(pw);

  const onSubmit = async (e) => {
    if (e) e.preventDefault();
    if (nickState !== "ok") { setError("닉네임 중복확인을 해주세요."); return; }
    if (!pwMet) { setError("비밀번호는 영문 대·소문자와 특수문자를 포함해 8–20자여야 해요."); return; }
    if (!road) { setError("주소를 입력해주세요."); return; }
    setError(null);
    setLoading(true);
    try {
      await API.members.signup({
        email,
        emailVerifyToken,
        password: pw,
        nickName: nick,
        address: { roadAddress: road, detailAddress: detailAddr },
      });
      router.push("/login");
    } catch (err) {
      const map = {
        EMAIL_DUPLICATED: "이미 사용 중인 이메일이에요.",
        NICKNAME_DUPLICATED: "이미 사용 중인 닉네임이에요.",
        PASSWORD_POLICY_VIOLATION: "비밀번호 정책을 확인해주세요.",
        EMAIL_NOT_VERIFIED: "이메일 인증을 먼저 완료해주세요.",
      };
      setError(map[err.code] || err.message || "회원가입에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { key: "email", label: "이메일 인증" },
    { key: "verify", label: "코드 확인" },
    { key: "register", label: "정보 입력" },
  ];
  const currentStepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 pt-16 pb-10">
      <div className="w-full max-w-md animate-fade-in-up">
        <div
          className="bg-card rounded-3xl p-8 md:p-10 border border-border"
          style={{ boxShadow: "0 8px 40px oklch(0.70 0.16 55 / 0.12)" }}
        >
          <CardLogo />
          <h1 className="text-2xl font-extrabold text-foreground text-center mb-1">회원가입</h1>
          <p className="text-muted-foreground text-center text-sm mb-6">따뜻한 나눔 커뮤니티에 오신 것을 환영합니다</p>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((s, idx) => (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 ${idx <= currentStepIdx ? "text-amber" : "text-muted-foreground"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    idx < currentStepIdx ? "bg-amber border-amber text-white" :
                    idx === currentStepIdx ? "border-amber text-amber" :
                    "border-border text-muted-foreground"
                  }`}>
                    {idx < currentStepIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{s.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-8 h-0.5 rounded-full ${idx < currentStepIdx ? "bg-amber" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Email */}
          {step === "email" && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1.5">
                <label htmlFor="su-email" className="text-sm font-medium text-foreground">이메일 주소</label>
                <input id="su-email" type="email" placeholder="user@example.com" className={INPUT}
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()} />
                <p className="text-xs text-muted-foreground">인증 코드가 이 이메일로 발송됩니다.</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button onClick={handleSendCode} disabled={loading}
                className="w-full h-12 inline-flex items-center justify-center gap-2 bg-amber text-white hover:bg-amber-dark shadow-warm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none">
                {loading ? <Spinner /> : <Mail className="w-4 h-4" />} 인증 코드 발송
              </button>
            </div>
          )}

          {/* Step 2: Verify */}
          {step === "verify" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-amber/10 rounded-xl p-4 text-center">
                <Mail className="w-8 h-8 text-amber mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">{email}</p>
                <p className="text-xs text-muted-foreground mt-1">위 이메일로 6자리 인증 코드를 발송했습니다.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">인증 코드</label>
                <input inputMode="numeric" maxLength={6} placeholder="------"
                  className={`${INPUT} text-center text-lg font-bold tracking-[0.5em]`}
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))} />
                <p className="text-xs text-muted-foreground text-center">유효시간: {mmss}</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button onClick={handleVerify} disabled={loading || otp.length !== 6}
                className="w-full h-12 inline-flex items-center justify-center gap-2 bg-amber text-white hover:bg-amber-dark shadow-warm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none">
                {loading ? <Spinner /> : <ArrowRight className="w-4 h-4" />} 인증 확인
              </button>
              <div className="flex items-center justify-center gap-4 text-sm">
                <button className="text-muted-foreground hover:text-amber transition-colors"
                  onClick={() => { setStep("email"); setOtp(""); setError(null); }}>이메일 다시 입력</button>
                <button className="text-muted-foreground hover:text-amber transition-colors" onClick={handleSendCode}>코드 재발송</button>
              </div>
            </div>
          )}

          {/* Step 3: Register form */}
          {step === "register" && (
            <form onSubmit={onSubmit} className="space-y-5 animate-fade-in">
              <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-medium">이메일 인증 완료: {email}</span>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="nick" className="text-sm font-medium text-foreground">닉네임 <span className="text-destructive">*</span></label>
                <div className="flex gap-2">
                  <input id="nick" placeholder="2~10자 닉네임"
                    className={`${INPUT} flex-1 ${nickState === "dup" ? "border-destructive" : nickState === "ok" ? "border-primary" : ""}`}
                    value={nick} onChange={(e) => { setNick(e.target.value); setNickState(null); }} />
                  <button type="button" onClick={checkNick} disabled={nick.length < 2}
                    className="h-11 px-4 whitespace-nowrap inline-flex items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50">중복확인</button>
                </div>
                {nickState === "ok" && <p className="text-xs text-primary flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> 사용 가능한 닉네임이에요</p>}
                {nickState === "dup" && <p className="text-xs text-destructive">이미 사용 중인 닉네임이에요</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="su-pw" className="text-sm font-medium text-foreground">비밀번호 <span className="text-destructive">*</span></label>
                <div className="relative">
                  <input id="su-pw" type={showPassword ? "text" : "password"} placeholder="8~20자, 영문 대소문자+특수문자 포함"
                    className={`${INPUT} pr-10 ${pw && !pwMet ? "border-destructive" : ""}`}
                    value={pw} onChange={(e) => setPw(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className={`text-xs flex items-center gap-1 ${pwMet ? "text-primary" : "text-muted-foreground"}`}>
                  {pwMet && <CheckCircle2 className="w-3.5 h-3.5" />} 영문 대·소문자 + 특수문자 포함 8–20자
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="road" className="text-sm font-medium text-foreground">도로명 주소 <span className="text-destructive">*</span></label>
                <div className="flex gap-2">
                  <input id="road" placeholder="주소 검색을 눌러주세요" readOnly value={road}
                    onClick={() => setAddrOpen(true)} className={`${INPUT} flex-1 cursor-pointer`} />
                  <button type="button" onClick={() => setAddrOpen(true)}
                    className="h-11 px-4 whitespace-nowrap inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    <Search className="w-3.5 h-3.5" /> 검색
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="detail" className="text-sm font-medium text-foreground">상세 주소 <span className="text-muted-foreground text-xs">(선택)</span></label>
                <input id="detail" ref={detailRef} placeholder="101동 202호" className={INPUT}
                  value={detailAddr} onChange={(e) => setDetailAddr(e.target.value)} />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full h-12 inline-flex items-center justify-center gap-2 bg-amber text-white hover:bg-amber-dark shadow-warm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none">
                {loading ? <Spinner /> : "가입 완료"}
              </button>
            </form>
          )}

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

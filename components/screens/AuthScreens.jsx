"use client";

/* AuthScreens.jsx — 로그인 / 회원가입(이메일 → 인증코드 → 기본정보 3단계)
   API: POST /auth/login, POST /auth/email/send, POST /auth/email/verify,
        GET /members/nickname/check, POST /members
   주소 입력은 기존 Daum 우편번호 서비스(AddressSearch) 그대로 사용 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { FormError } from "@/components/ui";
import AddressSearch from "@/components/AddressSearch";
import API from "@/lib/api";

/* ============ 로그인 ============ */
export function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !email || !pw) return;
    setError(null);
    setBusy(true);
    try {
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
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "0 24px" }}>
      <div style={{ height: 90 }} />
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ac)", letterSpacing: ".06em" }}>우리 동네 음식 나눔</div>
      <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, lineHeight: 1.15 }}>오늘나눔</div>
      <div style={{ fontSize: 15, color: "#6B6560", marginTop: 10, lineHeight: 1.5 }}>남는 음식, 이웃과 나눠요.<br />버리기 아까운 마음을 연결합니다.</div>
      <div style={{ height: 40 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" style={authInput} />
        <input value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} type="password" placeholder="비밀번호" style={authInput} />
      </div>
      <FormError>{error}</FormError>
      <button onClick={submit} disabled={busy || !email || !pw} style={{ width: "100%", marginTop: 20, padding: 16, borderRadius: 13, border: "none", background: "var(--ac)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", opacity: busy || !email || !pw ? 0.6 : 1 }}>{busy ? "로그인 중…" : "로그인"}</button>
      <div style={{ textAlign: "center", marginTop: 18, fontSize: 14, color: "#9A938C" }}>
        아직 회원이 아니신가요?{" "}
        <button onClick={() => router.push("/signup")} style={{ border: "none", background: "transparent", color: "var(--ac)", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>회원가입</button>
      </div>
    </div>
  );
}

/* ============ 회원가입 (3단계) ============ */
export function SignupScreen() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1); // 1 email · 2 code · 3 details

  // step1
  const [email, setEmail] = useState("");
  // step2
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(0);
  const [emailToken, setEmailToken] = useState(null);
  const codeRefs = useRef([]);
  // step3
  const [pw, setPw] = useState("");
  const [nick, setNick] = useState("");
  const [nickState, setNickState] = useState(null); // ok | dup
  const [road, setRoad] = useState("");
  const [detailAddr, setDetailAddr] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const detailRef = useRef(null);

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 2 || seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [step, seconds]);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const sendCode = async () => {
    if (!email.includes("@")) { setError("올바른 이메일을 입력해주세요."); return; }
    setError(null);
    setBusy(true);
    try {
      const d = await API.auth.sendEmailCode(email);
      setSeconds((d && d.expiresIn) || 300);
      setCode(["", "", "", "", "", ""]);
      setStep(2);
    } catch (e) {
      setError(e.code === "EMAIL_DUPLICATED" ? "이미 가입된 이메일이에요." : (e.message || "코드 발송에 실패했어요."));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    const c = code.join("");
    if (c.length !== 6) { setError("6자리 코드를 입력해주세요."); return; }
    setError(null);
    setBusy(true);
    try {
      const d = await API.auth.verifyEmailCode(email, c);
      if (d && d.verified) {
        setEmailToken(d.emailVerifyToken || null);
        setStep(3);
      } else {
        setError("인증 코드가 일치하지 않아요.");
      }
    } catch (e) {
      const map = { CODE_MISMATCH: "인증 코드가 일치하지 않아요.", CODE_EXPIRED: "코드가 만료됐어요. 재발송해주세요." };
      setError(map[e.code] || e.message || "인증에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

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

  const handleAddress = useCallback((data) => {
    const building = data.buildingName && data.buildingName !== "N" ? ` (${data.buildingName})` : "";
    const r = data.roadAddress || data.autoRoadAddress || data.jibunAddress || "";
    setRoad(r + building);
    setTimeout(() => detailRef.current && detailRef.current.focus(), 50);
  }, []);

  const pwMet = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,20}$/.test(pw);
  const canFinish = nickState === "ok" && pwMet && road.length > 0 && !busy;

  const finish = async () => {
    if (!canFinish) {
      setError(nickState !== "ok" ? "닉네임 중복확인을 해주세요" : !pwMet ? "비밀번호 조건을 확인해주세요" : road.length === 0 ? "주소를 입력해주세요" : null);
      return;
    }
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
      toast.show("회원가입이 완료되었어요!");
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

  const onBack = () => {
    setError(null);
    if (step === 1) router.push("/login");
    else setStep((s) => s - 1);
  };

  const setDigit = (i, v) => {
    const digit = v.replace(/[^0-9]/g, "").slice(-1);
    setCode((prev) => { const n = [...prev]; n[i] = digit; return n; });
    if (digit && i < 5) codeRefs.current[i + 1]?.focus();
  };
  const onCodeKey = (i, e) => {
    if (e.key === "Backspace" && !code[i] && i > 0) codeRefs.current[i - 1]?.focus();
  };

  return (
    <div style={{ minHeight: "100dvh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 8px" }}>
        <button onClick={onBack} aria-label="뒤로" style={{ width: 40, height: 40, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F1D1B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      </div>

      <div style={{ padding: "8px 24px" }}>
        <Progress step={step} />

        {step === 1 && (
          <>
            <div style={stepTitle}>이메일을 입력해 주세요</div>
            <div style={stepDesc}>인증 코드를 보내드릴게요. 유효시간은 5분이에요.</div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" style={{ ...authInput, marginTop: 28 }} />
            <FormError>{error}</FormError>
          </>
        )}

        {step === 2 && (
          <>
            <div style={stepTitle}>인증 코드를 입력해 주세요</div>
            <div style={stepDesc}>{email} 으로 보낸 6자리 코드 · 유효시간 <span style={{ color: "var(--ac)", fontWeight: 700 }}>{mmss}</span></div>
            <div style={{ display: "flex", gap: 8, marginTop: 28, justifyContent: "space-between" }}>
              {code.map((c, i) => (
                <input
                  key={i}
                  ref={(el) => (codeRefs.current[i] = el)}
                  value={c}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onCodeKey(i, e)}
                  inputMode="numeric"
                  maxLength={1}
                  style={{ width: 46, height: 56, textAlign: "center", fontSize: 22, fontWeight: 800, borderRadius: 12, border: `1.5px solid ${c ? "var(--ac)" : "#E5DFD8"}`, background: "#fff" }}
                />
              ))}
            </div>
            {seconds === 0 && <div style={{ marginTop: 12, fontSize: 13, color: "#9A938C" }}>코드가 만료됐어요. <button onClick={sendCode} style={linkBtn}>재발송</button></div>}
            <FormError>{error}</FormError>
          </>
        )}

        {step === 3 && (
          <>
            <div style={stepTitle}>기본 정보를 입력해 주세요</div>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={fieldLabel}>비밀번호</label>
                <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="••••••••" style={authInput} />
                <div style={{ fontSize: 12, color: pw && !pwMet ? "var(--danger)" : "#9A938C", marginTop: 6 }}>8~20자, 영문 대소문자와 특수문자를 포함해 주세요.</div>
              </div>
              <div>
                <label style={fieldLabel}>닉네임</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={nick} onChange={(e) => { setNick(e.target.value); setNickState(null); }} placeholder="나눔이" style={{ ...authInput, flex: 1 }} />
                  <button onClick={checkNick} disabled={nick.length < 2} style={{ padding: "0 16px", borderRadius: 12, border: "1.5px solid #E5DFD8", background: "#fff", color: "#6B6560", fontWeight: 700, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}>중복확인</button>
                </div>
                {nickState === "ok" && <div style={{ fontSize: 12.5, color: "#2E9E5B", marginTop: 6, fontWeight: 700 }}>사용 가능한 닉네임이에요</div>}
                {nickState === "dup" && <div style={{ fontSize: 12.5, color: "var(--danger)", marginTop: 6, fontWeight: 700 }}>이미 사용 중이에요</div>}
              </div>
              <div>
                <label style={fieldLabel}>주소</label>
                <input value={road} readOnly onClick={() => setAddrOpen(true)} placeholder="도로명 주소 검색" style={{ ...authInput, cursor: "pointer" }} />
                <input ref={detailRef} value={detailAddr} onChange={(e) => setDetailAddr(e.target.value)} placeholder="상세주소 (선택)" style={{ ...authInput, marginTop: 8 }} />
              </div>
            </div>
            <FormError>{error}</FormError>
          </>
        )}
      </div>

      <div style={{ height: 96 }} />
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#FBFAF8", padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", zIndex: 40 }}>
        {step === 1 && <button onClick={sendCode} disabled={busy} style={ctaBtn}>{busy ? "발송 중…" : "인증 코드 발송"}</button>}
        {step === 2 && <button onClick={verifyCode} disabled={busy} style={ctaBtn}>{busy ? "확인 중…" : "확인"}</button>}
        {step === 3 && <button onClick={finish} disabled={busy} style={ctaBtn}>{busy ? "가입 중…" : "가입 완료"}</button>}
      </div>

      <AddressSearch open={addrOpen} onClose={() => setAddrOpen(false)} onComplete={handleAddress} />
    </div>
  );
}

function Progress({ step }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      {[1, 2, 3].map((s) => (
        <span key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? "var(--ac)" : "#EBE5DD" }} />
      ))}
    </div>
  );
}

const authInput = { width: "100%", padding: "15px 16px", borderRadius: 13, border: "1.5px solid #E5DFD8", background: "#fff", fontSize: 15, color: "#1F1D1B" };
const stepTitle = { fontSize: 24, fontWeight: 800, lineHeight: 1.3 };
const stepDesc = { fontSize: 14, color: "#6B6560", marginTop: 8 };
const fieldLabel = { fontSize: 13.5, fontWeight: 700, color: "#37332E", display: "block", marginBottom: 7 };
const ctaBtn = { width: "100%", padding: 16, borderRadius: 13, border: "none", background: "var(--ac)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" };
const linkBtn = { border: "none", background: "transparent", color: "var(--ac)", fontWeight: 700, cursor: "pointer", fontSize: 13 };

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

/* ============ shared brand panel ============ */
function AuthBrandPane() {
  return (
    <div className="auth-brandpane">
      <div className="logo">냠냠</div>
      <div className="auth-tagline">
        오늘도 한 끼,<br />
        <em>이웃과 나눕니다</em>
      </div>
      <div className="auth-sub">
        미개봉 가공식품을 우리 동네 이웃과 나누는 따뜻한 거래. 소비기한은 AI가 직접 읽어 확인해요.
      </div>
      <div className="auth-pane-cards" aria-hidden="true">
        <div className="auth-pane-card">
          <Photo label="" emoji="🥫" />
          <div className="auth-pane-card-meta"><span>참치캔 6개</span><span>D-12</span></div>
        </div>
        <div className="auth-pane-card">
          <Photo label="" emoji="🍪" />
          <div className="auth-pane-card-meta"><span>초코파이</span><span>2/4</span></div>
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
    <div className="auth">
      <AuthBrandPane />
      <div className="auth-formpane">
        <div className="auth-card">
          <div className="eyebrow auth-eyebrow">WELCOME BACK</div>
          <h1 className="auth-title">로그인</h1>
          <p className="auth-desc">이메일과 비밀번호로 로그인하세요.</p>

          <div className="auth-field">
            <div className="label">이메일</div>
            <input className="field-input" type="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="auth-field">
            <div className="label">비밀번호</div>
            <input className="field-input" type="password" placeholder="••••••••••"
              value={pw} onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>

          <FormError>{error}</FormError>

          <div className="auth-links">
            <span>이메일 찾기</span>
            <span>비밀번호 찾기</span>
          </div>

          <button className="btn primary lg" style={{ width: "100%" }} onClick={submit} disabled={busy || !email || !pw}>
            {busy ? "로그인 중…" : "로그인"}
          </button>

          <div className="auth-divider">또는</div>

          <button className="btn ghost lg" style={{ width: "100%" }} onClick={() => router.push("/signup")}>회원 가입</button>

          <div className="auth-guest" onClick={() => router.push("/")}>비회원으로 둘러보기 →</div>
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
    <div className="auth">
      <AuthBrandPane />
      <div className="auth-formpane">
        <div className="auth-card wide">
          <div className="eyebrow auth-eyebrow">CREATE ACCOUNT</div>
          <h1 className="auth-title">회원 가입</h1>
          <p className="auth-desc">필수 정보를 입력해주세요.</p>

          {/* 닉네임 */}
          <div className="auth-field">
            <div className="label">닉네임 <span className="hint">2–10자, 중복 불가</span></div>
            <div className="verify-row">
              <input className={`field-input ${nickState === "ok" ? "is-ok" : nickState === "dup" ? "is-err" : ""}`}
                placeholder="나눔러" value={nick}
                onChange={(e) => { setNick(e.target.value); setNickState(null); }} />
              <button className="btn ghost" onClick={checkNick} disabled={nick.length < 2}>중복확인</button>
            </div>
            {nickState === "ok" && <div className="field-state ok"><Icon.Check /> 사용 가능한 닉네임이에요</div>}
            {nickState === "dup" && <div className="field-state err"><Icon.X /> 이미 사용 중이에요</div>}
          </div>

          {/* 이메일 */}
          <div className="auth-field">
            <div className="label">이메일</div>
            <div className="verify-row">
              <input className="field-input" type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn primary" onClick={sendCode} disabled={!email.includes("@")}>
                {codeSent ? "재발송" : "코드 발송"}
              </button>
            </div>
            {codeSent && <div className="field-state muted">이메일로 6자리 코드를 보냈어요</div>}
          </div>

          {/* 인증 코드 */}
          {codeSent && (
            <div className="auth-field">
              <div className="label">인증 코드</div>
              <div className="verify-row">
                <input className="field-input code-input" placeholder="______" maxLength={6}
                  value={code} disabled={verified}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))} />
                {!verified && <span className="field-suffix">{mmss}</span>}
                <button className="btn ghost" onClick={verifyCode} disabled={code.length !== 6 || verified}>확인</button>
              </div>
              {verified && <div className="field-state ok"><Icon.Check /> 이메일 인증 완료</div>}
              {!verified && seconds === 0 && <div className="field-state err">코드가 만료됐어요. 재발송해주세요</div>}
            </div>
          )}

          {/* 비밀번호 */}
          <div className="auth-field">
            <div className="label">비밀번호</div>
            <input className="field-input" type="password" placeholder="••••••••••"
              value={pw} onChange={(e) => setPw(e.target.value)} />
            <div className={`auth-rule ${pwMet ? "met" : ""}`}>
              {pwMet ? <Icon.Check /> : <span style={{ width: 13, textAlign: "center" }}>·</span>}
              영문 대·소문자 + 특수문자 포함 8–20자
            </div>
          </div>

          {/* 주소 */}
          <div className="auth-field">
            <div className="label">주소</div>
            <div className="verify-row">
              <input className="field-input" placeholder="도로명 주소 검색" value={road}
                readOnly onClick={() => setAddrOpen(true)} style={{ cursor: "pointer" }} />
              <button className="btn ghost" onClick={() => setAddrOpen(true)}>주소 검색</button>
            </div>
            <input ref={detailRef} className="field-input" placeholder="상세주소 (선택)" style={{ marginTop: 8 }}
              value={detailAddr} onChange={(e) => setDetailAddr(e.target.value)} />
          </div>

          <FormError>{error}</FormError>

          <button className="btn primary lg" style={{ width: "100%", marginTop: 6 }} onClick={submit} disabled={!canSubmit}>
            {busy ? "가입 중…" : canSubmit ? "가입 완료" : "필수 항목을 모두 입력해주세요"}
          </button>

          <div className="auth-guest" onClick={() => router.push("/login")}>이미 계정이 있으신가요? 로그인 →</div>
        </div>
      </div>

      <AddressSearch open={addrOpen} onClose={() => setAddrOpen(false)} onComplete={handleAddress} />
    </div>
  );
}

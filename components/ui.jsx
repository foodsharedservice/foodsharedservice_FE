"use client";

/* components/ui.jsx — 모바일 디자인 공용 UI 아톰 */

import { useState } from "react";
import { statusMeta, reqMeta, tileColors, shortLabel, initialOf } from "@/lib/foodUi";

/* ============ Thumb ============
   실제 이미지(src)가 있으면 <img>, 없으면 이름 기반 색상 placeholder 타일.
   size: 정사각 px / 또는 style 로 직접 제어. radius/fontSize 조절 가능. */
export function Thumb({ src, name = "", radius = 14, fontSize = 12, style, className = "" }) {
  const [broken, setBroken] = useState(false);
  const { bg, fg } = tileColors(name);
  const showImg = src && !broken;
  return (
    <div
      className={className}
      style={{
        background: showImg ? "#EFEAE3" : bg,
        color: fg,
        borderRadius: radius,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 800,
        letterSpacing: "0.04em",
        fontFamily: "var(--font-mono)",
        ...style,
      }}
    >
      {showImg ? (
        <img
          src={src}
          alt={name || ""}
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        shortLabel(name)
      )}
    </div>
  );
}

/* ============ Avatar (이니셜 원형) ============ */
export function Avatar({ name = "?", size = 42, bg = "#E2F0E7", fg = "#4E9970" }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: bg, color: fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: Math.round(size * 0.4), flex: "none",
      }}
    >
      {initialOf(name)}
    </div>
  );
}

/* ============ 상태 배지 ============ */
export function StatusBadge({ status, style }) {
  const m = statusMeta(status);
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 7, background: m.bg, color: m.fg, whiteSpace: "nowrap", ...style }}>
      {m.label}
    </span>
  );
}

/* ============ 요청 상태 배지 ============ */
export function ReqBadge({ status, style }) {
  const m = reqMeta(status);
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: m.bg, color: m.fg, whiteSpace: "nowrap", ...style }}>
      {m.label}
    </span>
  );
}

/* ============ Spinner ============ */
export function Spinner({ size = 28 }) {
  return (
    <div
      style={{
        width: size, height: size,
        border: `${Math.max(2, size / 12)}px solid #EAE2D6`,
        borderTopColor: "var(--ac)",
        borderRadius: "50%",
        animation: "spin .8s linear infinite",
      }}
    />
  );
}

/* ============ 상태 박스 (로딩 / 에러 / 빈 상태) ============ */
export function StateBox({ kind = "loading", title, sub, onRetry, style }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 12, padding: "72px 20px", textAlign: "center", color: "var(--ink-4)", ...style,
      }}
    >
      {kind === "loading" ? (
        <Spinner size={32} />
      ) : (
        <div style={{ fontSize: 34, lineHeight: 1 }}>{kind === "error" ? "⚠️" : "🍃"}</div>
      )}
      {title && <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-2)" }}>{title}</div>}
      {sub && <div style={{ fontSize: 12.5, color: "var(--ink-4)", maxWidth: 320, lineHeight: 1.6 }}>{sub}</div>}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ marginTop: 4, padding: "9px 16px", borderRadius: 10, border: "1.5px solid var(--line-2)", background: "#fff", color: "var(--ink-2)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

/* ============ 인라인 폼 에러 ============ */
export function FormError({ children }) {
  if (!children) return null;
  return (
    <div
      style={{
        marginTop: 12, padding: "11px 13px",
        background: "#FBE9E4", border: "1px solid #F3CFC6",
        borderRadius: 10, color: "var(--danger)", fontSize: 13, lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

/* ============ 화면 상단 헤더 (뒤로가기 + 타이틀) ============ */
export function ScreenHeader({ title, onBack, right }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "12px 8px", position: "sticky", top: 0, zIndex: 20,
        background: "rgba(251,250,248,.92)", backdropFilter: "blur(10px)",
      }}
    >
      {onBack && (
        <button onClick={onBack} aria-label="뒤로" style={{ width: 40, height: 40, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F1D1B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      )}
      <div style={{ fontSize: 18, fontWeight: 800, flex: 1, paddingLeft: onBack ? 0 : 10 }}>{title}</div>
      {right}
    </div>
  );
}

/* ============ 하단 고정 액션 바 ============ */
export function BottomBar({ children, plain = false }) {
  return (
    <div
      style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, zIndex: 40,
        background: plain ? "transparent" : "#fff",
        borderTop: plain ? "none" : "1px solid #EEE9E3",
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
      }}
    >
      {children}
    </div>
  );
}

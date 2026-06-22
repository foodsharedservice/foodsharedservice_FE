"use client";

/* components/ui.jsx — shared UI atoms */

import { useState } from "react";

/* ============ Status Badge ============ */
export function StatusBadge({ status, solid = false }) {
  const map = {
    IN_PROGRESS: { cls: "progress", label: "진행중" },
    COMPLETED: { cls: "done", label: "완료" },
    EXPIRED: { cls: "expired", label: "만료" },
    INCOMPLETE: { cls: "incomplete", label: "미완료" },
  };
  const s = map[status] || map.IN_PROGRESS;
  return <span className={`badge ${solid ? "solid " : ""}${s.cls}`}>{s.label}</span>;
}

/* ============ Photo ============
   src(실제 이미지 URL)가 있으면 <img>를, 없으면 placeholder를 렌더링한다.
   이미지 로드 실패 시 placeholder로 폴백. */
export function Photo({ label, ratio = "4/3", className = "", style, emoji, src }) {
  const [broken, setBroken] = useState(false);
  const cls = ratio === "4/3" ? "ph r4-3" : ratio === "1/1" ? "ph sq" : "ph";
  const showImg = src && !broken;
  return (
    <div
      className={`${cls}${emoji && !showImg ? " with-emoji" : ""} ${className}`}
      style={style}
      data-emoji={emoji}
    >
      {showImg ? (
        <img
          src={src}
          alt={label || ""}
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : label ? (
        <div className="ph-label">{label}</div>
      ) : null}
    </div>
  );
}

/* ============ Avatar ============ */
export function Avatar({ name = "?", size = 36 }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initial}
    </div>
  );
}

/* ============ Capacity Bar ============ */
export function CapacityBar({ approved, total }) {
  const cells = Array.from({ length: total }, (_, i) => i < approved);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {cells.map((on, i) => (
          <div
            key={i}
            style={{ width: 18, height: 6, borderRadius: 3, background: on ? "var(--primary)" : "var(--line)" }}
          />
        ))}
      </div>
      <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: "var(--font-en)" }}>{approved}</span>
        <span style={{ color: "var(--ink-4)" }}> / {total}명</span>
      </span>
    </div>
  );
}

/* ============ Spinner ============ */
export function Spinner({ size = 28 }) {
  return (
    <>
      <div
        className="ui-spin"
        style={{ width: size, height: size, borderWidth: Math.max(2, size / 12) }}
      />
      <style>{`
        .ui-spin {
          border-style: solid;
          border-color: var(--primary-100);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: uispin 0.8s linear infinite;
        }
        @keyframes uispin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

/* ============ State box (loading / error / empty) ============ */
export function StateBox({ kind = "loading", title, sub, onRetry, style }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "72px 20px",
        textAlign: "center",
        color: "var(--ink-4)",
        ...style,
      }}
    >
      {kind === "loading" ? (
        <Spinner size={32} />
      ) : (
        <div style={{ fontSize: 34, lineHeight: 1 }}>{kind === "error" ? "⚠️" : "🍃"}</div>
      )}
      {title && <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink-2)" }}>{title}</div>}
      {sub && <div style={{ fontSize: 12.5, color: "var(--ink-4)", maxWidth: 360, lineHeight: 1.6 }}>{sub}</div>}
      {onRetry && (
        <button className="btn ghost sm" onClick={onRetry} style={{ marginTop: 4 }}>
          다시 시도
        </button>
      )}
    </div>
  );
}

/* ============ Inline form error ============ */
export function FormError({ children }) {
  if (!children) return null;
  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        background: "#FBEAE5",
        border: "1px solid var(--danger-100)",
        borderRadius: 8,
        color: "var(--danger)",
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

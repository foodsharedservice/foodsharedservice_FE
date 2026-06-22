/* components/ui.jsx — shared UI atoms (StatusBadge, Photo, Avatar, CapacityBar) */

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

/* ============ Photo placeholder ============ */
export function Photo({ label, ratio = "4/3", className = "", style, emoji }) {
  const cls = ratio === "4/3" ? "ph r4-3" : ratio === "1/1" ? "ph sq" : "ph";
  return (
    <div
      className={`${cls}${emoji ? " with-emoji" : ""} ${className}`}
      style={style}
      data-emoji={emoji}
    >
      {label ? <div className="ph-label">{label}</div> : null}
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
            style={{
              width: 18,
              height: 6,
              borderRadius: 3,
              background: on ? "var(--primary)" : "var(--line)",
            }}
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

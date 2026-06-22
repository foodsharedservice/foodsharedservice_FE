"use client";

/* components/TabBar.jsx — 하단 탭바 (홈·채팅·등록·거래내역·마이)
   탭바는 최상위 탭 화면에서만 노출되고, 상세/등록/채팅방 등 push 화면에서는 숨긴다. */

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const TAB_ROUTES = ["/", "/chat", "/requests", "/mypage", "/mypage/foods"];

export default function TabBar() {
  const router = useRouter();
  const pathname = usePathname() || "/";

  // 탭바를 보일 화면만 허용 (그 외 push 화면은 숨김)
  if (!TAB_ROUTES.includes(pathname)) return null;

  const tabOf =
    pathname === "/" ? "home"
    : pathname.startsWith("/chat") ? "chat"
    : pathname.startsWith("/requests") ? "requests"
    : pathname.startsWith("/mypage") ? "mypage"
    : "";

  const col = (t) => (tabOf === t ? "var(--ac)" : "#B0A89F");

  return (
    <div
      style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, zIndex: 50, background: "#fff",
        borderTop: "1px solid #EEE9E3", display: "flex", alignItems: "flex-end",
        justifyContent: "space-around", padding: "8px 6px calc(8px + env(safe-area-inset-bottom))",
      }}
    >
      <TabBtn label="홈" color={col("home")} onClick={() => router.push("/")}>
        <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
      </TabBtn>
      <TabBtn label="채팅" color={col("chat")} onClick={() => router.push("/chat")}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </TabBtn>

      {/* 가운데 등록 FAB */}
      <button
        onClick={() => router.push("/register")}
        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
      >
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--ac)", display: "grid", placeItems: "center", marginTop: -16, boxShadow: "0 6px 16px rgba(31,168,92,.36)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9A938C" }}>등록</span>
      </button>

      <TabBtn label="거래내역" color={col("requests")} onClick={() => router.push("/requests")}>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </TabBtn>
      <TabBtn label="마이" color={col("mypage")} onClick={() => router.push("/mypage")}>
        <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
      </TabBtn>
    </div>
  );
}

function TabBtn({ label, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", background: "transparent", cursor: "pointer", padding: "4px 0" }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
    </button>
  );
}

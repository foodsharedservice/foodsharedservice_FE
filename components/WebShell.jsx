"use client";

/* components/WebShell.jsx — 반응형 웹 셸
   - 데스크톱(≥760px): 상단 네비게이션 바 표시, 하단 탭바 숨김
   - 모바일: 상단 네비 숨김, 하단 탭바(TabBar) 표시
   디자인 토큰/컴포넌트는 그대로 유지하고 레이아웃만 웹에 맞춘다. */

import { usePathname, useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";

const NAV = [
  ["/", "홈"],
  ["/chat", "채팅"],
  ["/requests", "거래내역"],
  ["/mypage", "마이"],
];

export default function WebShell({ children }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const isActive = (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="web-header">
        <div className="web-header-inner">
          <button className="web-logo" onClick={() => router.push("/")}>오늘나눔</button>
          <nav className="web-nav">
            {NAV.map(([href, label]) => (
              <button key={href} className={isActive(href) ? "active" : ""} onClick={() => router.push(href)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="web-actions">
            <button className="web-cta" onClick={() => router.push("/register")}>+ 나눔 등록</button>
          </div>
        </div>
      </header>

      {children}

      <TabBar />
    </>
  );
}

"use client";

/* 채팅 레이아웃 — 번개장터식 2단 구성
   왼쪽: 채팅 목록(항상 표시) · 오른쪽: 선택한 채팅방(또는 안내 문구)
   데스크톱은 좌/우 패널을 함께, 모바일은 URL에 따라 한 쪽만 표시한다. */

import { usePathname } from "next/navigation";
import { ChatListScreen } from "@/components/screens/ChatScreens";

export default function ChatLayout({ children }) {
  const pathname = usePathname();
  const inRoom = /^\/chat\/.+/.test(pathname || ""); // 방이 열려 있는지

  return (
    <div className="flex h-[calc(100vh-64px)] max-w-[1100px] w-full mx-auto">
      <aside
        className={`w-full md:w-[360px] md:flex-shrink-0 h-full overflow-y-auto md:border-r border-border ${
          inRoom ? "hidden md:block" : "block"
        }`}
      >
        <ChatListScreen />
      </aside>
      <section className={`flex-1 min-w-0 h-full ${inRoom ? "block" : "hidden md:block"}`}>
        {children}
      </section>
    </div>
  );
}

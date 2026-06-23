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
    <div className={`chat-shell ${inRoom ? "in-room" : ""}`}>
      <aside className="chat-pane-list">
        <ChatListScreen />
      </aside>
      <section className="chat-pane-room">{children}</section>

      <style>{`
        .chat-shell { display: flex; height: calc(100vh - 61px); max-width: 1100px; width: 100%; margin: 0 auto; }
        .chat-pane-list { width: 360px; flex-shrink: 0; height: 100%; overflow-y: auto; border-right: 1px solid var(--line); }
        .chat-pane-room { flex: 1; min-width: 0; height: 100%; }
        @media (max-width: 900px) {
          .chat-shell { max-width: none; height: calc(100vh - 57px); }
          .chat-pane-list { width: 100%; border-right: 0; }
          .chat-shell.in-room .chat-pane-list { display: none; }
          .chat-shell:not(.in-room) .chat-pane-room { display: none; }
        }
      `}</style>
    </div>
  );
}

"use client";

/* components/AppHeader.jsx — 상단 네비게이션 (번개장터 스타일)
   - 로고 / 검색 / 나눔하기 / 채팅(안읽음 배지) / 프로필
   - 채팅 안읽음 수: GET /members/me/chat/rooms 의 unreadCount 합산 */

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Avatar, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [q, setQ] = useState("");
  const [unread, setUnread] = useState(0);

  const isRegister = pathname?.startsWith("/register");
  const isMypage = pathname?.startsWith("/mypage");
  const isChat = pathname?.startsWith("/chat");

  const loadUnread = useCallback(async () => {
    if (!user) {
      setUnread(0);
      return;
    }
    try {
      const rooms = (await API.chat.myRooms()) || [];
      setUnread(rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0));
    } catch {
      setUnread(0);
    }
  }, [user]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread, pathname]);

  const submitSearch = (e) => {
    e.preventDefault();
    router.push(`/?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="app-header">
      <button className="logo" onClick={() => router.push("/")}>
        <span className="bolt">⚡</span> 나눔장터
      </button>

      <form className="search" onSubmit={submitSearch}>
        <Icon.Search />
        <input
          placeholder="어떤 물건을 찾으세요?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      <div className="actions">
        {loading ? (
          <Spinner size={18} />
        ) : user ? (
          <>
            <button
              className={`btn ${isRegister ? "primary" : "ghost"}`}
              onClick={() => router.push("/register")}
            >
              <Icon.Plus /> 나눔하기
            </button>
            <button
              className={`icobtn ${isChat ? "on" : ""}`}
              onClick={() => router.push("/chat")}
              aria-label="채팅"
            >
              <Icon.Chat />
              {unread > 0 && <span className="dot">{unread > 99 ? "99+" : unread}</span>}
            </button>
            <button
              className={`icobtn ${isMypage ? "on" : ""}`}
              onClick={() => router.push("/mypage")}
              aria-label="마이페이지"
            >
              <Avatar name={user.nickName || "?"} size={28} />
            </button>
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={() => router.push("/login")}>
              로그인
            </button>
            <button className="btn primary" onClick={() => router.push("/register")}>
              <Icon.Plus /> 나눔하기
            </button>
          </>
        )}
      </div>
    </header>
  );
}

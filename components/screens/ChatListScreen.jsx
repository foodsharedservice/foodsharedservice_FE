"use client";

/* ChatListScreen.jsx — 채팅 목록
   API: GET /members/me/chat/rooms  (조회 전용) */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Thumb, StateBox } from "@/components/ui";
import API from "@/lib/api";

/* 채팅방 응답 필드명이 환경마다 다를 수 있어 방어적으로 매핑한다. */
function normalizeRoom(r) {
  return {
    roomId: r.roomId ?? r.chatRoomId ?? r.id,
    foodName: r.foodName ?? r.food?.foodName ?? "",
    partner: r.partnerNickName ?? r.opponentNickName ?? r.otherNickName ?? r.partner ?? "이웃",
    last: r.lastMessage ?? r.lastMessageContent ?? r.last ?? "",
    at: (r.lastMessageAt ?? r.updatedAt ?? "").toString().slice(11, 16),
    unread: r.unreadCount ?? r.unread ?? 0,
    thumbnailUrl: r.thumbnailUrl ?? r.food?.thumbnailUrl,
  };
}

export default function ChatListScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    API.chat.myRooms()
      .then((rs) => setRooms((rs || []).map(normalizeRoom)))
      .catch((e) => { setError(e); setRooms([]); });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    load();
  }, [authLoading, user, router, load]);

  if (authLoading || !user) return null;

  return (
    <div className="screen" style={{ minHeight: "100dvh" }}>
      <div style={{ padding: "16px 18px 12px", position: "sticky", top: 0, zIndex: 20, background: "rgba(251,250,248,.92)", backdropFilter: "blur(10px)" }}>
        <div style={{ fontSize: 21, fontWeight: 800 }}>채팅</div>
      </div>

      {rooms === null ? (
        <StateBox kind="loading" title="채팅방을 불러오는 중…" />
      ) : error ? (
        <StateBox kind="error" title="채팅을 불러오지 못했어요" sub={`(${error.code || error.status || error.message || "네트워크 오류"})`} onRetry={load} />
      ) : rooms.length === 0 ? (
        <StateBox kind="empty" title="아직 채팅이 없어요" sub="물품 상세에서 '채팅'으로 대화를 시작해보세요." />
      ) : (
        rooms.map((r) => (
          <button key={r.roomId} onClick={() => router.push(`/chat/${r.roomId}`)} style={{ display: "flex", gap: 13, width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid #F1ECE6", padding: "15px 18px", cursor: "pointer", alignItems: "center" }}>
            <Thumb src={r.thumbnailUrl} name={r.foodName || r.partner} radius={14} style={{ width: 54, height: 54, flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{r.partner}</span>
                {r.at && <span style={{ fontSize: 12, color: "#B6AFA7" }}>{r.at}</span>}
              </div>
              {r.foodName && <div style={{ fontSize: 11.5, color: "#9A938C", marginTop: 2 }}>{r.foodName}</div>}
              {r.last && <div style={{ fontSize: 13.5, color: "#6B6560", marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.last}</div>}
            </div>
            {r.unread > 0 && (
              <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "var(--ac)", color: "#fff", fontSize: 11.5, fontWeight: 800, display: "grid", placeItems: "center", flex: "none" }}>{r.unread}</span>
            )}
          </button>
        ))
      )}
      <div style={{ height: 96 }} />
    </div>
  );
}

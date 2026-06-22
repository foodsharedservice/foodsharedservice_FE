"use client";

/* ChatRoomScreen.jsx — 채팅방
   API: GET /chat/rooms/{roomId}/messages  (이전 메시지 조회 전용)
   ※ 명세에 '메시지 전송' 엔드포인트가 없어, 전송은 화면상(로컬)에서만 반영된다. */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { StateBox } from "@/components/ui";
import API from "@/lib/api";

function normalizeMsg(m, user) {
  const mine =
    m.mine === true ||
    (m.senderNickName && user && m.senderNickName === user.nickName) ||
    (m.senderMemberId != null && user && m.senderMemberId === user.memberId);
  return {
    text: m.content ?? m.message ?? m.text ?? "",
    mine: !!mine,
    at: (m.createdAt ?? m.sentAt ?? "").toString().slice(11, 16),
  };
}

export default function ChatRoomScreen({ roomId }) {
  const router = useRouter();
  const { user } = useAuth();
  const [meta, setMeta] = useState({ partner: "채팅", foodName: "" });
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  const load = useCallback(() => {
    setError(null);
    API.chat.history(roomId)
      .then((data) => {
        const arr = Array.isArray(data) ? data : (data && data.content) || (data && data.messages) || [];
        setMessages(arr.map((m) => normalizeMsg(m, user)));
      })
      .catch((e) => { setError(e); setMessages([]); });
    // 방 메타(상대 이름·물품명)는 채팅방 목록에서 보강
    API.chat.myRooms()
      .then((rs) => {
        const r = (rs || []).find((x) => String(x.roomId ?? x.chatRoomId ?? x.id) === String(roomId));
        if (r) setMeta({ partner: r.partnerNickName ?? r.opponentNickName ?? r.partner ?? "채팅", foodName: r.foodName ?? r.food?.foodName ?? "" });
      })
      .catch(() => {});
  }, [roomId, user]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    // 명세에 전송 API가 없어 화면상에만 추가한다.
    setMessages((prev) => [...(prev || []), { text: t, mine: true, at: "" }]);
    setDraft("");
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "12px 8px", position: "sticky", top: 0, zIndex: 20, background: "rgba(251,250,248,.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid #F0ECE6" }}>
        <button onClick={() => router.back()} aria-label="뒤로" style={{ width: 40, height: 40, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F1D1B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{meta.partner}</div>
          {meta.foodName && <div style={{ fontSize: 11.5, color: "#9A938C" }}>{meta.foodName}</div>}
        </div>
      </div>

      {messages === null ? (
        <StateBox kind="loading" title="대화를 불러오는 중…" />
      ) : error ? (
        <StateBox kind="error" title="대화를 불러오지 못했어요" sub={`(${error.code || error.status || error.message || "네트워크 오류"})`} onRetry={load} />
      ) : (
        <div ref={scrollRef} style={{ padding: "18px 16px 90px", display: "flex", flexDirection: "column", gap: 10, minHeight: "calc(100dvh - 64px)", overflowY: "auto" }}>
          {messages.length === 0 && <div style={{ textAlign: "center", fontSize: 13, color: "#B6AFA7", marginTop: 20 }}>첫 메시지를 보내보세요</div>}
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.mine ? "flex-end" : "flex-start" }}>
              <div style={m.mine
                ? { maxWidth: "74%", padding: "10px 14px", borderRadius: "18px 18px 4px 18px", background: "var(--ac)", color: "#fff", fontSize: 14.5, lineHeight: 1.45, wordBreak: "break-word" }
                : { maxWidth: "74%", padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: "#F1ECE6", color: "#1F1D1B", fontSize: 14.5, lineHeight: 1.45, wordBreak: "break-word" }}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EEE9E3", padding: "10px 14px calc(10px + env(safe-area-inset-bottom))", display: "flex", gap: 9, alignItems: "center", zIndex: 40 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
          placeholder="메시지를 입력하세요"
          style={{ flex: 1, padding: "12px 16px", borderRadius: 999, border: "none", background: "#F1ECE6", fontSize: 15 }}
        />
        <button onClick={send} aria-label="전송" style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: "var(--ac)", display: "grid", placeItems: "center", cursor: "pointer", flex: "none" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
      </div>
    </div>
  );
}

"use client";

/* ChatScreens.jsx — 채팅 목록(D-channel) + 실시간 채팅방
   목록:   GET /members/me/chat/rooms
   방 입장: GET /chat/rooms/{roomId}/messages (cursor 페이지네이션, 최신순 → 화면은 과거→현재)
   실시간:  STOMP /ws  · SEND /pub/chat/rooms/{roomId} · SUBSCRIBE /user/queue/messages
   (발신자는 자신의 메시지를 소켓으로 다시 받지 않으므로 낙관적으로 화면에 추가) */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Avatar, StateBox, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { createChatSocket } from "@/lib/chatSocket";
import API from "@/lib/api";

function timeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${d.getHours() < 12 ? "오전" : "오후"} ${((d.getHours() + 11) % 12) + 1}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/* ============ 채팅 목록 ============ */
export function ChatListScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState(null); // null=loading
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    API.chat.myRooms()
      .then((rs) => { if (alive) setRooms(Array.isArray(rs) ? rs : []); })
      .catch((e) => { if (alive) { setError(e); setRooms([]); } });
    return () => { alive = false; };
  }, [authLoading, user, router]);

  if (authLoading || rooms === null) {
    return <div className="chat-list"><StateBox kind="loading" title="채팅 목록을 불러오는 중…" /></div>;
  }

  return (
    <div className="chat-list">
      <div className="chat-list-head">
        <div className="eyebrow" style={{ color: "var(--primary)" }}>CHAT</div>
        <h1>채팅</h1>
      </div>

      {error ? (
        <StateBox kind="error" title="채팅을 불러오지 못했어요" sub={`(${error.code || error.status || "네트워크 오류"})`} />
      ) : rooms.length === 0 ? (
        <StateBox kind="empty" title="아직 채팅이 없어요" sub="물품 상세에서 ‘채팅하기’로 등록자와 대화를 시작해보세요." />
      ) : (
        <div className="room-list">
          {rooms.map((r) => (
            <button className="room-item" key={r.roomId} onClick={() => router.push(`/chat/${r.roomId}`)}>
              <Avatar name={r.partnerNickName || "?"} size={48} />
              <div className="room-item-body">
                <div className="room-item-top">
                  <span className="room-partner">{r.partnerNickName || "상대"}</span>
                  <span className="room-time">{timeLabel(r.lastMessageAt)}</span>
                </div>
                <div className="room-item-food">{r.foodName}</div>
                <div className="room-item-last">{r.lastMessage || "대화를 시작해보세요"}</div>
              </div>
              {r.unreadCount > 0 && <span className="room-unread">{r.unreadCount}</span>}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .chat-list { max-width: 760px; margin: 0 auto; padding: 24px 20px 60px; }
        .chat-list-head { margin-bottom: 16px; }
        .chat-list-head h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-top: 2px; }
        .room-list { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--surface); }
        .room-item { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; padding: 16px 18px; border-bottom: 1px solid var(--line); background: var(--surface); transition: background 0.12s; }
        .room-item:last-child { border-bottom: 0; }
        .room-item:hover { background: var(--bg-2); }
        .room-item-body { flex: 1; min-width: 0; }
        .room-item-top { display: flex; align-items: baseline; gap: 8px; }
        .room-partner { font-weight: 700; font-size: 14.5px; }
        .room-time { margin-left: auto; font-size: 11px; color: var(--ink-4); font-family: var(--font-en); white-space: nowrap; }
        .room-item-food { font-size: 11.5px; color: var(--primary); font-weight: 600; margin-top: 2px; }
        .room-item-last { font-size: 13px; color: var(--ink-3); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .room-unread { background: var(--danger); color: #fff; font-size: 11px; font-weight: 700; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center; }
      `}</style>
    </div>
  );
}

/* ============ 실시간 채팅방 ============ */
export function ChatRoomScreen({ roomId }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState([]); // 과거→현재(오름차순)
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting");

  const sockRef = useRef(null);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const tempId = useRef(-1);

  const numericRoomId = Number(roomId);

  // 초기 히스토리 + 방 메타
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      API.chat.history(roomId, { size: 30 }),
      API.chat.myRooms().catch(() => []),
    ])
      .then(([hist, rooms]) => {
        if (!alive) return;
        const page = (hist && hist.messages) || [];
        setMessages([...page].reverse()); // 최신순 → 오름차순
        setCursor(hist && hist.nextCursor);
        setHasNext(!!(hist && hist.hasNext));
        const found = Array.isArray(rooms) ? rooms.find((r) => r.roomId === numericRoomId) : null;
        setRoom(found || null);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, roomId, numericRoomId, router]);

  // 첫 로딩 후 맨 아래로
  useEffect(() => {
    if (!loading && bottomRef.current) bottomRef.current.scrollIntoView({ block: "end" });
  }, [loading]);

  // STOMP 연결
  useEffect(() => {
    if (authLoading || !user) return;
    const sock = createChatSocket({
      onStatus: setStatus,
      onMessage: (payload) => {
        if (!payload || payload.roomId !== numericRoomId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.messageId === payload.messageId)) return prev;
          return [...prev, {
            messageId: payload.messageId,
            senderId: payload.senderId,
            senderNickName: payload.senderNickName,
            content: payload.content,
            mine: false,
            createdAt: payload.createdAt,
          }];
        });
        setTimeout(() => bottomRef.current && bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" }), 30);
      },
    });
    sock.activate();
    sockRef.current = sock;
    return () => { sock.deactivate(); sockRef.current = null; };
  }, [authLoading, user, numericRoomId]);

  const loadOlder = () => {
    if (loadingMore || !hasNext || cursor == null) return;
    setLoadingMore(true);
    const el = scrollRef.current;
    const prevHeight = el ? el.scrollHeight : 0;
    API.chat.history(roomId, { cursor, size: 30 })
      .then((hist) => {
        const older = ((hist && hist.messages) || []).reverse();
        setMessages((prev) => [...older, ...prev]);
        setCursor(hist && hist.nextCursor);
        setHasNext(!!(hist && hist.hasNext));
        setTimeout(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; }, 0);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const ok = sockRef.current && sockRef.current.send(numericRoomId, text);
    if (!ok) return; // 미연결 시 전송 보류
    // 낙관적 추가(발신자는 소켓 에코를 받지 않음)
    setMessages((prev) => [...prev, {
      messageId: tempId.current--, senderId: user.memberId, senderNickName: user.nickName,
      content: text, mine: true, createdAt: new Date().toISOString(),
    }]);
    setInput("");
    setTimeout(() => bottomRef.current && bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" }), 30);
  };

  if (authLoading || !user) return null;

  return (
    <div className="chat-room">
      <div className="chat-room-head">
        <button className="crumb-back" onClick={() => router.push("/chat")}><Icon.ChevronLeft /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cr-partner">{room ? (room.partnerNickName || "상대") : "채팅"}</div>
          {room && <div className="cr-food" onClick={() => router.push(`/foods/${room.foodId}`)}>{room.foodName} →</div>}
        </div>
        <span className={`cr-status ${status}`}>{status === "connected" ? "● 실시간" : status === "connecting" ? "연결 중" : "연결 끊김"}</span>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {loading ? (
          <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner size={28} /></div>
        ) : error ? (
          <StateBox kind="error" title="채팅을 불러오지 못했어요" sub={`(${error.code || error.status || "네트워크 오류"})`} />
        ) : (
          <>
            {hasNext && (
              <div className="load-older">
                <button className="btn ghost sm" onClick={loadOlder} disabled={loadingMore}>
                  {loadingMore ? "불러오는 중…" : "이전 메시지 더 보기"}
                </button>
              </div>
            )}
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 13, padding: "40px 0" }}>
                첫 메시지를 보내 대화를 시작해보세요 👋
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.messageId ?? i} className={`bubble-row ${m.mine ? "mine" : ""}`}>
                {!m.mine && <Avatar name={m.senderNickName || "?"} size={30} />}
                <div className="bubble-wrap">
                  {!m.mine && <div className="bubble-name">{m.senderNickName}</div>}
                  <div className="bubble">{m.content}</div>
                  <div className="bubble-time">{timeLabel(m.createdAt)}</div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }}
          placeholder={status === "connected" ? "메시지를 입력하세요" : "연결 중…"}
          disabled={loading}
        />
        <button className="btn primary" onClick={send} disabled={!input.trim() || status !== "connected"} aria-label="보내기">
          <Icon.Send />
        </button>
      </div>

      <style>{`
        .chat-room { display: flex; flex-direction: column; height: calc(100vh - 60px); max-width: 760px; margin: 0 auto; }
        .chat-room-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--surface); }
        .chat-room-head .crumb-back { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; color: var(--ink-2); }
        .chat-room-head .crumb-back:hover { background: var(--bg-2); }
        .cr-partner { font-weight: 700; font-size: 15px; }
        .cr-food { font-size: 11.5px; color: var(--primary); font-weight: 600; margin-top: 1px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cr-status { font-size: 11px; font-weight: 600; color: var(--ink-4); white-space: nowrap; }
        .cr-status.connected { color: var(--primary); }
        .cr-status.error, .cr-status.disconnected { color: var(--danger); }
        .chat-scroll { flex: 1; overflow-y: auto; padding: 16px; background: var(--bg); display: flex; flex-direction: column; gap: 10px; }
        .load-older { display: flex; justify-content: center; padding-bottom: 6px; }
        .bubble-row { display: flex; gap: 8px; align-items: flex-end; max-width: 78%; }
        .bubble-row.mine { align-self: flex-end; flex-direction: row-reverse; }
        .bubble-wrap { min-width: 0; }
        .bubble-name { font-size: 11px; color: var(--ink-4); margin-bottom: 3px; margin-left: 2px; }
        .bubble { padding: 9px 13px; border-radius: 14px; font-size: 14px; line-height: 1.45; background: var(--surface); border: 1px solid var(--line); color: var(--ink); word-break: break-word; white-space: pre-wrap; }
        .bubble-row.mine .bubble { background: var(--primary); color: #FBF9F2; border-color: var(--primary); }
        .bubble-time { font-size: 10px; color: var(--ink-5); margin-top: 3px; font-family: var(--font-en); }
        .bubble-row.mine .bubble-time { text-align: right; }
        .chat-input { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--line); background: var(--surface); }
        .chat-input input { flex: 1; height: 44px; border: 1px solid var(--line-2); border-radius: 22px; padding: 0 18px; font-size: 14px; background: var(--bg); color: var(--ink); }
        .chat-input input:focus { border-color: var(--primary); outline: none; }
        .chat-input .btn { width: 44px; height: 44px; border-radius: 50%; padding: 0; display: grid; place-items: center; }
        @media (max-width: 900px) {
          .chat-room { height: calc(100vh - 56px); }
        }
      `}</style>
    </div>
  );
}

"use client";

/* ChatRoomScreen.jsx — 1:1 채팅방 (실시간)
   REST : GET /chat/rooms/{roomId}/messages?cursor=&size=  (최신→과거, nextCursor/hasNext)
   STOMP: SUBSCRIBE /user/queue/messages,  SEND /pub/chat/rooms/{roomId} { content }
   상대/물품 정보는 GET /members/me/chat/rooms 에서 매칭. */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Avatar, StateBox } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { connectChat, sendMessage, disconnectChat } from "@/lib/chat";

export default function ChatRoomScreen({ roomId }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const rid = Number(roomId);

  const [messages, setMessages] = useState([]); // 오래된→최신 순으로 정렬해 표시
  const [room, setRoom] = useState(null); // {partnerNickName, foodName, foodId}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("connecting"); // connecting|connected|disconnected|error
  const [text, setText] = useState("");

  const clientRef = useRef(null);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  // 초기 히스토리 + 방 정보
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    setLoading(true);
    Promise.all([
      API.chat.history(rid, { size: 30 }),
      API.chat.myRooms().catch(() => []),
    ])
      .then(([hist, rooms]) => {
        if (!alive) return;
        const msgs = (hist && hist.messages) || [];
        setMessages([...msgs].reverse()); // 최신→과거 응답을 과거→최신으로
        setCursor(hist && hist.nextCursor);
        setHasMore(!!(hist && hist.hasNext));
        const found = (rooms || []).find((r) => r.roomId === rid);
        setRoom(found || null);
        scrollToBottom();
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, rid, router]);

  // STOMP 연결
  useEffect(() => {
    if (!user) return;
    let active = true;
    connectChat({
      onStatus: (s) => active && setStatus(s),
      onMessage: (payload) => {
        if (!active) return;
        if (payload && payload.roomId === rid) {
          setMessages((prev) => [...prev, {
            messageId: payload.messageId,
            senderId: payload.senderId,
            senderNickName: payload.senderNickName,
            content: payload.content,
            mine: false,
            createdAt: payload.createdAt,
          }]);
          scrollToBottom();
        }
      },
    }).then((c) => { clientRef.current = c; });
    return () => { active = false; disconnectChat(clientRef.current); clientRef.current = null; };
  }, [user, rid]);

  const loadOlder = useCallback(() => {
    if (!cursor) return;
    API.chat.history(rid, { cursor, size: 30 }).then((hist) => {
      const older = ((hist && hist.messages) || []).reverse();
      setMessages((prev) => [...older, ...prev]);
      setCursor(hist && hist.nextCursor);
      setHasMore(!!(hist && hist.hasNext));
    }).catch(() => {});
  }, [cursor, rid]);

  const send = () => {
    const content = text.trim();
    if (!content) return;
    const ok = sendMessage(clientRef.current, rid, content);
    if (!ok) return; // 연결 안됨
    // 본인 메시지는 서버가 되돌려주지 않으므로 낙관적 추가
    setMessages((prev) => [...prev, {
      messageId: `local-${Date.now()}`,
      senderId: user.memberId,
      content,
      mine: true,
      createdAt: new Date().toISOString(),
    }]);
    setText("");
    scrollToBottom();
  };

  if (authLoading || (user && loading)) return <div className="croomv"><StateBox kind="loading" title="대화를 불러오는 중…" /></div>;
  if (!user) return null;

  const statusText = { connecting: "연결 중…", connected: "실시간 연결됨", disconnected: "연결 끊김", error: "연결 오류" }[status];

  return (
    <div className="croomv">
      <div className="croomv-head">
        <button className="crumb-back" onClick={() => router.push("/chat")}><Icon.ChevronLeft /></button>
        <Avatar name={(room && room.partnerNickName) || "?"} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="croomv-name">{(room && room.partnerNickName) || "상대방"}</div>
          <div className="croomv-sub">
            {room && room.foodName ? room.foodName : "나눔 채팅"}
            <span className={`conn ${status}`}>· {statusText}</span>
          </div>
        </div>
        {room && room.foodId && (
          <button className="btn ghost sm" onClick={() => router.push(`/foods/${room.foodId}`)}>물품 보기</button>
        )}
      </div>

      <div className="croomv-body" ref={scrollRef}>
        {error ? (
          <StateBox kind="error" title="대화를 불러오지 못했어요" sub={error.code || error.message} />
        ) : (
          <>
            {hasMore && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <button className="btn ghost sm" onClick={loadOlder}>이전 대화 더 보기</button>
              </div>
            )}
            {messages.length === 0 && <div className="croomv-empty">첫 메시지를 보내 대화를 시작해보세요 👋</div>}
            {messages.map((m, i) => (
              <div key={m.messageId || i} className={`bubble-row ${m.mine ? "mine" : ""}`}>
                {!m.mine && <Avatar name={m.senderNickName || "?"} size={28} />}
                <div className="bubble">
                  {m.content}
                  <span className="bubble-time">{fmtTime(m.createdAt)}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="croomv-input">
        <input
          className="field-input"
          placeholder={status === "connected" ? "메시지를 입력하세요" : "실시간 연결을 기다리는 중…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={status !== "connected"}
        />
        <button className="btn primary send" onClick={send} disabled={status !== "connected" || !text.trim()} aria-label="보내기">
          <Icon.Send />
        </button>
      </div>

      <style>{`
        .croomv { max-width: 760px; margin: 0 auto; height: calc(100vh - var(--header-h)); display: flex; flex-direction: column; }
        .croomv-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
        .croomv-name { font-weight: 700; font-size: 15px; }
        .croomv-sub { font-size: 12px; color: var(--ink-4); margin-top: 1px; display: flex; gap: 5px; }
        .conn { font-weight: 600; }
        .conn.connected { color: var(--success); }
        .conn.error, .conn.disconnected { color: var(--danger); }
        .croomv-body { flex: 1; overflow-y: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 10px; background: var(--bg-2); }
        .croomv-empty { margin: auto; color: var(--ink-4); font-size: 13.5px; }
        .bubble-row { display: flex; align-items: flex-end; gap: 8px; max-width: 78%; }
        .bubble-row.mine { margin-left: auto; flex-direction: row-reverse; }
        .bubble { position: relative; padding: 9px 13px; border-radius: 14px; font-size: 14px; line-height: 1.5; background: var(--surface); border: 1px solid var(--line); color: var(--ink); word-break: break-word; }
        .bubble-row.mine .bubble { background: var(--primary); color: #fff; border-color: var(--primary); }
        .bubble-time { display: block; font-size: 10px; opacity: 0.6; margin-top: 4px; font-family: var(--font-en); }
        .croomv-input { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--line); background: var(--surface); }
        .croomv-input .field-input { flex: 1; }
        .croomv-input .send { width: 48px; height: 46px; padding: 0; flex-shrink: 0; }
        @media (max-width: 900px) { .croomv { height: calc(100vh - var(--header-h)); } }
      `}</style>
    </div>
  );
}

function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

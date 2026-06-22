"use client";

/* ChatScreens.jsx — 채팅 목록(D-channel) + 실시간 채팅방
   목록:   GET /members/me/chat/rooms
   방 입장: GET /chat/rooms/{roomId}/messages (양방향 커서, 명세 6-3)
     - direction=initial: 마지막 읽은 메시지 기준 위·아래를 함께 로드 → 맨 밑이 아니라
       "여기까지 읽음 · 새 메시지" 구분선(anchor)으로 진입
     - direction=before(위로/과거) / after(아래로/최신) 무한 스크롤
   실시간:  STOMP /ws  · SEND /pub/chat/rooms/{roomId} · SUBSCRIBE /user/queue/messages
   (발신자는 자신의 메시지를 소켓으로 다시 받지 않으므로 낙관적으로 화면에 추가) */

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState(null); // null=loading
  const [error, setError] = useState(null);

  // 현재 열려 있는 채팅방(URL) — 목록에서 활성 항목을 강조
  const activeRoomId = (() => {
    const m = pathname && pathname.match(/^\/chat\/(\d+)/);
    return m ? Number(m[1]) : null;
  })();

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
            <button className={`room-item ${r.roomId === activeRoomId ? "active" : ""}`} key={r.roomId} onClick={() => router.push(`/chat/${r.roomId}`)}>
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
        .chat-list { width: 100%; padding: 20px 16px 40px; }
        .chat-list-head { margin-bottom: 16px; padding: 0 2px; }
        .chat-list-head h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-top: 2px; }
        .room-list { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--surface); }
        .room-item { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; padding: 16px 18px; border-bottom: 1px solid var(--line); background: var(--surface); transition: background 0.12s; border-left: 3px solid transparent; }
        .room-item:last-child { border-bottom: 0; }
        .room-item:hover { background: var(--bg-2); }
        .room-item.active { background: var(--bg-2); border-left-color: var(--primary); }
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

/* 히스토리 응답 정규화 — 신(양방향) / 구(cursor-only) 포맷 모두 지원
   신: { messages, anchorMessageId, upCursor, downCursor, hasPrev, hasNext }
   구: { messages, nextCursor, hasNext }  (hasNext = '더 오래된 메시지 있음') */
function readHistory(hist) {
  const messages = (hist && hist.messages) || [];
  const isNew = hist && hist.hasPrev !== undefined;
  if (isNew) {
    return {
      messages,
      anchorId: hist.anchorMessageId ?? 0,
      upCursor: hist.upCursor ?? null,
      hasPrev: !!hist.hasPrev,
      downCursor: hist.downCursor ?? null,
      hasNext: !!hist.hasNext,
    };
  }
  return {
    messages,
    anchorId: 0,
    upCursor: hist?.nextCursor ?? null,
    hasPrev: !!(hist && hist.hasNext),
    downCursor: null,
    hasNext: false,
  };
}

/* ============ 빈 화면(데스크톱: 방 미선택 시 우측 패널) ============ */
export function ChatEmptyPane() {
  return (
    <div className="chat-empty-pane">
      <div className="chat-empty-icon"><Icon.Chat /></div>
      <p>대화방을 선택해주세요</p>
      <style>{`
        .chat-empty-pane { height: 100%; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: var(--ink-4); }
        .chat-empty-icon { width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center; background: var(--bg-2); color: var(--ink-4); }
        .chat-empty-icon svg { width: 30px; height: 30px; }
        .chat-empty-pane p { font-size: 15px; font-weight: 600; }
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
  const [anchorId, setAnchorId] = useState(0); // 진입 기준(직전 lastRead) — "새 메시지" 구분선 위치
  const [loadingMore, setLoadingMore] = useState(false); // 위로(과거) 로딩 스피너
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting");

  const sockRef = useRef(null);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const tempId = useRef(-1);
  // 양방향 커서/플래그 — 스크롤 핸들러에서 최신값을 읽도록 ref로 관리
  const pageRef = useRef({ upCursor: null, hasPrev: false, downCursor: null, hasNext: false });
  const loadingUp = useRef(false);
  const loadingDown = useRef(false);

  const numericRoomId = Number(roomId);

  // 초기 히스토리 + 방 메타
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      API.chat.history(roomId, { direction: "initial", size: 30 }),
      API.chat.myRooms().catch(() => []),
    ])
      .then(([hist, rooms]) => {
        if (!alive) return;
        const p = readHistory(hist);
        setMessages([...p.messages].reverse()); // 최신순 → 오름차순
        pageRef.current = { upCursor: p.upCursor, hasPrev: p.hasPrev, downCursor: p.downCursor, hasNext: p.hasNext };
        setAnchorId(p.anchorId);
        const found = Array.isArray(rooms) ? rooms.find((r) => r.roomId === numericRoomId) : null;
        setRoom(found || null);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, roomId, numericRoomId, router]);

  // 첫 로딩 후: 안 읽은 메시지가 있으면 "새 메시지" 구분선으로, 없으면 맨 아래로
  useEffect(() => {
    if (loading) return;
    const el = scrollRef.current;
    if (!el) return;
    const divider = el.querySelector("[data-new-divider]");
    if (divider) divider.scrollIntoView({ block: "center" });
    else if (bottomRef.current) bottomRef.current.scrollIntoView({ block: "end" });
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

  // 위로(과거) 더 보기 — before 커서. 스크롤 위치 보존(점프 방지)
  const loadOlder = () => {
    const pg = pageRef.current;
    if (loadingUp.current || !pg.hasPrev || pg.upCursor == null) return;
    loadingUp.current = true;
    setLoadingMore(true);
    const el = scrollRef.current;
    const prevHeight = el ? el.scrollHeight : 0;
    API.chat.history(roomId, { direction: "before", cursor: pg.upCursor, size: 30 })
      .then((hist) => {
        const p = readHistory(hist);
        const older = [...p.messages].reverse();
        if (older.length) setMessages((prev) => [...older, ...prev]);
        pageRef.current = { ...pageRef.current, upCursor: p.upCursor, hasPrev: p.hasPrev };
        setTimeout(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; }, 0);
      })
      .catch(() => {})
      .finally(() => { loadingUp.current = false; setLoadingMore(false); });
  };

  // 아래로(최신) 더 보기 — after 커서. (구버전 백엔드는 hasNext=false라 비활성)
  const loadNewer = () => {
    const pg = pageRef.current;
    if (loadingDown.current || !pg.hasNext || pg.downCursor == null) return;
    loadingDown.current = true;
    API.chat.history(roomId, { direction: "after", cursor: pg.downCursor, size: 30 })
      .then((hist) => {
        const p = readHistory(hist);
        const newer = [...p.messages].reverse();
        if (newer.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.messageId));
            return [...prev, ...newer.filter((m) => !seen.has(m.messageId))];
          });
        }
        pageRef.current = { ...pageRef.current, downCursor: p.downCursor, hasNext: p.hasNext };
      })
      .catch(() => {})
      .finally(() => { loadingDown.current = false; });
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

  // 첫 안 읽은 메시지(anchor 다음) 인덱스 — 그 위에 "새 메시지" 구분선을 그린다.
  const firstUnreadIdx =
    anchorId > 0
      ? messages.findIndex((m) => m.messageId != null && m.messageId > anchorId)
      : -1;

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

      <div className="chat-scroll" ref={scrollRef} onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollTop <= 80) loadOlder();
        if (el.scrollHeight - el.scrollTop - el.clientHeight <= 80) loadNewer();
      }}>
        {loading ? (
          <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner size={28} /></div>
        ) : error ? (
          <StateBox kind="error" title="채팅을 불러오지 못했어요" sub={`(${error.code || error.status || "네트워크 오류"})`} />
        ) : (
          <>
            {loadingMore && (
              <div className="load-older"><Spinner size={20} /></div>
            )}
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 13, padding: "40px 0" }}>
                첫 메시지를 보내 대화를 시작해보세요 👋
              </div>
            )}
            {messages.map((m, i) => (
              <Fragment key={m.messageId ?? i}>
                {i === firstUnreadIdx && (
                  <div data-new-divider className="new-divider"><span>여기까지 읽음 · 새 메시지</span></div>
                )}
                <div className={`bubble-row ${m.mine ? "mine" : ""}`}>
                  {!m.mine && <Avatar name={m.senderNickName || "?"} size={30} />}
                  <div className="bubble-wrap">
                    {!m.mine && <div className="bubble-name">{m.senderNickName}</div>}
                    <div className="bubble">{m.content}</div>
                    <div className="bubble-time">{timeLabel(m.createdAt)}</div>
                  </div>
                </div>
              </Fragment>
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
        .chat-room { display: flex; flex-direction: column; height: 100%; width: 100%; }
        .chat-room-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--surface); }
        .chat-room-head .crumb-back { width: 32px; height: 32px; display: none; place-items: center; border-radius: 8px; color: var(--ink-2); }
        .chat-room-head .crumb-back:hover { background: var(--bg-2); }
        @media (max-width: 900px) { .chat-room-head .crumb-back { display: grid; } }
        .cr-partner { font-weight: 700; font-size: 15px; }
        .cr-food { font-size: 11.5px; color: var(--primary); font-weight: 600; margin-top: 1px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cr-status { font-size: 11px; font-weight: 600; color: var(--ink-4); white-space: nowrap; }
        .cr-status.connected { color: var(--primary); }
        .cr-status.error, .cr-status.disconnected { color: var(--danger); }
        .chat-scroll { flex: 1; overflow-y: auto; padding: 16px; margin: 12px; border: 1px solid var(--line-2); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow-pop); display: flex; flex-direction: column; gap: 10px; }
        .load-older { display: flex; justify-content: center; padding-bottom: 6px; }
        .new-divider { display: flex; align-items: center; text-align: center; gap: 10px; margin: 4px 0 6px; color: var(--danger); font-size: 11px; font-weight: 700; }
        .new-divider::before, .new-divider::after { content: ""; flex: 1; height: 1px; background: var(--danger); opacity: 0.35; }
        .new-divider span { white-space: nowrap; }
        .bubble-row { display: flex; gap: 8px; align-items: flex-end; max-width: 78%; }
        .bubble-row.mine { align-self: flex-end; flex-direction: row-reverse; }
        .bubble-wrap { min-width: 0; }
        .bubble-row:not(.mine) .bubble-wrap { border-left: 2px solid var(--primary-100); padding-left: 10px; }
        .bubble-name { font-size: 11px; color: var(--ink-4); margin-bottom: 3px; margin-left: 2px; }
        .bubble-row:not(.mine) .bubble-name { color: var(--primary); font-weight: 600; }
        .bubble { padding: 9px 13px; border-radius: 14px; font-size: 14px; line-height: 1.45; background: var(--bg-2); border: 1px solid var(--line); color: var(--ink); word-break: break-word; white-space: pre-wrap; }
        .bubble-row.mine .bubble { background: var(--primary); color: #FBF9F2; border-color: var(--primary); }
        .bubble-time { font-size: 10px; color: var(--ink-5); margin-top: 3px; font-family: var(--font-en); }
        .bubble-row.mine .bubble-time { text-align: right; }
        .chat-input { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--line); background: var(--surface); }
        .chat-input input { flex: 1; height: 44px; border: 1px solid var(--line-2); border-radius: 22px; padding: 0 18px; font-size: 14px; background: var(--bg); color: var(--ink); }
        .chat-input input:focus { border-color: var(--primary); outline: none; }
        .chat-input .btn { width: 44px; height: 44px; border-radius: 50%; padding: 0; display: grid; place-items: center; }
      `}</style>
    </div>
  );
}

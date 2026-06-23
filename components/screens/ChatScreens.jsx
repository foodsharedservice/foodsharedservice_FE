"use client";

/* ChatScreens.jsx — 채팅 목록 + 실시간 채팅방
   ※ UI는 업로드된 zip 디자인(Chat.tsx, Warm Organic Modernism)을 그대로 사용한다.
     백엔드 채팅 기능은 전부 실제 API/소켓에 연결되어 있다.

   목록:   GET /members/me/chat/rooms
   방 입장: GET /chat/rooms/{roomId}/messages (양방향 커서, 명세 6-3)
     - direction=initial: 마지막 읽은 메시지 기준 위·아래를 함께 로드 → 맨 밑이 아니라
       "여기까지 읽음 · 새 메시지" 구분선(anchor)으로 진입
     - direction=before(위로/과거) / after(아래로/최신) 무한 스크롤
   실시간:  STOMP /ws  · SEND /pub/chat/rooms/{roomId} · SUBSCRIBE /user/queue/messages
   (발신자는 자신의 메시지를 소켓으로 다시 받지 않으므로 낙관적으로 화면에 추가) */

import { useState, useEffect, useRef, Fragment } from "react";
import { useRouter, usePathname } from "next/navigation";
import Icon from "@/components/icons";
import { StateBox, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { createChatSocket } from "@/lib/chatSocket";
import API from "@/lib/api";

/* zip(utils.ts)의 formatChatTime — 오늘은 시각, 어제/N일 전, 그 이전은 월·일 */
function formatChatTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "어제";
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  }
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

/* zip 디자인의 아바타(AvatarFallback) — amber 원형 + 이니셜.
   메시지의 상대방 아바타는 secondary 톤을 사용한다. */
function ChatAvatar({ name = "?", size = 44, variant = "amber" }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const tone =
    variant === "secondary" ? "bg-secondary text-secondary-foreground" : "bg-amber text-white";
  return (
    <div
      className={`rounded-full grid place-items-center font-bold flex-shrink-0 ${tone}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </div>
  );
}

/* zip 디자인에서 쓰는 Package 아이콘(repo 아이콘셋에 없어 로컬 정의) */
function PackageIcon(p) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
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

  return (
    <div className="flex flex-col min-h-full bg-card">
      {/* 헤더 */}
      <div className="p-5 border-b border-border sticky top-0 bg-card z-10">
        <h2 className="text-xl font-extrabold text-foreground">채팅</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {rooms && rooms.length > 0 ? `${rooms.length}개의 대화` : "대화 목록"}
        </p>
      </div>

      {authLoading || rooms === null ? (
        <StateBox kind="loading" title="채팅 목록을 불러오는 중…" />
      ) : error ? (
        <StateBox
          kind="error"
          title="채팅을 불러오지 못했어요"
          sub={`(${error.code || error.status || "네트워크 오류"})`}
        />
      ) : rooms.length === 0 ? (
        <StateBox
          kind="empty"
          title="아직 채팅이 없어요"
          sub="물품 상세에서 ‘채팅하기’로 등록자와 대화를 시작해보세요."
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {rooms.map((room) => {
            const active = room.roomId === activeRoomId;
            return (
              <button
                key={room.roomId}
                onClick={() => router.push(`/chat/${room.roomId}`)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors text-left border-b border-border/50 ${
                  active ? "bg-amber/5 border-l-2 border-l-amber" : ""
                }`}
              >
                <ChatAvatar name={room.partnerNickName} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-foreground text-sm truncate">
                      {room.partnerNickName || "상대"}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {formatChatTime(room.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mb-1">{room.foodName}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {room.lastMessage || "대화를 시작해보세요"}
                    </p>
                    {room.unreadCount > 0 && (
                      <span className="bg-amber text-white text-xs ml-2 flex-shrink-0 min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5 font-bold">
                        {room.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
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
    <div className="flex-1 h-full w-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-20 h-20 rounded-3xl bg-amber/10 flex items-center justify-center mb-5">
        <Icon.Chat width={40} height={40} className="text-amber" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">채팅을 선택해주세요</h3>
      <p className="text-muted-foreground text-sm max-w-xs">
        왼쪽 목록에서 대화를 선택하거나,
        <br />
        물품 상세 페이지에서 채팅을 시작하세요.
      </p>
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

  // STOMP 연결 (실시간 수신)
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
    <div className="flex flex-col h-full w-full">
      {/* 채팅방 헤더 (zip 디자인) */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card">
        <button
          className="md:hidden p-1.5 rounded-lg hover:bg-accent transition-colors"
          onClick={() => router.push("/chat")}
          aria-label="뒤로"
        >
          <Icon.ChevronLeft width={20} height={20} />
        </button>
        <ChatAvatar name={(room && room.partnerNickName) || "?"} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">
            {room ? room.partnerNickName || "상대" : "채팅"}
          </p>
          {room && room.foodName && (
            <div className="flex items-center gap-1.5">
              <PackageIcon width={12} height={12} className="text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground truncate">{room.foodName}</p>
            </div>
          )}
        </div>
        {room && (
          <button
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors flex-shrink-0"
            onClick={() => router.push(`/foods/${room.foodId}`)}
          >
            <PackageIcon width={14} height={14} />
            물품 보기
          </button>
        )}
      </div>

      {/* 메시지 영역 (zip 디자인: bg-cream) */}
      <div
        className="flex-1 overflow-y-auto p-5 space-y-4 bg-cream/50"
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop <= 80) loadOlder();
          if (el.scrollHeight - el.scrollTop - el.clientHeight <= 80) loadNewer();
        }}
      >
        {loading ? (
          <div className="py-16 grid place-items-center"><Spinner size={28} /></div>
        ) : error ? (
          <StateBox kind="error" title="채팅을 불러오지 못했어요" sub={`(${error.code || error.status || "네트워크 오류"})`} />
        ) : (
          <>
            {loadingMore && (
              <div className="flex justify-center pb-1.5"><Spinner size={20} /></div>
            )}
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-10">
                첫 메시지를 보내 대화를 시작해보세요 👋
              </div>
            )}
            {messages.map((msg, i) => (
              <Fragment key={msg.messageId ?? i}>
                {i === firstUnreadIdx && (
                  <div
                    data-new-divider
                    className="flex items-center text-center gap-2.5 text-amber text-[11px] font-bold"
                  >
                    <span className="flex-1 h-px bg-amber/35" />
                    <span className="whitespace-nowrap">여기까지 읽음 · 새 메시지</span>
                    <span className="flex-1 h-px bg-amber/35" />
                  </div>
                )}
                <div
                  className={`flex items-end gap-2 animate-fade-in ${
                    msg.mine ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {!msg.mine && (
                    <ChatAvatar name={msg.senderNickName} size={32} variant="secondary" />
                  )}
                  <div
                    className={`max-w-[70%] flex flex-col gap-1 ${
                      msg.mine ? "items-end" : "items-start"
                    }`}
                  >
                    {!msg.mine && (
                      <span className="text-xs text-muted-foreground px-1">{msg.senderNickName}</span>
                    )}
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        msg.mine
                          ? "bg-amber text-white rounded-br-sm"
                          : "bg-card text-foreground rounded-bl-sm border border-border"
                      }`}
                      style={msg.mine ? { boxShadow: "0 2px 8px oklch(0.70 0.16 55 / 0.25)" } : {}}
                    >
                      {msg.content}
                    </div>
                    <span className="text-xs text-muted-foreground px-1">
                      {formatChatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              </Fragment>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* 입력 영역 (zip 디자인) */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2 items-end">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }}
            placeholder="메시지를 입력하세요..."
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-cream border border-border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={!input.trim() || status !== "connected"}
            className="bg-amber text-white hover:bg-amber-dark shadow-warm w-10 h-10 p-0 rounded-xl grid place-items-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="보내기"
          >
            <Icon.Send width={16} height={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

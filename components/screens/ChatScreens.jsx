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

  // 좌측 목록 헤더 — 우측 채팅방 헤더와 같은 높이(65px)로 맞춰 구분선이 한 줄로 이어지게 한다.
  const Header = (
    <div className="h-[65px] px-5 flex flex-col justify-center border-b border-border">
      <h1 className="text-xl font-bold text-foreground leading-tight">채팅</h1>
      <p className="text-xs text-muted-foreground mt-0.5">
        {rooms && rooms.length > 0 ? `${rooms.length}개의 대화` : "대화 목록"}
      </p>
    </div>
  );

  if (authLoading || rooms === null) {
    return (
      <div className="w-full">
        {Header}
        <div className="p-4 sm:p-5">
          <StateBox kind="loading" title="채팅 목록을 불러오는 중…" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {Header}
      <div className="p-3 sm:p-4">
      {error ? (
        <StateBox kind="error" title="채팅을 불러오지 못했어요" sub={`(${error.code || error.status || "네트워크 오류"})`} />
      ) : rooms.length === 0 ? (
        <StateBox kind="empty" title="아직 채팅이 없어요" sub="물품 상세에서 ‘채팅하기’로 등록자와 대화를 시작해보세요." />
      ) : (
        <div className="flex flex-col gap-1">
          {rooms.map((r) => {
            const active = r.roomId === activeRoomId;
            return (
              <button
                key={r.roomId}
                onClick={() => router.push(`/chat/${r.roomId}`)}
                className={`flex items-center gap-3.5 w-full text-left p-3 rounded-xl transition-colors ${
                  active ? "bg-amber/10" : "hover:bg-muted"
                }`}
              >
                <Avatar name={r.partnerNickName || "?"} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-sm text-foreground truncate">{r.partnerNickName || "상대"}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">{timeLabel(r.lastMessageAt)}</span>
                  </div>
                  <div className="text-xs font-semibold text-amber mt-0.5 truncate">{r.foodName}</div>
                  <div className="text-sm text-muted-foreground truncate mt-0.5">{r.lastMessage || "대화를 시작해보세요"}</div>
                </div>
                {r.unreadCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber text-white text-[11px] font-bold grid place-items-center flex-shrink-0">
                    {r.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      </div>
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
    <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-amber/10 text-amber grid place-items-center">
        <Icon.Chat width={32} height={32} />
      </div>
      <p className="text-lg font-bold text-foreground">채팅을 선택해주세요</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
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
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center gap-2.5 px-4 h-[65px] border-b border-border bg-card">
        <button
          className="grid md:hidden w-8 h-8 place-items-center rounded-lg hover:bg-muted"
          onClick={() => router.push("/chat")}
          aria-label="뒤로"
        >
          <Icon.ChevronLeft />
        </button>
        <Avatar name={(room && room.partnerNickName) || "?"} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground truncate">{room ? (room.partnerNickName || "상대") : "채팅"}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                status === "connected" ? "bg-primary" : status === "error" || status === "disconnected" ? "bg-destructive" : "bg-muted-foreground"
              }`}
              title={status === "connected" ? "실시간 연결됨" : status === "connecting" ? "연결 중" : "연결 끊김"}
            />
          </div>
          {room && room.foodName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
              <Icon.Pin width={12} height={12} className="flex-shrink-0" />
              <span className="truncate">{room.foodName}</span>
            </div>
          )}
        </div>
        {room && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors flex-shrink-0"
            onClick={() => router.push(`/foods/${room.foodId}`)}
          >
            <Icon.Heart width={14} height={14} />
            물품 보기
          </button>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 bg-background flex flex-col gap-2.5"
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
            {messages.map((m, i) => (
              <Fragment key={m.messageId ?? i}>
                {i === firstUnreadIdx && (
                  <div data-new-divider className="flex items-center text-center gap-2.5 my-1 text-destructive text-[11px] font-bold">
                    <span className="flex-1 h-px bg-destructive/35" />
                    <span className="whitespace-nowrap">여기까지 읽음 · 새 메시지</span>
                    <span className="flex-1 h-px bg-destructive/35" />
                  </div>
                )}
                <div className={`flex gap-2 items-end max-w-[78%] ${m.mine ? "self-end flex-row-reverse" : ""}`}>
                  {!m.mine && <Avatar name={m.senderNickName || "?"} size={30} />}
                  <div className="min-w-0">
                    {!m.mine && <div className="text-[11px] text-amber font-semibold mb-1 ml-0.5">{m.senderNickName}</div>}
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        m.mine
                          ? "bg-amber text-white border border-amber"
                          : "bg-card border border-border text-foreground"
                      }`}
                    >
                      {m.content}
                    </div>
                    <div className={`text-[10px] text-muted-foreground mt-1 ${m.mine ? "text-right" : ""}`}>{timeLabel(m.createdAt)}</div>
                  </div>
                </div>
              </Fragment>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="flex gap-2 px-4 py-3 border-t border-border bg-card">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }}
          placeholder={status === "connected" ? "메시지를 입력하세요" : "연결 중…"}
          disabled={loading}
          className="flex-1 h-11 rounded-full border border-border bg-background px-5 text-sm focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber"
        />
        <button
          className="w-11 h-11 rounded-full bg-amber text-white grid place-items-center hover:bg-amber-dark disabled:opacity-50"
          onClick={send}
          disabled={!input.trim() || status !== "connected"}
          aria-label="보내기"
        >
          <Icon.Send />
        </button>
      </div>
    </div>
  );
}

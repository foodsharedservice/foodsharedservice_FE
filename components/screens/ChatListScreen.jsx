"use client";

/* ChatListScreen.jsx — 채팅 목록
   API: GET /members/me/chat/rooms → [{roomId, foodId, foodName, partnerNickName, lastMessage, lastMessageAt, unreadCount}] */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Avatar, StateBox } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

export default function ChatListScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    setLoading(true);
    API.chat.myRooms()
      .then((rs) => { if (alive) setRooms(Array.isArray(rs) ? rs : []); })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, router]);

  if (authLoading || (user && loading)) return <div className="chatlist"><StateBox kind="loading" title="채팅을 불러오는 중…" /></div>;
  if (!user) return null;

  return (
    <div className="chatlist">
      <h1 className="chatlist-title">채팅</h1>
      {error ? (
        <StateBox kind="error" title="채팅을 불러오지 못했어요" sub={error.code || error.message} onRetry={() => router.refresh()} />
      ) : rooms.length === 0 ? (
        <StateBox kind="empty" title="아직 채팅이 없어요" sub="마음에 드는 나눔에 채팅을 걸어보세요." />
      ) : (
        <div className="chatlist-rooms">
          {rooms.map((r) => (
            <button className="croom" key={r.roomId} onClick={() => router.push(`/chat/${r.roomId}`)}>
              <Avatar name={r.partnerNickName || "?"} size={50} />
              <div className="croom-body">
                <div className="croom-top">
                  <span className="croom-name">{r.partnerNickName || "상대방"}</span>
                  <span className="croom-food">· {r.foodName}</span>
                  {r.lastMessageAt && <span className="croom-time">{timeAgo(r.lastMessageAt)}</span>}
                </div>
                <div className="croom-msg">{r.lastMessage || "대화를 시작해보세요"}</div>
              </div>
              {r.unreadCount > 0 && <span className="croom-unread">{r.unreadCount}</span>}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .chatlist { max-width: 760px; margin: 0 auto; padding: 24px 20px 60px; }
        .chatlist-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 18px; }
        .chatlist-rooms { display: flex; flex-direction: column; gap: 8px; }
        .croom { display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); text-align: left; }
        .croom:hover { border-color: var(--line-2); box-shadow: var(--shadow-card-hover); }
        .croom-body { flex: 1; min-width: 0; }
        .croom-top { display: flex; align-items: baseline; gap: 6px; }
        .croom-name { font-weight: 700; font-size: 14.5px; }
        .croom-food { font-size: 12px; color: var(--ink-4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .croom-time { margin-left: auto; font-size: 11px; color: var(--ink-4); flex-shrink: 0; }
        .croom-msg { font-size: 13px; color: var(--ink-3); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .croom-unread { min-width: 20px; height: 20px; padding: 0 6px; background: var(--primary); color: #fff; border-radius: 999px; font-size: 11px; font-weight: 700; display: grid; place-items: center; font-family: var(--font-en); }
        @media (max-width: 900px) { .chatlist { padding: 16px 14px 50px; } }
      `}</style>
    </div>
  );
}

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

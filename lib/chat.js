/* lib/chat.js — 실시간 채팅(STOMP over WebSocket) 클라이언트
   백엔드 설정(WebSocketConfig):
     - endpoint        : /ws            (네이티브 WebSocket, 세션 쿠키로 핸드셰이크 인증)
     - app prefix      : /pub           (SEND /pub/chat/rooms/{roomId}  body { content })
     - user prefix     : /user          (SUBSCRIBE /user/queue/messages)
     - broker          : /queue
   수신 payload: { type:"CHAT_MESSAGE", messageId, roomId, senderId, senderNickName, content, createdAt } */

import API from "@/lib/api";

// https://api.foodshare.click/api/v1 → wss://api.foodshare.click/ws
export function wsUrl() {
  try {
    const u = new URL(API.base);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}/ws`;
  } catch {
    return "wss://api.foodshare.click/ws";
  }
}

/* STOMP 클라이언트를 연결한다. @stomp/stompjs는 클라이언트에서만 동적 로드한다.
   onMessage(payload), onStatus("connecting"|"connected"|"disconnected"|"error") 콜백 사용. */
export async function connectChat({ onMessage, onStatus } = {}) {
  if (typeof window === "undefined") return null;
  const { Client } = await import("@stomp/stompjs");

  const client = new Client({
    brokerURL: wsUrl(),
    reconnectDelay: 4000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });

  client.onConnect = () => {
    onStatus && onStatus("connected");
    // 개인 큐 구독: 서버가 convertAndSendToUser(memberId, "/queue/messages", payload)
    client.subscribe("/user/queue/messages", (frame) => {
      try {
        const payload = JSON.parse(frame.body);
        onMessage && onMessage(payload);
      } catch {
        /* ignore malformed */
      }
    });
  };
  client.onWebSocketClose = () => onStatus && onStatus("disconnected");
  client.onStompError = () => onStatus && onStatus("error");
  client.onWebSocketError = () => onStatus && onStatus("error");

  onStatus && onStatus("connecting");
  client.activate();
  return client;
}

export function sendMessage(client, roomId, content) {
  if (!client || !client.connected) return false;
  client.publish({
    destination: `/pub/chat/rooms/${roomId}`,
    body: JSON.stringify({ content }),
  });
  return true;
}

export function disconnectChat(client) {
  if (client) {
    try {
      client.deactivate();
    } catch {
      /* noop */
    }
  }
}

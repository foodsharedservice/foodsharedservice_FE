/* lib/chatSocket.js — STOMP over WebSocket 클라이언트 (실시간 채팅)

   백엔드(WebSocketConfig):
   - 엔드포인트: wss://<host>/ws  (SockJS 미사용 → 네이티브 WebSocket)
   - 인증: 핸드셰이크 시 세션 쿠키로 인증 (이미 로그인 상태여야 함)
   - 메시지 전송(SEND): /pub/chat/rooms/{roomId}  body { content }
   - 메시지 수신(SUBSCRIBE): /user/queue/messages  payload(ChatMessagePayload):
       { type:"CHAT_MESSAGE", messageId, roomId, senderId, senderNickName, content, createdAt }
   - heartbeat 10s/10s

   사용:
     const sock = createChatSocket({ onMessage, onStatus });
     sock.activate();
     sock.send(roomId, "안녕하세요");
     sock.deactivate();
*/

import { Client } from "@stomp/stompjs";
import API from "@/lib/api";

export function createChatSocket({ onMessage, onStatus } = {}) {
  let subscription = null;

  const client = new Client({
    // 네이티브 WebSocket 사용(브라우저가 세션 쿠키를 핸드셰이크에 자동 포함)
    webSocketFactory: () => new WebSocket(API.wsUrl),
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      onStatus && onStatus("connected");
      subscription = client.subscribe("/user/queue/messages", (frame) => {
        try {
          const payload = JSON.parse(frame.body);
          onMessage && onMessage(payload);
        } catch {
          /* 무시 */
        }
      });
    },
    onWebSocketClose: () => onStatus && onStatus("disconnected"),
    onStompError: () => onStatus && onStatus("error"),
    onWebSocketError: () => onStatus && onStatus("error"),
  });

  return {
    activate() {
      onStatus && onStatus("connecting");
      client.activate();
    },
    deactivate() {
      try {
        subscription && subscription.unsubscribe();
      } catch {
        /* 무시 */
      }
      client.deactivate();
    },
    send(roomId, content) {
      if (!client.connected) return false;
      client.publish({
        destination: `/pub/chat/rooms/${roomId}`,
        body: JSON.stringify({ content }),
      });
      return true;
    },
    get connected() {
      return client.connected;
    },
  };
}

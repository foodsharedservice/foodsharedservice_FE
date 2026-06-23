import { ChatRoomScreen } from "@/components/screens/ChatScreens";

export const metadata = { title: "채팅방 · 나눔마켓" };

export default function ChatRoomPage({ params }) {
  return <ChatRoomScreen roomId={params.roomId} />;
}

import ChatRoomScreen from "@/components/screens/ChatRoomScreen";

export const metadata = { title: "채팅방 · 나눔장터" };

export default function ChatRoomPage({ params }) {
  return <ChatRoomScreen roomId={params.roomId} />;
}

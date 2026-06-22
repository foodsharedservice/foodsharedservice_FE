import { ChatRoomScreen } from "@/components/screens/ChatScreens";

export const metadata = { title: "채팅방 · 냠냠" };

export default function ChatRoomPage({ params }) {
  return <ChatRoomScreen roomId={params.roomId} />;
}

import ChatRoomScreen from "@/components/screens/ChatRoomScreen";

export default function ChatRoomPage({ params }) {
  return <ChatRoomScreen roomId={params.roomId} />;
}

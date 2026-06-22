import { LoginScreen } from "@/components/screens/AuthScreens";
import MobileFrame from "@/components/MobileFrame";

export const metadata = { title: "로그인 · 냠냠" };

export default function LoginPage() {
  return (
    <MobileFrame>
      <LoginScreen />
    </MobileFrame>
  );
}

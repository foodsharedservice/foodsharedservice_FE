import { SignupScreen } from "@/components/screens/AuthScreens";
import MobileFrame from "@/components/MobileFrame";

export const metadata = { title: "회원가입 · 냠냠" };

export default function SignupPage() {
  return (
    <MobileFrame>
      <SignupScreen />
    </MobileFrame>
  );
}

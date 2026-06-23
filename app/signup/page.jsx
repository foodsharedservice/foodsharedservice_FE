import { SignupScreen } from "@/components/screens/AuthScreens";

export const metadata = { title: "회원가입 · 나눔마켓" };

export default function SignupPage() {
  return (
    <div className="auth-shell">
      <SignupScreen />
    </div>
  );
}

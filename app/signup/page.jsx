import { SignupScreen } from "@/components/screens/AuthScreens";

export const metadata = { title: "회원가입 · 나눔장터" };

export default function SignupPage() {
  return (
    <div className="auth-shell">
      <SignupScreen />
    </div>
  );
}

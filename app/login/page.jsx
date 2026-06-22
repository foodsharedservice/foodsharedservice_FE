import { LoginScreen } from "@/components/screens/AuthScreens";

export const metadata = { title: "로그인 · 냠냠" };

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <LoginScreen />
    </div>
  );
}

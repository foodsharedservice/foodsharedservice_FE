import { ToastProvider } from "@/components/Toast";
import { LoginScreen } from "@/components/screens/AuthScreens";

export const metadata = { title: "로그인 · 오늘나눔" };

export default function LoginPage() {
  return (
    <ToastProvider>
      <div className="screen auth">
        <LoginScreen />
      </div>
    </ToastProvider>
  );
}

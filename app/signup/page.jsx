import DeviceFrame from "@/components/DeviceFrame";
import { ToastProvider } from "@/components/Toast";
import { SignupScreen } from "@/components/screens/AuthScreens";

export const metadata = { title: "회원가입 · 오늘나눔" };

export default function SignupPage() {
  return (
    <DeviceFrame>
      <ToastProvider>
        <SignupScreen />
      </ToastProvider>
    </DeviceFrame>
  );
}

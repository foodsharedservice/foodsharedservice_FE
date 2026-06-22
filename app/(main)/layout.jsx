"use client";

import { ToastProvider } from "@/components/Toast";
import WebShell from "@/components/WebShell";

export default function MainLayout({ children }) {
  return (
    <ToastProvider>
      <WebShell>{children}</WebShell>
    </ToastProvider>
  );
}

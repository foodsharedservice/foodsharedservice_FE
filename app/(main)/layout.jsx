"use client";

import { ToastProvider } from "@/components/Toast";
import TabBar from "@/components/TabBar";

export default function MainLayout({ children }) {
  return (
    <ToastProvider>
      <div className="app-shell">
        {children}
        <TabBar />
      </div>
    </ToastProvider>
  );
}

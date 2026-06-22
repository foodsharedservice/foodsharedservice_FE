"use client";

import { ToastProvider } from "@/components/Toast";
import TabBar from "@/components/TabBar";
import DeviceFrame from "@/components/DeviceFrame";

export default function MainLayout({ children }) {
  return (
    <DeviceFrame>
      <ToastProvider>
        {children}
        <TabBar />
      </ToastProvider>
    </DeviceFrame>
  );
}

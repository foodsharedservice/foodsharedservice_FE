"use client";

/* components/Toast.jsx — 전역 토스트 (디자인의 하단 알약형 토스트) */

import { createContext, useContext, useCallback, useRef, useState } from "react";

const ToastContext = createContext({ show: () => {} });

export function ToastProvider({ children }) {
  const [text, setText] = useState("");
  const timer = useRef(null);

  const show = useCallback((msg) => {
    setText(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(""), 1900);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {text && (
        <div
          style={{
            position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)",
            background: "#2A2723", color: "#fff", padding: "12px 20px", borderRadius: 999,
            fontSize: 14, fontWeight: 600, zIndex: 60, whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(0,0,0,.2)", animation: "toastin .25s ease",
          }}
        >
          {text}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

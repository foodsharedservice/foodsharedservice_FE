"use client";

/* AuthProvider.jsx — 전역 인증 상태
   앱 진입 시 GET /members/me 로 실제 로그인 여부를 확인한다.
   401 이면 비로그인. (세션 쿠키 기반) */

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import API from "@/lib/api";

const AuthContext = createContext({
  user: null,
  loading: true,
  refresh: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const me = await API.members.me(); // GET /members/me
      setUser(me || null);
    } catch {
      setUser(null); // 401 등 → 비로그인
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

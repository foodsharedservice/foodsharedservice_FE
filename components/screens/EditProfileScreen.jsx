"use client";

/* EditProfileScreen.jsx — 회원정보 수정
   API: GET /members/me, GET /members/nickname/check, PATCH /members/me
   주소 입력은 기존 Daum 우편번호 서비스(AddressSearch) 그대로 사용 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { StateBox } from "@/components/ui";
import AddressSearch from "@/components/AddressSearch";
import API from "@/lib/api";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [origNick, setOrigNick] = useState("");
  const [nick, setNick] = useState("");
  const [nickState, setNickState] = useState("ok"); // ok | dup | need
  const [road, setRoad] = useState("");
  const [detailAddr, setDetailAddr] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const detailRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    let alive = true;
    API.members.me()
      .then((me) => {
        if (!alive || !me) return;
        setEmail(me.email || "");
        setOrigNick(me.nickName || "");
        setNick(me.nickName || "");
        setRoad((me.address && me.address.roadAddress) || "");
        setDetailAddr((me.address && me.address.detailAddress) || "");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, user, router]);

  const handleAddress = useCallback((data) => {
    const building = data.buildingName && data.buildingName !== "N" ? ` (${data.buildingName})` : "";
    const r = data.roadAddress || data.autoRoadAddress || data.jibunAddress || "";
    setRoad(r + building);
    setTimeout(() => detailRef.current && detailRef.current.focus(), 50);
  }, []);

  const checkNick = async () => {
    if (nick === origNick) { setNickState("ok"); return; }
    try {
      const d = await API.members.checkNickname(nick);
      setNickState(d && d.available ? "ok" : "dup");
      toast.show(d && d.available ? "사용 가능한 닉네임이에요" : "이미 사용 중인 닉네임이에요");
    } catch {
      toast.show("닉네임 확인에 실패했어요");
    }
  };

  const save = async () => {
    if (busy) return;
    if (nick !== origNick && nickState !== "ok") { toast.show("닉네임 중복확인을 해주세요"); return; }
    setBusy(true);
    try {
      await API.members.update({
        nickName: nick !== origNick ? nick : undefined,
        address: { roadAddress: road, detailAddress: detailAddr },
      });
      await refresh();
      toast.show("회원정보가 수정되었어요");
      router.back();
    } catch (e) {
      toast.show(e.message || "수정에 실패했어요");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="screen">
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 8px", position: "sticky", top: 0, zIndex: 20, background: "rgba(251,250,248,.92)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => router.back()} aria-label="뒤로" style={{ width: 40, height: 40, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F1D1B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>회원정보 수정</div>
      </div>

      {loading ? (
        <StateBox kind="loading" title="불러오는 중…" />
      ) : (
        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={fieldLabel}>닉네임</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={nick} onChange={(e) => { setNick(e.target.value); setNickState(e.target.value === origNick ? "ok" : "need"); }} style={{ ...textInput, flex: 1 }} />
              <button onClick={checkNick} disabled={nick.length < 2} style={{ padding: "0 16px", borderRadius: 12, border: "1.5px solid #E5DFD8", background: "#fff", color: "#6B6560", fontWeight: 700, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}>중복확인</button>
            </div>
          </div>
          <div>
            <label style={fieldLabel}>이메일</label>
            <input value={email} disabled style={{ ...textInput, border: "1.5px solid #EEE9E3", background: "#F5F1EC", color: "#9A938C" }} />
          </div>
          <div>
            <label style={fieldLabel}>도로명 주소</label>
            <input value={road} readOnly onClick={() => setAddrOpen(true)} placeholder="주소 검색" style={{ ...textInput, cursor: "pointer" }} />
          </div>
          <div>
            <label style={fieldLabel}>상세 주소</label>
            <input ref={detailRef} value={detailAddr} onChange={(e) => setDetailAddr(e.target.value)} placeholder="동·호수 등 (선택)" style={textInput} />
          </div>
        </div>
      )}

      <div style={{ height: 96 }} />
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EEE9E3", padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", zIndex: 40 }}>
        <button onClick={save} disabled={busy} style={{ width: "100%", padding: 15, borderRadius: 13, border: "none", background: "var(--ac)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>{busy ? "저장 중…" : "저장하기"}</button>
      </div>

      <AddressSearch open={addrOpen} onClose={() => setAddrOpen(false)} onComplete={handleAddress} />
    </div>
  );
}

const fieldLabel = { fontSize: 13.5, fontWeight: 700, color: "#37332E", display: "block", marginBottom: 7 };
const textInput = { width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid #E5DFD8", background: "#fff", fontSize: 15, color: "#1F1D1B" };

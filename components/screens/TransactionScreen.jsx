"use client";

/* TransactionScreen.jsx — D-06 거래 정보
   요청 수락 후, 등록자(owner)와 요청자(requester)가 픽업을 조율하는 화면.
   - 등록자 연락/주소 정보 표시
   - 채팅 시작: POST /chat/rooms { foodId } → { roomId } */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Avatar } from "@/components/ui";
import API from "@/lib/api";

const TX_DATA = {
  foodId: 100,
  roomId: null,
  owner: {
    nickName: "sunny_kim",
    address: "서울 서초구 서초대로 396 · 101동 202호",
    joined: "2025.11",
    shareCount: 12,
  },
  foodName: "참치캔 6개입 (미개봉)",
  expired: "2026-06-25",
  dDay: 12,
  approvedCount: 2,
  capacity: 3,
};

export default function TransactionScreen() {
  const router = useRouter();
  const t = TX_DATA;
  const [done, setDone] = useState(false);

  const openChat = () => {
    // POST /chat/rooms { foodId } → { roomId, foodId, created }
    API.chat.createRoom(t.foodId).catch(() => {});
  };

  return (
    <div className="tx">
      <div className="tx-card">
        <div className="tx-hero">
          <div className="tx-emoji">{done ? "✅" : "🎉"}</div>
          <div className="tx-hero-title">{done ? "거래가 완료됐어요" : "요청이 수락됐어요!"}</div>
          <div className="tx-hero-sub">
            {done ? "이웃과의 나눔이 잘 마무리됐어요. 고마워요!" : "등록자에게 연락해서 픽업 시간을 잡아주세요."}
          </div>
        </div>

        <div className="tx-body">
          <div className="tx-owner">
            <Avatar name={t.owner.nickName} size={48} />
            <div style={{ flex: 1 }}>
              <div className="tx-owner-name">{t.owner.nickName}</div>
              <div className="tx-owner-sub">
                {t.owner.address.split(" · ")[0]} · 가입 {t.owner.joined} · 나눔 {t.owner.shareCount}회
              </div>
            </div>
            <button className="btn ghost sm" onClick={openChat}>채팅하기</button>
          </div>

          <div className="tx-info">
            <div className="tx-info-row">
              <span className="ic"><Icon.Camera /></span>
              <b>{t.foodName}</b>
            </div>
            <div className="tx-info-row">
              <span className="ic"><Icon.Pin /></span>
              {t.owner.address}
            </div>
            <div className="tx-info-row">
              <span className="ic"><Icon.Calendar /></span>
              소비기한 <span className="font-en" style={{ fontWeight: 700 }}>{t.expired}</span>
              <span className="d-pill warn" style={{ marginLeft: 2 }}>D-{t.dDay}</span>
            </div>
            <div className="tx-info-row">
              <span className="ic"><Icon.Users /></span>
              정원 <b>{t.approvedCount} / {t.capacity}</b>
              <span style={{ color: "var(--ink-4)" }}>(자리 {t.capacity - t.approvedCount}개 남음)</span>
            </div>
          </div>

          <div className="tx-safety">
            <Icon.Flag />
            <div>
              <b>안전 안내</b>
              가공·미개봉 식품만 거래해요. 소비기한이 지난 음식은 받지 마세요. 노쇼·문제 발생 시{" "}
              <span style={{ textDecoration: "underline", cursor: "pointer" }}>신고하기</span>로 알려주세요.
            </div>
          </div>

          <div className="tx-actions">
            <button className="btn danger-ghost">신고하기</button>
            {!done ? (
              <button className="btn primary" onClick={() => setDone(true)}>거래 완료 표시</button>
            ) : (
              <button className="btn ghost" onClick={() => router.push("/")}>홈으로</button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .d-pill { font-family: var(--font-en); font-size: 11px; font-weight: 700; padding: 2px 8px; background: var(--primary-100); color: var(--primary-700); border-radius: 999px; letter-spacing: 0.02em; }
        .d-pill.warn { background: var(--accent-100); color: var(--accent-700); }
        @media (max-width: 900px) {
          .tx { padding: 16px; }
          .tx-actions { flex-direction: column-reverse; }
          .tx-actions .btn { width: 100%; }
        }
      `}</style>
    </div>
  );
}

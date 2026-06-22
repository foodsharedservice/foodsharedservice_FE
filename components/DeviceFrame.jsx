"use client";

/* components/DeviceFrame.jsx — 데스크톱에서 모바일 화면을 '휴대폰 목업'으로 크게 보여준다.
   - 좁은 화면(모바일): 그대로 전체화면(.app-shell)
   - 넓은 화면(데스크톱): 고정 논리 크기(460×940)의 디바이스를 화면 높이에 맞춰 확대(scale)
     transform 이 걸린 .app-shell 이 내부 position:fixed 바(탭바·하단버튼·토스트)의
     컨테이닝 블록이 되므로, 고정 바들이 뷰포트가 아닌 '디바이스' 기준으로 정렬된다. */

import { useState, useEffect } from "react";

const DEVICE_W = 460;
const DEVICE_H = 940;

export default function DeviceFrame({ children }) {
  const [scale, setScale] = useState(1); // 1 = 디바이스 프레임 미사용(전체화면)

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w < 640) { setScale(1); return; }
      const s = Math.min((h - 48) / DEVICE_H, (w - 48) / DEVICE_W);
      setScale(s > 1.02 ? Math.min(s, 1.7) : 1); // 확대될 때만 프레임 사용
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  if (scale === 1) {
    return <div className="app-shell">{children}</div>;
  }

  return (
    <div className="device-stage">
      <div className="app-shell device" style={{ width: DEVICE_W, height: DEVICE_H, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

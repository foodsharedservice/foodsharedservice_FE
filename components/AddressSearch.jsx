"use client";

/* AddressSearch.jsx — 도로명 주소 검색 모달 (Daum 우편번호 서비스 임베드)
   open=true 가 되면 모달 안에 우편번호 검색 UI를 임베드하고,
   사용자가 주소를 선택하면 onComplete(data) 호출 후 닫는다.
   data: { roadAddress, jibunAddress, zonecode, buildingName, ... } */

import { useEffect, useRef } from "react";
import Icon from "@/components/icons";
import { loadDaumPostcode } from "@/lib/loadDaumPostcode";

export default function AddressSearch({ open, onClose, onComplete }) {
  const boxRef = useRef(null);
  const cbRef = useRef({ onComplete, onClose });
  cbRef.current = { onComplete, onClose };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadDaumPostcode()
      .then((daum) => {
        if (cancelled || !boxRef.current) return;
        boxRef.current.innerHTML = "";
        new daum.Postcode({
          oncomplete: (data) => {
            cbRef.current.onComplete && cbRef.current.onComplete(data);
            cbRef.current.onClose && cbRef.current.onClose();
          },
          width: "100%",
          height: "100%",
          autoClose: false,
        }).embed(boxRef.current, { autoClose: false });
      })
      .catch(() => {
        if (boxRef.current) {
          boxRef.current.innerHTML =
            '<div style="padding:40px 16px;text-align:center;color:#9B9484;font-size:13px;">주소 검색 서비스를 불러오지 못했어요. 네트워크를 확인해주세요.</div>';
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="addr-scrim" onClick={onClose}>
      <div className="addr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="addr-head">
          <div>
            <div className="eyebrow" style={{ color: "var(--primary)" }}>ADDRESS</div>
            <b style={{ fontSize: 17, fontWeight: 800 }}>도로명 주소 검색</b>
          </div>
          <button className="icobtn" onClick={onClose} aria-label="닫기"><Icon.X /></button>
        </div>
        <div className="addr-embed" ref={boxRef} />
      </div>

      <style>{`
        .addr-scrim {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(33,30,23,0.45);
          backdrop-filter: blur(2px);
          display: grid; place-items: center;
          padding: 20px;
        }
        .addr-modal {
          width: 100%; max-width: 460px;
          background: var(--surface);
          border-radius: 16px;
          box-shadow: var(--shadow-pop);
          overflow: hidden;
          display: flex; flex-direction: column;
        }
        .addr-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid var(--line);
        }
        .addr-embed {
          width: 100%;
          height: 480px;
        }
      `}</style>
    </div>
  );
}

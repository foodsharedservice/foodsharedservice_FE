"use client";

/* RegisterScreen.jsx — 나눔 등록
   API 1: POST /foods/expired-date (multipart: expiredImage) → { expiredImageId, expired, accessUrl }
   API 2: POST /foods (multipart: request JSON + images[]) */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import API from "@/lib/api";

export default function RegisterScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const expInputRef = useRef(null);
  const imgInputRef = useRef(null);

  const [aiState, setAiState] = useState("empty"); // empty | loading | done
  const [expFile, setExpFile] = useState(null);
  const [expPreview, setExpPreview] = useState(null);
  const [expDate, setExpDate] = useState(null);
  const [expiredImageId, setExpiredImageId] = useState(null);

  const [foodName, setFoodName] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState([]); // { id, url, file }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  const onPickExpired = (e) => {
    const file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setExpFile(file);
    setExpPreview(URL.createObjectURL(file));
    setAiState("empty");
    setExpDate(null);
    setExpiredImageId(null);
  };

  const recognize = () => {
    if (!expFile) { toast.show("소비기한 사진을 먼저 올려주세요"); return; }
    setAiState("loading");
    API.foods.recognizeExpiry(expFile)
      .then((data) => {
        if (data && data.expired && data.expiredImageId != null) {
          setExpDate(data.expired);
          setExpiredImageId(data.expiredImageId);
          if (data.accessUrl) setExpPreview(data.accessUrl);
          setAiState("done");
        } else {
          setAiState("empty");
          toast.show("소비기한을 인식하지 못했어요. 다시 시도해주세요.");
        }
      })
      .catch((err) => {
        const map = {
          EXPIRED_DATE_NOT_DETECTED: "소비기한을 인식하지 못했어요. 더 선명한 사진으로 다시 시도해주세요.",
          AI_REQUEST_FAILED: "AI 인식 요청에 실패했어요. 잠시 후 다시 시도해주세요.",
          FILE_TOO_LARGE: "파일 용량이 너무 커요 (최대 10MB).",
          UNSUPPORTED_FILE_TYPE: "지원하지 않는 파일 형식이에요.",
        };
        setAiState("empty");
        toast.show(map[err.code] || err.message || "인식에 실패했어요.");
      });
  };

  const onPickImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (e.target) e.target.value = "";
    if (!files.length) return;
    setPhotos((prev) => {
      const room = Math.max(0, 5 - prev.length);
      const added = files.slice(0, room).map((file) => ({ id: `${Date.now()}-${file.name}-${Math.random()}`, url: URL.createObjectURL(file), file }));
      return [...prev, ...added];
    });
  };
  const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  const canSubmit = aiState === "done" && expiredImageId != null && foodName.trim().length > 0 && !busy;

  const submitFood = async () => {
    if (aiState !== "done") { toast.show("소비기한 인식을 먼저 해주세요"); return; }
    if (!foodName.trim()) { toast.show("물품명을 입력해주세요"); return; }
    if (!canSubmit) return;
    setBusy(true);
    try {
      await API.foods.create({ foodName: foodName.trim(), expiredImageId, capacity, details, images: photos.map((p) => p.file) });
      toast.show("물품이 등록되었어요!");
      router.push("/");
    } catch (err) {
      const map = {
        FOOD_LIMIT_EXCEEDED: "활성 물품은 최대 10개까지 등록할 수 있어요.",
        EXPIRED_IMAGE_REQUIRED: "소비기한 사진을 먼저 등록해주세요.",
        EXPIRED_IMAGE_NOT_FOUND: "소비기한 이미지를 다시 등록해주세요.",
        FILE_TOO_LARGE: "사진 용량이 너무 커요.",
        UNSUPPORTED_FILE_TYPE: "지원하지 않는 사진 형식이에요.",
      };
      toast.show(map[err.code] || err.message || "등록에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="screen">
      <input ref={expInputRef} type="file" accept="image/*" hidden onChange={onPickExpired} />
      <input ref={imgInputRef} type="file" accept="image/*" multiple hidden onChange={onPickImages} />

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 8px", position: "sticky", top: 0, zIndex: 20, background: "rgba(251,250,248,.92)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => router.back()} aria-label="뒤로" style={hdrBtn}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F1D1B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>나눔 등록</div>
      </div>

      <div style={{ padding: "8px 18px 0" }}>
        {/* STEP 1 */}
        <div style={stepLabel}>STEP 1 · 소비기한 인증</div>
        <div style={{ fontSize: 14, color: "#6B6560", margin: "6px 0 14px", lineHeight: 1.5 }}>소비기한이 보이게 촬영하면 AI가 자동으로 날짜를 읽어요.</div>

        {aiState === "loading" ? (
          <div style={{ border: "1.5px solid #EDE6DC", borderRadius: 16, padding: "34px 16px", textAlign: "center", background: "#F9F6F1" }}>
            <div style={{ width: 40, height: 40, border: "3px solid #EAE2D6", borderTopColor: "var(--ac)", borderRadius: "50%", margin: "0 auto 14px", animation: "spin .8s linear infinite" }} />
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#37332E" }}>AI가 소비기한을 읽고 있어요...</div>
          </div>
        ) : aiState === "done" ? (
          <div style={{ border: "1.5px solid #CBE6D5", borderRadius: 16, padding: 18, background: "#F0F8F3", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 12, background: "#DCEFE3", color: "#2E9E5B", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, fontFamily: "var(--font-mono)", overflow: "hidden" }}>
              {expPreview ? <img src={expPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "인식"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: "#2E9E5B", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E9E5B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>소비기한 인식 완료
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, marginTop: 3 }}>{(expDate || "").replace(/-/g, ".")}</div>
              <div style={{ fontSize: 11.5, color: "#7C8567", marginTop: 3 }}>AI 인식값으로 자동 설정 · 수정 불가</div>
            </div>
            <button onClick={() => { setAiState("empty"); setExpDate(null); setExpiredImageId(null); setExpFile(null); setExpPreview(null); }} aria-label="다시 올리기" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C8567" strokeWidth="2.2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
            </button>
          </div>
        ) : (
          <div>
            <button onClick={() => expInputRef.current?.click()} style={{ width: "100%", border: "2px dashed #DCD4CA", borderRadius: 16, padding: "34px 16px", textAlign: "center", background: "#F9F6F1", cursor: "pointer", overflow: "hidden" }}>
              {expPreview ? (
                <img src={expPreview} alt="소비기한" style={{ maxHeight: 140, maxWidth: "100%", borderRadius: 10, objectFit: "contain" }} />
              ) : (
                <>
                  <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#E2F0E7", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6BA17F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                  </div>
                  <div style={{ fontSize: 14, color: "#9A938C" }}>소비기한 사진을 올려주세요</div>
                </>
              )}
            </button>
            <button onClick={recognize} style={{ width: "100%", marginTop: 12, padding: 14, borderRadius: 13, border: "none", background: "#2A2723", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>AI로 소비기한 인식하기
            </button>
          </div>
        )}

        <div style={{ height: 1, background: "#F0ECE6", margin: "24px 0" }} />

        {/* STEP 2 */}
        <div style={stepLabel}>STEP 2 · 물품 정보</div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={fieldLabel}>물품명</label>
            <input value={foodName} onChange={(e) => setFoodName(e.target.value)} maxLength={30} placeholder="예) 미개봉 시리얼 600g" style={textInput} />
          </div>
          <div>
            <label style={fieldLabel}>모집 정원</label>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={() => setCapacity((c) => Math.max(1, c - 1))} style={stepBtn}>−</button>
              <span style={{ fontSize: 18, fontWeight: 800, minWidth: 24, textAlign: "center" }}>{capacity}</span>
              <button onClick={() => setCapacity((c) => Math.min(10, c + 1))} style={stepBtn}>+</button>
              <span style={{ fontSize: 13, color: "#9A938C" }}>명에게 나눔</span>
            </div>
          </div>
          <div>
            <label style={fieldLabel}>사진 (선택)</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {photos.map((p) => (
                <div key={p.id} style={{ position: "relative", width: 74, height: 74 }}>
                  <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                  <button onClick={() => removePhoto(p.id)} aria-label="삭제" style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(31,29,24,.8)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 12 }}>✕</button>
                </div>
              ))}
              {photos.length < 5 && (
                <button onClick={() => imgInputRef.current?.click()} style={{ width: 74, height: 74, border: "1.5px dashed #DCD4CA", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: "#A89F94", cursor: "pointer", background: "transparent" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A89F94" strokeWidth="2" strokeLinecap="round"><path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4z" /><circle cx="12" cy="13" r="3" /></svg>
                  <span style={{ fontSize: 11 }}>{photos.length}/5</span>
                </button>
              )}
            </div>
          </div>
          <div>
            <label style={fieldLabel}>상세 내용</label>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={4} placeholder="물품 상태, 거래 방법 등을 적어주세요." style={{ ...textInput, resize: "none", lineHeight: 1.5 }} />
          </div>
        </div>
      </div>
      <div style={{ height: 96 }} />

      {/* 하단 등록 버튼 */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EEE9E3", padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", zIndex: 40 }}>
        {canSubmit ? (
          <button onClick={submitFood} style={{ width: "100%", padding: 15, borderRadius: 13, border: "none", background: "var(--ac)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>{busy ? "등록 중…" : "나눔 등록하기"}</button>
        ) : (
          <button onClick={submitFood} style={{ width: "100%", padding: 15, borderRadius: 13, border: "none", background: "#F1ECE6", color: "#B6AFA7", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>{aiState === "done" ? "물품명을 입력해주세요" : "소비기한 인식 후 등록할 수 있어요"}</button>
        )}
      </div>
    </div>
  );
}

const hdrBtn = { width: 40, height: 40, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" };
const stepLabel = { fontSize: 13, fontWeight: 800, color: "var(--ac)", letterSpacing: "0.02em" };
const fieldLabel = { fontSize: 13.5, fontWeight: 700, color: "#37332E", display: "block", marginBottom: 7 };
const textInput = { width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid #E5DFD8", background: "#fff", fontSize: 15, color: "#1F1D1B" };
const stepBtn = { width: 42, height: 42, borderRadius: 12, border: "1.5px solid #E5DFD8", background: "#fff", fontSize: 20, color: "#6B6560", cursor: "pointer" };

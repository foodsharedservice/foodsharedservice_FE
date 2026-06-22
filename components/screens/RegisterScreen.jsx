"use client";

/* RegisterScreen.jsx — D-04 물품 등록 (실제 API)
   POST /foods (multipart: request{foodName,capacity,details,region} + file(대표 사진))
        → { foodId }   ※ 소비기한은 서버가 대표 사진을 AI로 분석해 자동 설정
   POST /foods/expired-date/{foodId} (multipart: file)  — 추가 사진 업로드(선택)

   등록한 foodId는 localStorage에 기록(백엔드에 "내 물품 목록" API가 없으므로
   마이페이지/알림에서 이 기록으로 내 물품을 복원한다). */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Photo, FormError } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { trackMyFood } from "@/lib/localStore";
import API from "@/lib/api";

export default function RegisterScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const coverInputRef = useRef(null);
  const moreInputRef = useRef(null);

  const [cover, setCover] = useState(null); // { url, file }
  const [photos, setPhotos] = useState([]); // 추가 사진 { id, url, file }
  const [foodName, setFoodName] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [details, setDetails] = useState("");
  const [region, setRegion] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  const onPickCover = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setCover({ url: URL.createObjectURL(file), file });
    if (e.target) e.target.value = "";
  };

  const onPickMore = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotos((prev) => {
      const room = Math.max(0, 4 - prev.length);
      const added = files.slice(0, room).map((file) => ({
        id: `${Date.now()}-${file.name}-${Math.random()}`,
        url: URL.createObjectURL(file),
        file,
      }));
      return [...prev, ...added];
    });
    if (e.target) e.target.value = "";
  };

  const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  const canSubmit = !!cover && foodName.trim().length > 0 && details.trim().length > 0 && !busy;

  const submitFood = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    setBusy(true);
    try {
      setProgress("물품을 등록하고 소비기한을 분석하는 중…");
      // 1) 대표 사진 + 정보로 물품 생성 (서버가 대표 사진의 소비기한을 AI 분석)
      const res = await API.foods.create(
        { foodName: foodName.trim(), capacity, details: details.trim(), region: region.trim() || undefined },
        cover.file
      );
      const foodId = res && res.foodId;
      if (foodId) trackMyFood(user && user.memberId, foodId);

      // 2) 추가 사진 업로드 (선택) — 실패해도 등록 자체는 성공으로 처리
      if (foodId && photos.length) {
        setProgress("추가 사진을 올리는 중…");
        for (const p of photos) {
          try { await API.foods.uploadImage(foodId, p.file); } catch { /* 개별 실패 무시 */ }
        }
      }

      if (foodId) router.push(`/foods/${foodId}`);
      else router.push("/");
    } catch (err) {
      const map = {
        FOOD_LIMIT_EXCEEDED: "활성 물품은 최대 개수를 초과했어요.",
        EMPTY_FILE: "대표 사진을 다시 등록해주세요.",
        INVALID_FILE_FORMAT: "지원하지 않는 사진 형식이에요. (JPG/PNG)",
        EXPIRATION_API_ERROR: "소비기한 분석 중 오류가 발생했어요. 더 선명한 사진으로 다시 시도해주세요.",
        IMAGE_STORAGE_ERROR: "이미지 저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
        VALIDATION_FAILED: "입력값을 확인해주세요.",
      };
      setSubmitError(map[err.code] || err.message || "등록에 실패했어요.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="register">
      <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={onPickCover} />
      <input ref={moreInputRef} type="file" accept="image/*" multiple hidden onChange={onPickMore} />

      <div className="register-head">
        <button className="crumb-back" onClick={() => router.push("/")}>
          <Icon.ChevronLeft /> 돌아가기
        </button>
        <h1 className="register-title">물품 등록</h1>
      </div>

      <div className="register-grid">
        {/* ============ LEFT: photos ============ */}
        <div>
          <section className="register-card">
            <div className="card-head">
              <div>
                <div className="eyebrow">STEP 1 · 필수</div>
                <h3 className="card-title">대표 사진</h3>
              </div>
              <div className="ai-chip"><Icon.Sparkle /> AI 소비기한 인식</div>
            </div>
            <p className="card-help">
              가공식품 라벨의 <b>소비기한이 잘 보이도록</b> 찍어주세요. 등록하면 AI가 대표 사진에서 소비기한을 자동으로 읽어 설정해요.
            </p>

            <div className="exp-upload">
              {!cover ? (
                <button className="exp-empty" onClick={() => coverInputRef.current?.click()}>
                  <Icon.Camera />
                  <div className="exp-empty-title">대표 사진을 올려주세요</div>
                  <div className="exp-empty-sub">JPG · PNG · 소비기한이 보이게</div>
                  <div className="btn primary sm" style={{ marginTop: 14 }}>파일 선택</div>
                </button>
              ) : (
                <div className="exp-shot">
                  <Photo label="대표 사진" src={cover.url} />
                  <button className="exp-replace" onClick={() => coverInputRef.current?.click()}>다시 올리기</button>
                </div>
              )}
            </div>
          </section>

          <section className="register-card">
            <div className="card-head">
              <div>
                <div className="eyebrow">STEP 2 · 선택</div>
                <h3 className="card-title">추가 사진</h3>
              </div>
              <span className="card-counter font-en">{photos.length} / 4</span>
            </div>
            <p className="card-help">제품 앞면·뒷면·라벨 등을 보여주면 신뢰도가 올라가요.</p>

            <div className="photo-grid">
              {photos.map((p) => (
                <div className="reg-photo" key={p.id}>
                  <Photo label="" src={p.url} ratio="1/1" />
                  <button className="reg-photo-del" onClick={() => removePhoto(p.id)} aria-label="삭제"><Icon.X /></button>
                </div>
              ))}
              {photos.length < 4 && (
                <button className="reg-photo-add" onClick={() => moreInputRef.current?.click()}>
                  <Icon.Plus />
                  <span>추가</span>
                </button>
              )}
            </div>
          </section>
        </div>

        {/* ============ RIGHT: form ============ */}
        <div>
          <section className="register-card">
            <div className="card-head">
              <div>
                <div className="eyebrow">STEP 3 · 필수</div>
                <h3 className="card-title">물품 정보</h3>
              </div>
            </div>

            <div className="label">물품 이름</div>
            <input className="field-input" value={foodName} onChange={(e) => setFoodName(e.target.value)}
              placeholder="예) 미개봉 시리얼" maxLength={30} />
            <div style={{ textAlign: "right", fontSize: 11, color: "var(--ink-4)", marginTop: 4, fontFamily: "var(--font-en)" }}>
              {foodName.length} / 30
            </div>

            <div className="label" style={{ marginTop: 18, display: "flex", justifyContent: "space-between" }}>
              <span>정원 수 <span className="hint">(나눠 받을 인원)</span></span>
              <span className="hint">최대 10명</span>
            </div>
            <div className="capacity-stepper">
              <button className="cap-btn" onClick={() => setCapacity((c) => Math.max(1, c - 1))} aria-label="감소"><Icon.Minus /></button>
              <div className="cap-value">
                <span className="font-en">{capacity}</span>
                <span style={{ fontSize: 14, color: "var(--ink-4)", fontWeight: 500 }}>명</span>
              </div>
              <button className="cap-btn" onClick={() => setCapacity((c) => Math.min(10, c + 1))} aria-label="증가"><Icon.Plus /></button>
            </div>

            <div className="label" style={{ marginTop: 18 }}>
              동네 <span className="hint">(선택 · 거래 희망 지역)</span>
            </div>
            <input className="field-input" value={region} onChange={(e) => setRegion(e.target.value)}
              placeholder="예) 서울 강남구 역삼동" maxLength={40} />

            <div className="label" style={{ marginTop: 18 }}>
              상세 내용 <span className="hint">(픽업 방법, 보관 상태 등)</span>
            </div>
            <textarea className="field-input textarea" value={details} onChange={(e) => setDetails(e.target.value)}
              maxLength={500} placeholder="미개봉, 박스째 나눔 OK · 직거래 희망 위치 · 보관 상태 등을 적어주세요" />
            <div style={{ textAlign: "right", fontSize: 11, color: "var(--ink-4)", marginTop: 4, fontFamily: "var(--font-en)" }}>
              {details.length} / 500
            </div>
          </section>

          <div className="register-rules">
            <Icon.Lock style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <b>등록 규칙</b>
              <ul>
                <li>가공·미개봉 식품만 등록해주세요 (직접 만든 음식·신선식품 ✕)</li>
                <li>소비기한은 대표 사진을 AI가 읽어 자동 설정 · 사용자 수정 불가</li>
                <li>회원당 활성 물품 등록 수에는 한도가 있어요</li>
              </ul>
            </div>
          </div>

          <FormError>{submitError}</FormError>

          <div className="register-cta">
            <button className="btn ghost lg" onClick={() => router.push("/")}>취소</button>
            <button className="btn primary lg" style={{ flex: 1 }} disabled={!canSubmit} onClick={submitFood}>
              {busy ? (progress || "등록 중…") : !cover ? "대표 사진을 먼저 올려주세요" : !foodName.trim() ? "물품 이름을 입력해주세요" : !details.trim() ? "상세 내용을 입력해주세요" : "등록하기"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .register { padding-bottom: 60px; }
        .register-head { display: flex; align-items: center; gap: 16px; padding: 16px 32px; max-width: 1280px; margin: 0 auto; }
        .register-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
        .register-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 0 32px; max-width: 1280px; margin: 0 auto; }
        .register-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); padding: 22px 24px; margin-bottom: 16px; box-shadow: var(--shadow-card); }
        .card-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }
        .card-title { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; margin-top: 2px; }
        .card-help { font-size: 12.5px; color: var(--ink-3); margin-top: 8px; margin-bottom: 14px; line-height: 1.55; }
        .card-counter { font-size: 12px; color: var(--ink-3); }
        .ai-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--accent-100); color: var(--accent-700); border-radius: 999px; font-size: 11.5px; font-weight: 700; }
        .exp-upload { margin-bottom: 4px; }
        .exp-empty { width: 100%; aspect-ratio: 4/3; padding: 0; border-radius: var(--r-img); border: 1.5px dashed var(--line-2); background: var(--surface-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--ink-3); transition: all 0.12s; }
        .exp-empty:hover { border-color: var(--primary); background: var(--primary-50); }
        .exp-empty svg { width: 32px; height: 32px; color: var(--ink-4); }
        .exp-empty-title { font-size: 14px; font-weight: 600; color: var(--ink-2); margin-top: 6px; }
        .exp-empty-sub { font-size: 11.5px; color: var(--ink-4); }
        .exp-shot { position: relative; }
        .exp-shot .ph { aspect-ratio: 4/3; }
        .exp-replace { position: absolute; top: 10px; right: 10px; padding: 5px 10px; background: rgba(31,29,24,0.78); color: var(--bg); border-radius: 6px; font-size: 11.5px; font-weight: 600; backdrop-filter: blur(6px); }
        .exp-replace:hover { background: var(--ink); }
        .photo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .reg-photo { position: relative; aspect-ratio: 1/1; }
        .reg-photo .ph { border-radius: 10px; width: 100%; height: 100%; }
        .reg-photo-del { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; background: rgba(31,29,24,0.78); color: #fff; border-radius: 50%; display: grid; place-items: center; }
        .reg-photo-del svg { width: 12px; height: 12px; }
        .reg-photo-add { aspect-ratio: 1/1; padding: 0; background: var(--surface-2); border: 1.5px dashed var(--line-2); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--ink-3); font-size: 11px; }
        .reg-photo-add:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-50); }
        .capacity-stepper { display: flex; align-items: center; gap: 12px; padding: 4px; background: var(--bg-2); border-radius: var(--r-btn); width: fit-content; }
        .cap-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--surface); border: 1px solid var(--line); color: var(--ink); display: grid; place-items: center; }
        .cap-btn:hover { border-color: var(--primary); color: var(--primary); }
        .cap-value { min-width: 80px; font-size: 22px; font-weight: 700; text-align: center; display: inline-flex; align-items: baseline; gap: 4px; justify-content: center; }
        .register-rules { display: flex; gap: 10px; padding: 14px 16px; background: var(--primary-50); border: 1px solid var(--primary-100); border-radius: var(--r-card); color: var(--primary-700); font-size: 12.5px; line-height: 1.6; margin-bottom: 16px; }
        .register-rules svg { color: var(--primary); }
        .register-rules b { font-weight: 700; display: block; margin-bottom: 4px; color: var(--ink); }
        .register-rules ul { padding-left: 14px; color: var(--ink-3); font-size: 12px; }
        .register-rules li { list-style: disc; margin-top: 2px; }
        .register-cta { display: flex; gap: 8px; }
        @media (max-width: 900px) {
          .register-head { padding: 12px 16px; flex-wrap: wrap; gap: 10px; }
          .register-title { font-size: 18px; }
          .register-grid { grid-template-columns: 1fr; gap: 0; padding: 0 16px; }
          .register-card { padding: 18px 16px; }
          .photo-grid { grid-template-columns: repeat(3, 1fr); }
          .register-cta { flex-direction: column; }
          .register-cta .btn { width: 100%; }
        }
      `}</style>
    </div>
  );
}

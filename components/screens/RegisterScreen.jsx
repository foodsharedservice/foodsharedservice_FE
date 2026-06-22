"use client";

/* RegisterScreen.jsx — 나눔 등록
   API: POST /foods (multipart: request{foodName,capacity,details,region} + file)
        → 서버가 file(소비기한이 보이는 사진)에서 AI로 소비기한을 읽어 자동 설정.
        추가 사진은 POST /foods/expired-date/{foodId} 로 등록 후 업로드.
   실제 파일 업로드 + 실제 API 호출. */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Photo, FormError } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

export default function RegisterScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const mainRef = useRef(null);
  const moreRef = useRef(null);

  const [mainPhoto, setMainPhoto] = useState(null); // { url, file }
  const [morePhotos, setMorePhotos] = useState([]); // { id, url, file }
  const [foodName, setFoodName] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [details, setDetails] = useState("");
  const [region, setRegion] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // 등록자 지역 기본값: 내 프로필 주소
  useEffect(() => {
    if (user && user.address && user.address.roadAddress && !region) {
      setRegion(user.address.roadAddress);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPickMain = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setMainPhoto({ url: URL.createObjectURL(file), file });
    if (e.target) e.target.value = "";
  };

  const onPickMore = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setMorePhotos((prev) => {
      const room = Math.max(0, 4 - prev.length);
      const added = files.slice(0, room).map((file) => ({ id: `${Date.now()}-${Math.random()}`, url: URL.createObjectURL(file), file }));
      return [...prev, ...added];
    });
    if (e.target) e.target.value = "";
  };

  const removeMore = (id) => setMorePhotos((prev) => prev.filter((p) => p.id !== id));

  const canSubmit = mainPhoto && foodName.trim() && details.trim() && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    setBusy(true);
    try {
      const created = await API.foods.create({
        foodName: foodName.trim(),
        capacity,
        details: details.trim(),
        region: region.trim() || undefined,
        file: mainPhoto.file,
      });
      const foodId = created && created.foodId;
      // 추가 사진 업로드 (실패해도 등록 자체는 완료)
      if (foodId && morePhotos.length) {
        for (const p of morePhotos) {
          try { await API.foods.uploadExpiredImage(foodId, p.file); } catch { /* skip */ }
        }
      }
      router.push(foodId ? `/foods/${foodId}` : "/");
    } catch (err) {
      const code = err.code || "";
      let msg;
      if (code.includes("EXPIR")) msg = "사진에서 소비기한을 읽지 못했어요. 소비기한이 또렷하게 보이는 사진으로 다시 시도해주세요.";
      else {
        const map = {
          FOOD_LIMIT_EXCEEDED: "등록 가능한 나눔 개수를 초과했어요.",
          INVALID_FILE_FORMAT: "지원하지 않는 이미지 형식이에요.",
          EMPTY_FILE: "사진을 첨부해주세요.",
          IMAGE_STORAGE_ERROR: "이미지 저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
          VALIDATION_FAILED: "입력값을 확인해주세요.",
        };
        msg = map[code] || err.message || "등록에 실패했어요.";
      }
      setSubmitError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="register">
      <input ref={mainRef} type="file" accept="image/*" hidden onChange={onPickMain} />
      <input ref={moreRef} type="file" accept="image/*" multiple hidden onChange={onPickMore} />

      <div className="register-head">
        <button className="crumb-back" onClick={() => router.push("/")}><Icon.ChevronLeft /> 돌아가기</button>
        <h1 className="register-title">나눔 등록</h1>
      </div>

      <div className="register-grid">
        {/* LEFT: photos */}
        <div>
          <section className="rcard">
            <div className="rcard-head">
              <h3 className="rcard-title">대표 사진 <span className="req">*</span></h3>
              <div className="ai-chip"><Icon.Sparkle /> 소비기한 AI 인식</div>
            </div>
            <p className="rcard-help">소비기한(또는 유통기한)이 <b>또렷하게 보이는</b> 사진을 올려주세요. AI가 날짜를 읽어 자동으로 설정해요.</p>
            {!mainPhoto ? (
              <button className="photo-empty" onClick={() => mainRef.current?.click()}>
                <Icon.Camera />
                <div className="pe-title">대표 사진 올리기</div>
                <div className="pe-sub">JPG · PNG</div>
              </button>
            ) : (
              <div className="photo-main">
                <Photo label="" src={mainPhoto.url} ratio="1/1" />
                <button className="photo-replace" onClick={() => mainRef.current?.click()}>변경</button>
              </div>
            )}
          </section>

          <section className="rcard">
            <div className="rcard-head">
              <h3 className="rcard-title">추가 사진</h3>
              <span className="font-en" style={{ color: "var(--ink-4)", fontSize: 12.5 }}>{morePhotos.length}/4</span>
            </div>
            <p className="rcard-help">제품 상태를 보여주는 사진을 더 올리면 좋아요. (선택)</p>
            <div className="more-grid">
              {morePhotos.map((p) => (
                <div className="more-cell" key={p.id}>
                  <Photo label="" src={p.url} ratio="1/1" />
                  <button className="more-del" onClick={() => removeMore(p.id)} aria-label="삭제"><Icon.X /></button>
                </div>
              ))}
              {morePhotos.length < 4 && (
                <button className="more-add" onClick={() => moreRef.current?.click()}><Icon.Plus /><span>추가</span></button>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT: form */}
        <div>
          <section className="rcard">
            <h3 className="rcard-title" style={{ marginBottom: 16 }}>나눔 정보</h3>

            <div className="label">물품 이름 <span className="req">*</span></div>
            <input className="field-input" value={foodName} maxLength={30}
              onChange={(e) => setFoodName(e.target.value)} placeholder="예) 미개봉 시리얼, 새 보조배터리" />

            <div className="label" style={{ marginTop: 18, display: "flex", justifyContent: "space-between" }}>
              <span>모집 인원 <span className="hint">(나눠 받을 인원)</span></span>
            </div>
            <div className="stepper">
              <button className="step-btn" onClick={() => setCapacity((c) => Math.max(1, c - 1))} aria-label="감소"><Icon.Minus /></button>
              <div className="step-val"><span className="font-en">{capacity}</span><span style={{ fontSize: 14, color: "var(--ink-4)", fontWeight: 500 }}>명</span></div>
              <button className="step-btn" onClick={() => setCapacity((c) => Math.min(20, c + 1))} aria-label="증가"><Icon.Plus /></button>
            </div>

            <div className="label" style={{ marginTop: 18 }}>지역 <span className="hint">(선택)</span></div>
            <input className="field-input" value={region} onChange={(e) => setRegion(e.target.value)}
              placeholder="예) 서울 강남구 역삼동" maxLength={60} />

            <div className="label" style={{ marginTop: 18 }}>상세 내용 <span className="req">*</span></div>
            <textarea className="field-input textarea" value={details} maxLength={500}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="제품 상태, 픽업 방법, 보관 상태 등을 적어주세요." />
            <div style={{ textAlign: "right", fontSize: 11, color: "var(--ink-4)", marginTop: 4 }} className="font-en">{details.length}/500</div>
          </section>

          <FormError>{submitError}</FormError>

          <div className="register-cta">
            <button className="btn ghost lg" onClick={() => router.push("/")}>취소</button>
            <button className="btn primary lg" style={{ flex: 1 }} disabled={!canSubmit} onClick={submit}>
              {busy ? "등록 중…" : !mainPhoto ? "대표 사진을 올려주세요" : !foodName.trim() ? "물품 이름을 입력해주세요" : !details.trim() ? "상세 내용을 입력해주세요" : "나눔 등록하기"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .register { max-width: 980px; margin: 0 auto; padding: 0 24px 60px; }
        .register-head { display: flex; align-items: center; gap: 14px; padding: 16px 0; }
        .register-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
        .register-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 22px; }
        .rcard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); padding: 20px; margin-bottom: 16px; }
        .rcard-head { display: flex; align-items: center; justify-content: space-between; }
        .rcard-title { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
        .req { color: var(--primary); }
        .rcard-help { font-size: 12.5px; color: var(--ink-3); margin: 8px 0 14px; line-height: 1.55; }
        .ai-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--primary-50); color: var(--primary-700); border-radius: 999px; font-size: 11.5px; font-weight: 700; }
        .photo-empty { width: 100%; aspect-ratio: 1/1; border: 1.5px dashed var(--line-2); border-radius: var(--r-img); background: var(--surface-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--ink-4); }
        .photo-empty:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-50); }
        .photo-empty svg { width: 30px; height: 30px; }
        .pe-title { font-size: 14px; font-weight: 700; color: var(--ink-2); }
        .pe-sub { font-size: 11.5px; }
        .photo-main { position: relative; }
        .photo-replace { position: absolute; top: 10px; right: 10px; padding: 5px 12px; background: rgba(0,0,0,0.7); color: #fff; border-radius: 7px; font-size: 12px; font-weight: 600; }
        .more-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .more-cell { position: relative; }
        .more-cell .ph { border-radius: 8px; }
        .more-del { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; background: rgba(0,0,0,0.7); color: #fff; border-radius: 50%; display: grid; place-items: center; }
        .more-del svg { width: 12px; height: 12px; }
        .more-add { aspect-ratio: 1/1; border: 1.5px dashed var(--line-2); border-radius: 8px; background: var(--surface-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--ink-4); font-size: 11px; }
        .more-add:hover { border-color: var(--primary); color: var(--primary); }
        .stepper { display: flex; align-items: center; gap: 12px; padding: 4px; background: var(--bg-2); border-radius: var(--r-btn); width: fit-content; }
        .step-btn { width: 38px; height: 38px; border-radius: 8px; background: var(--surface); border: 1px solid var(--line-2); display: grid; place-items: center; }
        .step-btn:hover { border-color: var(--primary); color: var(--primary); }
        .step-val { min-width: 84px; text-align: center; font-size: 22px; font-weight: 800; display: inline-flex; gap: 4px; align-items: baseline; justify-content: center; }
        .register-cta { display: flex; gap: 8px; }
        @media (max-width: 900px) {
          .register { padding: 0 14px 50px; }
          .register-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

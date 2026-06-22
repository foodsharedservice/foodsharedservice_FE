"use client";

/* RegisterScreen.jsx — D-04 물품 등록 (실제 API v3)

   1) 소비기한 사진 업로드 → POST /foods/expired-date (multipart: expiredImage)
      → { expired }  (AI가 날짜만 인식, 사진은 아직 저장 X)
   2) 등록 → POST /foods (multipart)
      request: { foodName, capacity, details, expired(=1에서 받은 인식값) }
      expiredImage: 소비기한 사진(필수) · images: 일반 사진(선택, 다중)
      → { foodId } */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { Photo, FormError } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

export default function RegisterScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const coverInputRef = useRef(null);
  const moreInputRef = useRef(null);

  const [cover, setCover] = useState(null); // 소비기한 사진 { url, file }
  const [aiState, setAiState] = useState("empty"); // empty | loading | done | error
  const [expDate, setExpDate] = useState(null); // AI 인식 소비기한
  const [aiError, setAiError] = useState(null);

  const [photos, setPhotos] = useState([]); // 일반 사진 { id, url, file }
  const [foodName, setFoodName] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [details, setDetails] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // 소비기한 사진 선택 → 즉시 AI 인식 호출
  const onPickCover = (e) => {
    const file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setCover({ url: URL.createObjectURL(file), file });
    setAiError(null);
    setExpDate(null);
    setAiState("loading");
    API.foods.recognizeExpiry(file)
      .then((data) => {
        if (data && data.expired) {
          setExpDate(data.expired);
          setAiState("done");
        } else {
          setAiError("소비기한을 인식하지 못했어요. 더 선명한 사진으로 다시 시도해주세요.");
          setAiState("error");
        }
      })
      .catch((err) => {
        const map = {
          EXPIRED_DATE_NOT_DETECTED: "소비기한을 인식하지 못했어요. 날짜가 잘 보이게 다시 찍어주세요.",
          AI_REQUEST_FAILED: "AI 인식 요청에 실패했어요. 잠시 후 다시 시도해주세요.",
          FILE_TOO_LARGE: "파일 용량이 너무 커요.",
          UNSUPPORTED_FILE_TYPE: "지원하지 않는 사진 형식이에요. (JPG/PNG)",
        };
        setAiError(map[err.code] || err.message || "소비기한 인식에 실패했어요.");
        setAiState("error");
      });
  };

  const resetCover = () => {
    setCover(null);
    setExpDate(null);
    setAiError(null);
    setAiState("empty");
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

  const canSubmit =
    !!cover && aiState === "done" && !!expDate &&
    foodName.trim().length > 0 && details.trim().length > 0 && !busy;

  const submitFood = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    setBusy(true);
    try {
      const res = await API.foods.create(
        { foodName: foodName.trim(), capacity, details: details.trim(), expired: expDate },
        cover.file,
        photos.map((p) => p.file)
      );
      const foodId = res && res.foodId;
      if (foodId) router.push(`/foods/${foodId}`);
      else router.push("/");
    } catch (err) {
      const map = {
        FOOD_LIMIT_EXCEEDED: "활성 물품은 최대 10개까지 등록할 수 있어요.",
        EXPIRED_IMAGE_REQUIRED: "소비기한 사진을 다시 등록해주세요.",
        FILE_TOO_LARGE: "파일 용량이 너무 커요.",
        UNSUPPORTED_FILE_TYPE: "지원하지 않는 사진 형식이에요. (JPG/PNG)",
        VALIDATION_FAILED: "입력값을 확인해주세요.",
      };
      setSubmitError(map[err.code] || err.message || "등록에 실패했어요.");
    } finally {
      setBusy(false);
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
        {/* ============ LEFT: 소비기한 사진 + AI ============ */}
        <div>
          <section className="register-card">
            <div className="card-head">
              <div>
                <div className="eyebrow">STEP 1 · 필수</div>
                <h3 className="card-title">소비기한 사진</h3>
              </div>
              <div className="ai-chip"><Icon.Sparkle /> AI 자동 인식</div>
            </div>
            <p className="card-help">
              가공식품 라벨의 <b>소비기한이 잘 보이도록</b> 찍어주세요. 사진을 올리면 AI가 소비기한을 자동으로 읽어 설정해요.
            </p>

            <div className="exp-upload">
              {!cover ? (
                <button className="exp-empty" onClick={() => coverInputRef.current?.click()}>
                  <Icon.Camera />
                  <div className="exp-empty-title">소비기한 사진을 올려주세요</div>
                  <div className="exp-empty-sub">JPG · PNG · 소비기한이 보이게</div>
                  <div className="btn primary sm" style={{ marginTop: 14 }}>파일 선택</div>
                </button>
              ) : (
                <div className="exp-shot">
                  <Photo label="소비기한 사진" src={cover.url} />
                  <button className="exp-replace" onClick={() => coverInputRef.current?.click()}>다시 올리기</button>
                </div>
              )}
            </div>

            {/* AI 인식 결과 카드 */}
            <div className={`ai-result ${aiState}`}>
              {aiState === "empty" && (
                <div className="ai-empty">
                  <div className="ai-icon"><Icon.Sparkle /></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>소비기한 인식 대기 중</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>사진을 올리면 자동으로 인식해요</div>
                  </div>
                </div>
              )}
              {aiState === "loading" && (
                <div className="ai-loading">
                  <div className="ai-spin"></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>AI가 소비기한을 읽는 중…</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>보통 2-5초 정도 걸려요</div>
                  </div>
                </div>
              )}
              {aiState === "done" && (
                <div className="ai-done">
                  <div className="ai-done-row">
                    <div className="eyebrow" style={{ color: "var(--primary)" }}>
                      AI 인식 결과 <Icon.Lock style={{ verticalAlign: "middle", marginLeft: 2 }} />
                    </div>
                  </div>
                  <div className="ai-date font-en">{expDate}</div>
                  <div className="ai-hint">
                    인식이 잘못됐다면 사진을 다시 올려주세요.<br />
                    소비기한은 사용자가 임의로 수정할 수 없어요.
                  </div>
                </div>
              )}
              {aiState === "error" && (
                <div className="ai-empty">
                  <div className="ai-icon err">!</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--danger)" }}>소비기한 인식 실패</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{aiError}</div>
                    <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => coverInputRef.current?.click()}>다시 올리기</button>
                  </div>
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
                <li>소비기한은 사진을 AI가 읽어 자동 설정 · 사용자 수정 불가</li>
                <li>회원당 활성 물품은 최대 10개</li>
              </ul>
            </div>
          </div>

          <FormError>{submitError}</FormError>

          <div className="register-cta">
            <button className="btn ghost lg" onClick={() => router.push("/")}>취소</button>
            <button className="btn primary lg" style={{ flex: 1 }} disabled={!canSubmit} onClick={submitFood}>
              {busy ? "등록 중…"
                : !cover ? "소비기한 사진을 먼저 올려주세요"
                : aiState === "loading" ? "소비기한 인식 중…"
                : aiState !== "done" ? "소비기한 사진을 다시 올려주세요"
                : !foodName.trim() ? "물품 이름을 입력해주세요"
                : !details.trim() ? "상세 내용을 입력해주세요"
                : "등록하기"}
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
        .exp-upload { margin-bottom: 12px; }
        .exp-empty { width: 100%; aspect-ratio: 4/3; padding: 0; border-radius: var(--r-img); border: 1.5px dashed var(--line-2); background: var(--surface-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--ink-3); transition: all 0.12s; }
        .exp-empty:hover { border-color: var(--primary); background: var(--primary-50); }
        .exp-empty svg { width: 32px; height: 32px; color: var(--ink-4); }
        .exp-empty-title { font-size: 14px; font-weight: 600; color: var(--ink-2); margin-top: 6px; }
        .exp-empty-sub { font-size: 11.5px; color: var(--ink-4); font-family: var(--font-en); }
        .exp-shot { position: relative; }
        .exp-shot .ph { aspect-ratio: 4/3; }
        .exp-replace { position: absolute; top: 10px; right: 10px; padding: 5px 10px; background: rgba(31,29,24,0.78); color: var(--bg); border-radius: 6px; font-size: 11.5px; font-weight: 600; backdrop-filter: blur(6px); }
        .exp-replace:hover { background: var(--ink); }
        .ai-result { border-radius: 10px; padding: 14px 16px; transition: all 0.2s ease; }
        .ai-result.empty { background: var(--bg-2); border: 1px dashed var(--line-2); }
        .ai-result.loading { background: var(--primary-50); border: 1px solid var(--primary-100); }
        .ai-result.done { background: linear-gradient(135deg, var(--accent-50), var(--surface-2)); border: 1px solid var(--accent-100); }
        .ai-result.error { background: var(--danger-100); border: 1px solid var(--danger-100); }
        .ai-empty, .ai-loading { display: flex; align-items: center; gap: 12px; }
        .ai-icon { width: 32px; height: 32px; background: var(--ink-5); color: var(--surface); border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; }
        .ai-icon.err { background: var(--danger); color: #fff; font-weight: 800; }
        .ai-spin { width: 28px; height: 28px; border: 2.5px solid var(--primary-100); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ai-done-row { display: flex; align-items: center; justify-content: space-between; }
        .ai-date { font-family: var(--font-en); font-size: 30px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); margin-top: 4px; font-variant-numeric: tabular-nums; }
        .ai-hint { font-size: 11.5px; color: var(--ink-3); margin-top: 8px; line-height: 1.55; }
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
          .ai-date { font-size: 24px; }
        }
      `}</style>
    </div>
  );
}

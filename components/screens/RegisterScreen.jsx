"use client";

/* RegisterScreen.jsx — 물품 등록
   manus 참고 디자인(FoodNew.tsx) 그대로 포팅 + 실제 API 연결.
   1) 소비기한 사진 업로드 → POST /foods/expired-date (AI 날짜 인식)
   2) 등록 → POST /foods (multipart: request + expiredImage + images[]) */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Sparkles, X, ImagePlus, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

const INPUT =
  "w-full h-11 rounded-xl border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber transition";
const CARD = "bg-card rounded-2xl p-6 border border-border";
const CARD_SHADOW = { boxShadow: "0 2px 12px oklch(0.70 0.16 55 / 0.06)" };

export default function RegisterScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const expiredInputRef = useRef(null);
  const imagesInputRef = useRef(null);

  const [cover, setCover] = useState(null); // { url, file }
  const [aiState, setAiState] = useState("empty"); // empty | loading | done | error
  const [expDate, setExpDate] = useState(null);
  const [aiError, setAiError] = useState(null);

  const [photos, setPhotos] = useState([]); // { id, url, file }
  const [foodName, setFoodName] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [details, setDetails] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

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
        if (data && data.expired) { setExpDate(data.expired); setAiState("done"); }
        else { setAiError("소비기한을 인식하지 못했어요. 더 선명한 사진으로 다시 시도해주세요."); setAiState("error"); }
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

  const resetCover = () => { setCover(null); setExpDate(null); setAiError(null); setAiState("empty"); };

  const onPickMore = (e) => {
    const files = Array.from(e.target.files || []);
    if (e.target) e.target.value = "";
    if (!files.length) return;
    setPhotos((prev) => {
      const room = Math.max(0, 5 - prev.length);
      const added = files.slice(0, room).map((file) => ({
        id: `${Date.now()}-${file.name}-${Math.random()}`,
        url: URL.createObjectURL(file),
        file,
      }));
      return [...prev, ...added];
    });
  };

  const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  const canSubmit =
    !!cover && aiState === "done" && !!expDate &&
    foodName.trim().length > 0 && details.trim().length > 0 && !busy;

  const submitFood = async (e) => {
    if (e) e.preventDefault();
    if (!canSubmit) {
      if (!cover) setSubmitError("소비기한 사진을 업로드해주세요.");
      return;
    }
    setSubmitError(null);
    setBusy(true);
    try {
      const res = await API.foods.create(
        { foodName: foodName.trim(), capacity, details: details.trim(), expired: expDate },
        cover.file,
        photos.map((p) => p.file)
      );
      const foodId = res && res.foodId;
      router.push(foodId ? `/foods/${foodId}` : "/");
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
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="container py-8 max-w-2xl">
        <input ref={expiredInputRef} type="file" accept="image/*" hidden onChange={onPickCover} />
        <input ref={imagesInputRef} type="file" accept="image/*" multiple hidden onChange={onPickMore} />

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-foreground mb-2">물품 등록</h1>
          <p className="text-muted-foreground">미개봉 가공식품을 이웃과 나눠보세요</p>
        </div>

        <form onSubmit={submitFood} className="space-y-8">
          {/* Step 1: 소비기한 사진 */}
          <div className={CARD} style={CARD_SHADOW}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-amber text-white flex items-center justify-center text-sm font-bold">1</div>
              <h2 className="text-lg font-bold text-foreground">소비기한 사진 업로드</h2>
              <span className="text-xs text-destructive font-medium">필수</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              소비기한이 잘 보이는 사진을 업로드하면 AI가 날짜를 자동으로 인식합니다.
            </p>

            {!cover ? (
              <button type="button" onClick={() => expiredInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 hover:border-amber hover:bg-amber/5 transition-all group">
                <div className="w-14 h-14 rounded-2xl bg-amber/10 flex items-center justify-center group-hover:bg-amber/20 transition-colors">
                  <Camera className="w-7 h-7 text-amber" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">소비기한 사진 업로드</p>
                  <p className="text-sm text-muted-foreground mt-1">클릭해서 사진을 선택하세요</p>
                </div>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
                  <img src={cover.url} alt="소비기한" className="w-full h-full object-cover" />
                  <button type="button" onClick={resetCover}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {aiState === "loading" && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-amber animate-pulse" />
                        <span className="text-sm font-medium">AI 소비기한 인식 중...</span>
                      </div>
                    </div>
                  )}
                </div>

                {aiState === "done" && expDate && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-xl p-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">소비기한 인식 완료</p>
                      <p className="text-xs">인식된 날짜: {expDate}</p>
                    </div>
                  </div>
                )}
                {aiState === "error" && (
                  <div className="flex items-center gap-2 bg-red-50 text-destructive rounded-xl p-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">소비기한 인식 실패</p>
                      <p className="text-xs">{aiError}</p>
                    </div>
                    <button type="button" onClick={() => expiredInputRef.current?.click()}
                      className="text-xs font-semibold text-amber hover:text-amber-dark">다시 올리기</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: 물품 정보 */}
          <div className={CARD} style={CARD_SHADOW}>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-full bg-amber text-white flex items-center justify-center text-sm font-bold">2</div>
              <h2 className="text-lg font-bold text-foreground">물품 정보 입력</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="foodName" className="text-sm font-medium text-foreground">물품 이름 <span className="text-destructive">*</span></label>
                <input id="foodName" placeholder="예: 미개봉 허니넛 시리얼" maxLength={30} className={INPUT}
                  value={foodName} onChange={(e) => setFoodName(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="capacity" className="text-sm font-medium text-foreground">나눔 인원 <span className="text-destructive">*</span></label>
                  <input id="capacity" type="number" min={1} max={10} className={INPUT}
                    value={capacity}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setCapacity(Number.isNaN(n) ? "" : Math.max(1, Math.min(10, n)));
                    }} />
                  <p className="text-xs text-muted-foreground">1~10명</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="expired" className="text-sm font-medium text-foreground">소비기한 <span className="text-destructive">*</span></label>
                  <input id="expired" readOnly placeholder="사진 업로드 시 자동 인식"
                    className={`${INPUT} bg-muted/60 cursor-not-allowed`} value={expDate || ""} />
                  <p className="text-xs text-muted-foreground">AI가 자동 인식 · 직접 수정 불가</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="details" className="text-sm font-medium text-foreground">물품 설명 <span className="text-destructive">*</span></label>
                <textarea id="details" rows={4} maxLength={500}
                  placeholder="물품 상태, 수령 방법, 위치 등을 자유롭게 적어주세요."
                  className={`${INPUT} h-auto py-3 resize-none leading-relaxed`}
                  value={details} onChange={(e) => setDetails(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Step 3: 추가 사진 */}
          <div className={CARD} style={CARD_SHADOW}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold">3</div>
              <h2 className="text-lg font-bold text-foreground">물품 사진 추가</h2>
              <span className="text-xs text-muted-foreground">(선택, 최대 5장)</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">물품의 실제 모습을 보여주는 사진을 추가하세요.</p>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(p.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <button type="button" onClick={() => imagesInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-amber hover:bg-amber/5 transition-all">
                  <ImagePlus className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">추가</span>
                </button>
              )}
            </div>
          </div>

          {/* Notice */}
          <div className="flex items-start gap-3 bg-amber/10 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-amber flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-foreground mb-1">등록 전 확인해주세요</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs">
                <li>• 가공식품 및 미개봉 식품만 등록 가능합니다</li>
                <li>• 소비기한은 사진을 AI가 읽어 자동 설정 · 수정 불가</li>
                <li>• 회원당 최대 10개의 활성 물품을 등록할 수 있습니다</li>
              </ul>
            </div>
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={() => router.push("/")}
              className="flex-1 h-12 inline-flex items-center justify-center rounded-xl border border-border bg-card text-foreground font-medium hover:bg-muted transition-colors">취소</button>
            <button type="submit" disabled={!canSubmit}
              className="flex-1 h-12 inline-flex items-center justify-center gap-2 bg-amber text-white hover:bg-amber-dark shadow-warm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none">
              {busy ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 등록 중...</span> : "물품 등록하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

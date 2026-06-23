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
import {
  ChevronLeft,
  Camera,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Plus,
  Minus,
  ImagePlus,
  X,
  CheckCircle2,
} from "lucide-react";
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
    <div className="min-h-screen bg-background pt-20">
      <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={onPickCover} />
      <input ref={moreInputRef} type="file" accept="image/*" multiple hidden onChange={onPickMore} />

      <div className="container py-8 max-w-2xl">
        {/* Page header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ChevronLeft className="w-4 h-4" /> 돌아가기
          </button>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">물품 등록</h1>
          <p className="text-muted-foreground">미개봉 가공식품을 이웃과 나눠보세요</p>
        </div>

        <div className="space-y-8">
          {/* Step 1: 소비기한 사진 업로드 (AI) */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-warm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-amber text-white flex items-center justify-center text-sm font-bold">1</div>
              <h2 className="text-lg font-bold text-foreground">소비기한 사진 업로드</h2>
              <span className="text-xs text-destructive font-medium">필수</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              소비기한이 잘 보이는 사진을 업로드하면 AI가 날짜를 자동으로 인식합니다.
            </p>

            {!cover ? (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 hover:border-amber hover:bg-amber/5 transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber/10 flex items-center justify-center group-hover:bg-amber/20 transition-colors">
                  <Camera className="w-7 h-7 text-amber" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">소비기한 사진 업로드</p>
                  <p className="text-sm text-muted-foreground mt-1">클릭하거나 사진을 드래그하세요</p>
                </div>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
                  <Photo label="소비기한 사진" src={cover.url} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={resetCover}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 z-10"
                    aria-label="삭제"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {aiState === "loading" && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                      <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-amber animate-pulse" />
                        <span className="text-sm font-medium">AI 소비기한 인식 중...</span>
                      </div>
                    </div>
                  )}
                </div>

                {aiState === "done" && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-xl p-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">소비기한 인식 완료</p>
                      <p className="text-xs font-en">인식된 날짜: {expDate}</p>
                    </div>
                  </div>
                )}

                {aiState === "error" && (
                  <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-xl p-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">소비기한 인식 실패</p>
                      <p className="text-xs mt-0.5">{aiError}</p>
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="mt-2 inline-flex items-center h-8 px-3 rounded-lg border border-border bg-card text-foreground text-xs font-medium hover:border-amber hover:text-amber transition-colors"
                      >
                        다시 올리기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: 물품 정보 입력 */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-warm">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-full bg-amber text-white flex items-center justify-center text-sm font-bold">2</div>
              <h2 className="text-lg font-bold text-foreground">물품 정보 입력</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="foodName" className="text-sm font-medium text-foreground">
                  물품 이름 <span className="text-destructive">*</span>
                </label>
                <input
                  id="foodName"
                  className="w-full h-11 px-3 rounded-xl border border-border bg-card focus:border-amber focus:outline-none"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="예) 미개봉 시리얼"
                  maxLength={30}
                />
                <div className="text-right text-xs text-muted-foreground font-en">{foodName.length} / 30</div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    정원 수 <span className="text-muted-foreground font-normal">(나눠 받을 인원)</span>
                  </label>
                  <span className="text-xs text-muted-foreground">최대 10명</span>
                </div>
                <div className="inline-flex items-center gap-3 p-1 rounded-xl border border-border bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setCapacity((c) => Math.max(1, c - 1))}
                    aria-label="감소"
                    className="w-10 h-10 rounded-lg bg-card border border-border text-foreground flex items-center justify-center hover:border-amber hover:text-amber transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="min-w-[64px] flex items-baseline justify-center gap-1">
                    <span className="text-2xl font-bold font-en">{capacity}</span>
                    <span className="text-sm text-muted-foreground font-medium">명</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCapacity((c) => Math.min(10, c + 1))}
                    aria-label="증가"
                    className="w-10 h-10 rounded-lg bg-card border border-border text-foreground flex items-center justify-center hover:border-amber hover:text-amber transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="details" className="text-sm font-medium text-foreground">
                  상세 내용 <span className="text-muted-foreground font-normal">(픽업 방법, 보관 상태 등)</span>
                </label>
                <textarea
                  id="details"
                  className="w-full min-h-[120px] px-3 py-2.5 rounded-xl border border-border bg-card focus:border-amber focus:outline-none resize-none"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={500}
                  placeholder="미개봉, 박스째 나눔 OK · 직거래 희망 위치 · 보관 상태 등을 적어주세요"
                />
                <div className="text-right text-xs text-muted-foreground font-en">{details.length} / 500</div>
              </div>
            </div>
          </div>

          {/* Step 3: 물품 사진 추가 */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-warm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold">3</div>
              <h2 className="text-lg font-bold text-foreground">물품 사진 추가</h2>
              <span className="text-xs text-muted-foreground">(선택, 최대 4장)</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">제품 앞면·뒷면·라벨 등을 보여주면 신뢰도가 올라가요.</p>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <Photo label="" src={p.url} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    aria-label="삭제"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <button
                  type="button"
                  onClick={() => moreInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-amber hover:bg-amber/5 transition-all"
                >
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
              <p className="font-semibold text-foreground mb-1">등록 규칙</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs">
                <li>• 가공·미개봉 식품만 등록해주세요 (직접 만든 음식·신선식품 ✕)</li>
                <li>• 소비기한은 사진을 AI가 읽어 자동 설정 · 사용자 수정 불가</li>
                <li>• 회원당 활성 물품은 최대 10개</li>
              </ul>
            </div>
          </div>

          <FormError>{submitError}</FormError>

          {/* CTA */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex-1 h-12 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted/40 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submitFood}
              className="flex-1 h-12 rounded-xl bg-amber text-white font-semibold shadow-warm hover:bg-amber-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
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
    </div>
  );
}

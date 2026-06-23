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
    <div className="min-h-screen bg-background pb-16">
      <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={onPickCover} />
      <input ref={moreInputRef} type="file" accept="image/*" multiple hidden onChange={onPickMore} />

      <div className="container pt-20 pb-6 sm:pt-24">
        {/* Header row */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 animate-fade-in-up">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full bg-card border border-border text-foreground/80 font-medium hover:border-amber hover:text-amber transition-colors"
          >
            <Icon.ChevronLeft /> 돌아가기
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">물품 등록</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ============ LEFT: 소비기한 사진 + AI ============ */}
          <div className="flex flex-col gap-6">
            {/* STEP 1 — 소비기한 사진 */}
            <section className="bg-card rounded-2xl border border-border shadow-warm p-5 sm:p-6 animate-fade-in-up stagger-1">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <div className="text-xs font-semibold tracking-widest uppercase text-amber">STEP 1 · 필수</div>
                  <h3 className="text-lg font-bold text-foreground mt-1">소비기한 사진</h3>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber/10 text-amber-dark text-xs font-semibold flex-shrink-0">
                  <Icon.Sparkle /> AI 자동 인식
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                가공식품 라벨의 <b className="font-semibold text-foreground">소비기한이 잘 보이도록</b> 찍어주세요. 사진을 올리면 AI가 소비기한을 자동으로 읽어 설정해요.
              </p>

              {/* 업로드 영역 */}
              <div className="mb-4">
                {!cover ? (
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted text-muted-foreground hover:border-amber hover:bg-amber/5 transition-colors"
                  >
                    <Icon.Camera className="w-8 h-8 text-muted-foreground" />
                    <div className="text-sm font-semibold text-foreground mt-1.5">소비기한 사진을 올려주세요</div>
                    <div className="text-xs text-muted-foreground">JPG · PNG · 소비기한이 보이게</div>
                    <span className="inline-flex items-center justify-center gap-2 h-9 px-4 text-sm rounded-full bg-amber text-white font-semibold shadow-warm mt-3">파일 선택</span>
                  </button>
                ) : (
                  <div className="relative">
                    <Photo label="소비기한 사진" src={cover.url} ratio="4/3" className="rounded-xl overflow-hidden" />
                    <button
                      onClick={() => coverInputRef.current?.click()}
                      className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-foreground/75 text-white text-xs font-semibold backdrop-blur-sm hover:bg-foreground transition-colors"
                    >
                      다시 올리기
                    </button>
                  </div>
                )}
              </div>

              {/* AI 인식 결과 카드 */}
              {aiState === "empty" && (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted p-4">
                  <span className="w-8 h-8 rounded-full bg-muted-foreground text-card grid place-items-center flex-shrink-0"><Icon.Sparkle /></span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">소비기한 인식 대기 중</div>
                    <div className="text-xs text-muted-foreground mt-0.5">사진을 올리면 자동으로 인식해요</div>
                  </div>
                </div>
              )}
              {aiState === "loading" && (
                <div className="flex items-center gap-3 rounded-xl border border-amber/30 bg-amber/10 p-4">
                  <span className="w-7 h-7 rounded-full border-[2.5px] border-amber/30 border-t-amber animate-spin flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">AI가 소비기한을 읽는 중…</div>
                    <div className="text-xs text-muted-foreground mt-0.5">보통 2-5초 정도 걸려요</div>
                  </div>
                </div>
              )}
              {aiState === "done" && (
                <div className="rounded-xl border border-amber/30 bg-gradient-to-br from-amber/15 to-cream p-4">
                  <div className="flex items-center gap-1 text-xs font-semibold tracking-widest uppercase text-primary">
                    AI 인식 결과 <Icon.Lock />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-foreground mt-1 tabular-nums tracking-tight">{expDate}</div>
                  <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    인식이 잘못됐다면 사진을 다시 올려주세요.<br />
                    소비기한은 사용자가 임의로 수정할 수 없어요.
                  </div>
                </div>
              )}
              {aiState === "error" && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-destructive">
                  <span className="w-8 h-8 rounded-full bg-destructive text-white font-extrabold grid place-items-center flex-shrink-0">!</span>
                  <div>
                    <div className="text-sm font-semibold text-destructive">소비기한 인식 실패</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{aiError}</div>
                    <button
                      onClick={() => coverInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm rounded-full bg-card border border-border text-foreground/80 font-medium hover:border-amber hover:text-amber transition-colors mt-2"
                    >
                      다시 올리기
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* STEP 2 — 추가 사진 */}
            <section className="bg-card rounded-2xl border border-border shadow-warm p-5 sm:p-6 animate-fade-in-up stagger-2">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <div className="text-xs font-semibold tracking-widest uppercase text-amber">STEP 2 · 선택</div>
                  <h3 className="text-lg font-bold text-foreground mt-1">추가 사진</h3>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{photos.length} / 4</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">제품 앞면·뒷면·라벨 등을 보여주면 신뢰도가 올라가요.</p>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((p) => (
                  <div className="relative aspect-square" key={p.id}>
                    <Photo label="" src={p.url} ratio="1/1" className="rounded-xl overflow-hidden w-full h-full" />
                    <button
                      onClick={() => removePhoto(p.id)}
                      aria-label="삭제"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-foreground/75 text-white grid place-items-center hover:bg-foreground transition-colors"
                    >
                      <Icon.X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <button
                    onClick={() => moreInputRef.current?.click()}
                    className="aspect-square flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted text-muted-foreground text-xs font-medium hover:border-amber hover:text-amber hover:bg-amber/5 transition-colors"
                  >
                    <Icon.Plus />
                    <span>추가</span>
                  </button>
                )}
              </div>
            </section>
          </div>

          {/* ============ RIGHT: form ============ */}
          <div className="flex flex-col gap-6">
            {/* STEP 3 — 물품 정보 */}
            <section className="bg-card rounded-2xl border border-border shadow-warm p-5 sm:p-6 animate-fade-in-up stagger-3">
              <div className="mb-4">
                <div className="text-xs font-semibold tracking-widest uppercase text-amber">STEP 3 · 필수</div>
                <h3 className="text-lg font-bold text-foreground mt-1">물품 정보</h3>
              </div>

              {/* 물품 이름 */}
              <label className="block text-sm font-semibold text-foreground mb-2">물품 이름</label>
              <input
                className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber transition"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="예) 미개봉 시리얼"
                maxLength={30}
              />
              <div className="text-right text-xs text-muted-foreground mt-1 tabular-nums">{foodName.length} / 30</div>

              {/* 정원 수 */}
              <div className="flex items-center justify-between mt-5 mb-2">
                <label className="text-sm font-semibold text-foreground">
                  정원 수 <span className="font-normal text-muted-foreground">(나눠 받을 인원)</span>
                </label>
                <span className="text-xs text-muted-foreground">최대 10명</span>
              </div>
              <div className="inline-flex items-center gap-3 p-1 bg-muted rounded-xl">
                <button
                  onClick={() => setCapacity((c) => Math.max(1, c - 1))}
                  aria-label="감소"
                  className="w-9 h-9 rounded-lg bg-card border border-border grid place-items-center text-foreground hover:border-amber hover:text-amber transition-colors"
                >
                  <Icon.Minus />
                </button>
                <div className="min-w-[72px] flex items-baseline justify-center gap-1 text-center">
                  <span className="text-xl font-bold text-foreground tabular-nums">{capacity}</span>
                  <span className="text-sm font-medium text-muted-foreground">명</span>
                </div>
                <button
                  onClick={() => setCapacity((c) => Math.min(10, c + 1))}
                  aria-label="증가"
                  className="w-9 h-9 rounded-lg bg-card border border-border grid place-items-center text-foreground hover:border-amber hover:text-amber transition-colors"
                >
                  <Icon.Plus />
                </button>
              </div>

              {/* 상세 내용 */}
              <label className="block text-sm font-semibold text-foreground mt-5 mb-2">
                상세 내용 <span className="font-normal text-muted-foreground">(픽업 방법, 보관 상태 등)</span>
              </label>
              <textarea
                className="w-full min-h-[140px] px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber transition resize-y leading-relaxed"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                placeholder="미개봉, 박스째 나눔 OK · 직거래 희망 위치 · 보관 상태 등을 적어주세요"
              />
              <div className="text-right text-xs text-muted-foreground mt-1 tabular-nums">{details.length} / 500</div>
            </section>

            {/* 등록 규칙 */}
            <div className="flex gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4 text-primary animate-fade-in-up stagger-4">
              <Icon.Lock className="flex-shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <b className="block font-bold text-foreground mb-1">등록 규칙</b>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>가공·미개봉 식품만 등록해주세요 (직접 만든 음식·신선식품 ✕)</li>
                  <li>소비기한은 사진을 AI가 읽어 자동 설정 · 사용자 수정 불가</li>
                  <li>회원당 활성 물품은 최대 10개</li>
                </ul>
              </div>
            </div>

            <FormError>{submitError}</FormError>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => router.push("/")}
                className="inline-flex items-center justify-center gap-1.5 h-12 px-6 rounded-full bg-card border border-border text-foreground/80 font-medium hover:border-amber hover:text-amber transition-colors"
              >
                취소
              </button>
              <button
                disabled={!canSubmit}
                onClick={submitFood}
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-amber text-white font-semibold shadow-warm hover:bg-amber-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}

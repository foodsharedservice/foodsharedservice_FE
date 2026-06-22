/* lib/loadDaumPostcode.js — Daum(카카오) 우편번호 서비스 스크립트 로더
   브라우저에서 1회만 로드하고 window.daum 을 반환한다. */

let promise = null;

export function loadDaumPostcode() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.daum && window.daum.Postcode) return Promise.resolve(window.daum);
  if (promise) return promise;

  promise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    s.async = true;
    s.onload = () => {
      if (window.daum && window.daum.Postcode) resolve(window.daum);
      else reject(new Error("daum postcode load failed"));
    };
    s.onerror = () => {
      promise = null;
      reject(new Error("daum postcode script error"));
    };
    document.head.appendChild(s);
  });
  return promise;
}

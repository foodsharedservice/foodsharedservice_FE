/* MobileFrame.jsx — 고정 폭 모바일 뷰 프레임 (번개장터 모바일형)
   화면 해상도와 무관하게 항상 동일한 모바일 레이아웃을 보여주기 위해
   앱 전체를 고정 폭(.device) 컨테이너로 감싼다.
   .viewport.mobile 클래스가 디자인 시스템의 모바일 레이아웃 규칙을 활성화한다. */

export default function MobileFrame({ shell = false, children }) {
  return (
    <div className="viewport mobile">
      <div className={shell ? "device app-shell" : "device"}>{children}</div>
    </div>
  );
}

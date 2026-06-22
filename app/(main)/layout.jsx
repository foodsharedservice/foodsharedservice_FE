import AppHeader from "@/components/AppHeader";
import MobileFrame from "@/components/MobileFrame";

export default function MainLayout({ children }) {
  return (
    <MobileFrame shell>
      <AppHeader />
      <div className="app">
        <main className="app-content">{children}</main>
      </div>
    </MobileFrame>
  );
}

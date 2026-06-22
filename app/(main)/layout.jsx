import AppHeader from "@/components/AppHeader";

export default function MainLayout({ children }) {
  return (
    <div className="app-shell">
      <AppHeader />
      <div className="app">
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

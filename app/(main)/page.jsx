import { Suspense } from "react";
import HomeScreen from "@/components/screens/HomeScreen";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeScreen />
    </Suspense>
  );
}

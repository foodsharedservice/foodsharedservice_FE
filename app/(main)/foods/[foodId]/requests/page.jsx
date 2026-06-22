import FoodRequestsScreen from "@/components/screens/FoodRequestsScreen";

export default function FoodRequestsPage({ params }) {
  return <FoodRequestsScreen foodId={params.foodId} />;
}

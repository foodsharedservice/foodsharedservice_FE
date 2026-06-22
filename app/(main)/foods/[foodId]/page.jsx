import DetailScreen from "@/components/screens/DetailScreen";

export default function FoodDetailPage({ params }) {
  return <DetailScreen foodId={params.foodId} />;
}

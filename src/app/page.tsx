import { HomeScreen } from "@/components/screens/home";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("parent-home");

export default function Page() {
  return <HomeScreen />;
}

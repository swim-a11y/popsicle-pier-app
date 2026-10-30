import { BillsScreen } from "@/components/screens/coming-next-screens";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("bills");

export default function Page() {
  return <BillsScreen />;
}

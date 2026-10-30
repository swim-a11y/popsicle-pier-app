import { BillsScreen } from "@/components/screens/bills";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("bills");

export default function Page() {
  return <BillsScreen />;
}

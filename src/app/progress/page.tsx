import { ProgressScreen } from "@/components/screens/progress";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("progress");

export default function Page() {
  return <ProgressScreen />;
}

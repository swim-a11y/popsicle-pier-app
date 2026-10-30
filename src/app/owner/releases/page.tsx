import { OwnerReleasesScreen } from "@/components/screens/owner-releases";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("owner-releases");

export default function Page() {
  return <OwnerReleasesScreen />;
}

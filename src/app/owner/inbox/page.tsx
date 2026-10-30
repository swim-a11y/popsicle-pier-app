import { InboxScreen } from "@/components/screens/inbox";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("owner-inbox");

export default function Page() {
  return <InboxScreen />;
}

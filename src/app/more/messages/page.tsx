import { MessagesScreen } from "@/components/screens/coming-next-screens";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("messages");

export default function Page() {
  return <MessagesScreen />;
}

import { MessagesScreen } from "@/components/screens/messages";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("messages");

export default function Page() {
  return <MessagesScreen />;
}

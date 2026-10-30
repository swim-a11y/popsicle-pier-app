import { SendNoteScreen } from "@/components/screens/send-note";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("send-note");

export default function Page() {
  return <SendNoteScreen />;
}

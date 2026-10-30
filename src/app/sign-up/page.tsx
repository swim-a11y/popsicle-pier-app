import { SignUpStartScreen } from "@/components/screens/sign-up/start";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("sign-up-start");

export default function Page() {
  return <SignUpStartScreen />;
}

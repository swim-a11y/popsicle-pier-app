import { StageStep } from "@/components/screens/sign-up/stage";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("sign-up-stage");

export default function Page() {
  return <StageStep />;
}

import { WhoStaysStep } from "@/components/screens/sign-up/who-stays";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("sign-up-who-stays");

export default function Page() {
  return <WhoStaysStep />;
}

import { PaymentStep } from "@/components/screens/sign-up/payment";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("sign-up-payment");

export default function Page() {
  return <PaymentStep />;
}

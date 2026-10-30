import { PeopleStep } from "@/components/screens/sign-up/people";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("sign-up-people");

export default function Page() {
  return <PeopleStep />;
}

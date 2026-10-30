import { AddChildStep } from "@/components/screens/add/child";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("add-child");

export default function Page() {
  return <AddChildStep />;
}

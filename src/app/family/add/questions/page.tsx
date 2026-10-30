import { AddQuestionsStep } from "@/components/screens/add/questions";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("add-questions");

export default function Page() {
  return <AddQuestionsStep />;
}

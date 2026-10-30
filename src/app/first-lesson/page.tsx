import { FirstLessonScreen } from "@/components/screens/first-lesson";
import { screenMetadata } from "@/screens";

export const metadata = screenMetadata("first-lesson");

export default function Page() {
  return <FirstLessonScreen />;
}

/*
  What the Sandbox sheet does: play as a role, fill in a sample family,
  pretend the first lesson happened, pretend a family left a full class or
  the school cancelled a lesson, and erase everything on this phone.
*/
import { getStore } from "@/data/app-store";
import { newId } from "@/data/ids";
import { DEVICE_ID, moveOverDraftId, setCurrentFamily } from "@/rules/booking";
import { todayAtSchool } from "@/rules/dates";
import { currentFamily, movingFamily } from "@/rules/family";
import { STEP_PATH } from "@/rules/sign-up";
import { pretendFirstLesson } from "@/sandbox/pretend-first-lesson";
import { pretendFamilyLeft, pretendSchoolCancelled } from "@/sandbox/pretend-school";
import { applySampleFill } from "@/sandbox/sample-fill";

export const SIGN_UP_DRAFT_ID = "sign-up:this-phone";

/** Returns where to go next. */
export async function playAs(role: "parent" | "moving" | "owner", familyId: string | null = null): Promise<string> {
  const store = getStore();
  return store.transaction((tx) => {
    if (role === "moving") {
      const moving = movingFamily(tx.data());
      setCurrentFamily(tx, moving?.id ?? null, "moving");
      if (!moving) return "/";
      return moving.movedOverAt ? "/" : "/move-over";
    }
    if (role === "owner") {
      const device = tx.get("deviceStates", DEVICE_ID);
      setCurrentFamily(tx, device?.currentFamilyId ?? null, "owner");
      return "/owner/inbox";
    }
    setCurrentFamily(tx, familyId, "parent");
    return familyId ? "/" : "/sign-up";
  });
}

/** Fills the sign-up draft's typed fields and returns the step to show. */
export async function fillSampleFamily(): Promise<string> {
  const store = getStore();
  const now = new Date();
  return store.transaction((tx) => {
    const existing = tx.get("signUpDrafts", SIGN_UP_DRAFT_ID) ?? null;
    const filled = applySampleFill(existing, todayAtSchool(now), now.toISOString(), newId, SIGN_UP_DRAFT_ID);
    if (existing) tx.update("signUpDrafts", SIGN_UP_DRAFT_ID, filled);
    else tx.add("signUpDrafts", filled);
    return existing?.lastPath ?? STEP_PATH.pool;
  });
}

export async function pretendTheFirstLesson(): Promise<{ added: number; familyName: string | null }> {
  const store = getStore();
  const now = new Date().toISOString();
  return store.transaction((tx) => {
    const family = currentFamily(tx.data());
    if (!family) return { added: 0, familyName: null };
    return { ...pretendFirstLesson(tx, { familyId: family.id, now, newId }), familyName: family.parentFullName };
  });
}

export async function pretendAFamilyLeft(): Promise<{ freed: number }> {
  const today = todayAtSchool(new Date());
  return getStore().transaction((tx) => ({ freed: pretendFamilyLeft(tx, { today }).length }));
}

export async function pretendTheSchoolCancelled(): Promise<{ familyName: string | null; cancelled: { childFirstName: string; date: string } | null }> {
  const now = new Date();
  return getStore().transaction((tx) => {
    const family = currentFamily(tx.data());
    if (!family) return { familyName: null, cancelled: null };
    const cancelled = pretendSchoolCancelled(tx, { familyId: family.id, today: todayAtSchool(now), now: now.toISOString(), newId });
    return { familyName: family.parentFullName, cancelled };
  });
}

export async function eraseAllSampleData(): Promise<void> {
  await getStore().wipeAndReseed();
}

export { moveOverDraftId };

"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { deviceState, familiesOnThisPhone, familyChildren } from "@/rules/family";
import { namesList } from "@/rules/release";
import { eraseAllSampleData, fillSampleFamily, playAs, pretendTheFirstLesson } from "@/sandbox/actions";
import { ROLE_LABELS, SCREENS, type ScreenRole } from "@/screens";

const ROLE_LINES: Record<"parent" | "moving" | "owner", string> = {
  parent: "Start a new family's sign-up.",
  moving: "A Madison family checking in to the new app.",
  owner: "Release versions, read-only, and the staff page.",
};

/** The dashed Sandbox pill on every screen. Opens the sheet of sandbox tools. */
export function SandboxPill() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="min-h-tap shrink-0 rounded-pill border-2 border-dashed border-line bg-transparent px-4 font-strong text-foreground"
        >
          Sandbox
        </button>
      </SheetTrigger>
      <SheetContent>
        <SandboxSheetBody close={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

function SandboxSheetBody({ close }: { close: () => void }) {
  const loaded = useAppData();
  const go = useGo();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [busy, setBusy] = useState(false);

  const device = loaded ? deviceState(loaded.data) : null;
  const families = loaded ? familiesOnThisPhone(loaded.data) : [];

  const run = async (work: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    try {
      const href = await work();
      if (href) {
        close();
        go(href);
      }
    } finally {
      setBusy(false);
    }
  };

  const roleButton = (role: "parent" | "moving" | "owner", familyId: string | null = null) => (
    <button
      type="button"
      onClick={() => run(() => playAs(role, familyId))}
      className={cn(
        "flex min-h-tap-big w-full flex-col items-start rounded-control border-2 px-4 py-2 text-left",
        device?.role === role && (role !== "parent" || !device.currentFamilyId) ? "border-primary" : "border-line",
      )}
    >
      <span className="font-strong text-heading">{ROLE_LABELS[role]}</span>
      <span>{ROLE_LINES[role]}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <SheetTitle>Sandbox</SheetTitle>
        <SheetDescription>Tools for trying the sample from every side. Families in the real app never see this.</SheetDescription>
      </SheetHeader>

      <section className="flex flex-col gap-3" aria-labelledby="sandbox-roles">
        <h2 id="sandbox-roles" className="font-heading text-body text-heading">
          Play as
        </h2>
        {roleButton("parent")}
        {families.length > 0 ? (
          <div className="flex flex-col gap-2 pl-4">
            <p>Families signed up on this phone:</p>
            {families.map((f) => {
              const names = loaded ? namesList(familyChildren(loaded.data, f.id).map((c) => c.firstName)) : "";
              const current = device?.role === "parent" && device.currentFamilyId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => run(() => playAs("parent", f.id))}
                  className={cn("min-h-tap rounded-control border-2 px-4 py-2 text-left", current ? "border-primary" : "border-line")}
                >
                  {names ? `${names}'s family` : f.parentFullName}
                  {current ? <span className="font-strong"> (playing now)</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
        {roleButton("moving")}
        {roleButton("owner")}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="sandbox-shortcuts">
        <h2 id="sandbox-shortcuts" className="font-heading text-body text-heading">
          Shortcuts
        </h2>
        <Button variant="secondary" size="block" disabled={busy} onClick={() => run(fillSampleFamily)}>
          Fill in a sample family
        </Button>
        <Button
          variant="secondary"
          size="block"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const result = await pretendTheFirstLesson();
              if (!result.familyName) {
                setMessage("Sign up a family first, or pick one under Play as.");
                return null;
              }
              if (result.added === 0) {
                setMessage("Nothing new to add. This family's first lesson already happened in the sample.");
                return null;
              }
              return "/";
            })
          }
        >
          Pretend the first lesson happened
        </Button>
        {message ? (
          <p role="status" className="rounded-control bg-notice px-4 py-3">
            {message}
          </p>
        ) : null}
        <Button variant="secondary" size="block" disabled={busy} onClick={() => setConfirmErase(true)}>
          Erase all sample data on this phone
        </Button>
        <Link href="/staff" onClick={close} className="flex min-h-tap items-center font-strong">
          Staff side, coming later
        </Link>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="sandbox-screens">
        <h2 id="sandbox-screens" className="font-heading text-body text-heading">
          Every screen
        </h2>
        {(Object.keys(ROLE_LABELS) as ScreenRole[]).map((role) => (
          <div key={role} className="flex flex-col gap-1">
            <h3 className="font-strong text-heading">{ROLE_LABELS[role]}</h3>
            <ul className="flex flex-col">
              {SCREENS.filter((s) => s.role === role).map((s) => (
                <li key={s.id}>
                  <Link href={s.path} onClick={close} className="flex min-h-tap items-center">
                    {s.title}
                    {s.state === "coming-next" ? " (coming next)" : ""}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <Dialog open={confirmErase} onOpenChange={setConfirmErase}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Erase all sample data on this phone?</DialogTitle>
            <DialogDescription>
              Every sample family, signature and note made on this phone goes away, and the starting sample comes back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              size="block"
              onClick={() =>
                run(async () => {
                  await eraseAllSampleData();
                  setConfirmErase(false);
                  return "/";
                })
              }
            >
              Erase and start over
            </Button>
            <Button variant="secondary" size="block" onClick={() => setConfirmErase(false)}>
              Keep everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

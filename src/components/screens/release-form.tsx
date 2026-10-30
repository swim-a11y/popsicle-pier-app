"use client";

import { useRef, useState, type ReactNode } from "react";

import { Tag } from "@/components/parts/tag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AGREE_ELECTRONIC, MARKETING_EMAILS_CONSENT, NEWSLETTER_CONSENT, TEXTS_CONSENT } from "@/content/release";
import { SOMEONE_WILL_TALK } from "@/content/sign-up";
import type { DraftChildRelease, ReleaseVersion, SignUpDraft } from "@/data/types";
import { buildReleaseView, type ReleaseChildRef } from "@/rules/release";

type Release = SignUpDraft["release"];

const NO_ANSWERS: DraftChildRelease = { custody: null, health: null, research: false, marketing: false, underwater: false };

function CheckRow({ id, checked, onChange, invalid, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; invalid?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-tap items-start gap-3 py-1">
      <Checkbox id={id} checked={checked} aria-invalid={invalid ? true : undefined} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <Label htmlFor={id} className="leading-snug">
        {children}
      </Label>
    </div>
  );
}

function YesNo({ id, question, value, onChange, invalid }: { id: string; question: string; value: "yes" | "no" | null; onChange: (v: "yes" | "no") => void; invalid?: boolean }) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-control bg-page p-3" aria-invalid={invalid ? true : undefined}>
      <legend className="float-left mb-2 w-full">{question}</legend>
      <RadioGroup value={value ?? ""} onValueChange={(v) => onChange(v as "yes" | "no")} className="clear-left flex gap-6" aria-label={question}>
        {(["yes", "no"] as const).map((v) => (
          <div key={v} className="flex min-h-tap items-center gap-2">
            <RadioGroupItem value={v} id={`${id}-${v}`} />
            <Label htmlFor={`${id}-${v}`}>{v === "yes" ? "Yes" : "No"}</Label>
          </div>
        ))}
      </RadioGroup>
      {value === "yes" ? <p className="rounded-control bg-success px-3 py-2">{SOMEONE_WILL_TALK}</p> : null}
    </fieldset>
  );
}

export interface ReleaseFormProps {
  version: ReleaseVersion;
  kids: ReleaseChildRef[];
  release: Release;
  /** Saves each answer as it's given, so nothing is lost. */
  onChange: (release: Release) => void;
  /** Returns a problem to show, or null once saved. */
  onSign: (release: Release) => Promise<ReactNode | null>;
  signLabel: string;
}

/** The family release: every line visible, one required box per group, signed once for the whole family. */
export function ReleaseForm({ version, kids, release, onChange, onSign, signLabel }: ReleaseFormProps) {
  const view = buildReleaseView(version, kids);
  const [typedName, setTypedName] = useState(release.typedName);
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<ReactNode | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const answers = (key: string) => release.perChild[key] ?? NO_ANSWERS;
  const setAnswer = (key: string, patch: Partial<DraftChildRelease>) =>
    onChange({ ...release, typedName, perChild: { ...release.perChild, [key]: { ...answers(key), ...patch } } });
  const set = (patch: Partial<Release>) => onChange({ ...release, typedName, ...patch });

  const sign = async () => {
    if (busy.current) return; // ignores double taps
    busy.current = true;
    setSaving(true);
    setTried(true);
    const found = await onSign({ ...release, typedName });
    if (found) {
      setProblem(found);
      busy.current = false;
      setSaving(false);
      const firstInvalid = document.querySelector<HTMLElement>('[data-release] [aria-invalid="true"]');
      firstInvalid?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-6" data-release>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-big text-heading">{view.title}</h1>
        <p className="font-strong" data-testid="covers">
          {view.covers}
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <Tag tone="plain">SAMPLE</Tag>
          {view.sampleNote}
        </p>
      </div>

      <article className="flex flex-col gap-5" aria-label="Family release text">
        {view.groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby={`group-${g.key}`} data-testid={`group-${g.key}`}>
            <h2 id={`group-${g.key}`} className="font-heading text-body text-heading">
              {g.title}
            </h2>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {g.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {g.questions.map((q) => (
              <div key={q.childKey} className="flex flex-col gap-2">
                <YesNo id={`${q.childKey}-custody`} question={q.custody} value={answers(q.childKey).custody} invalid={tried && !answers(q.childKey).custody} onChange={(v) => setAnswer(q.childKey, { custody: v })} />
                <YesNo id={`${q.childKey}-health`} question={q.health} value={answers(q.childKey).health} invalid={tried && !answers(q.childKey).health} onChange={(v) => setAnswer(q.childKey, { health: v })} />
              </div>
            ))}
            <div className="border-t-2 border-line pt-2">
              <CheckRow id={`box-${g.key}`} checked={Boolean(release.groups[g.key])} invalid={tried && !release.groups[g.key]} onChange={(v) => set({ groups: { ...release.groups, [g.key]: v } })}>
                {g.box}
              </CheckRow>
            </div>
          </section>
        ))}

        <section className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card" aria-label="Your choices for each child">
          <p className="font-strong text-heading">{view.choicesIntro}</p>
          {view.choices.map((c) => (
            <div key={c.childKey} className="flex flex-col gap-3">
              {view.choices.length > 1 ? <h2 className="font-heading text-body text-heading">{c.firstName}</h2> : null}
              {c.items.map((item) => (
                <div key={item.key} className="flex flex-col gap-1">
                  <p className="font-strong">{item.title}</p>
                  {item.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <CheckRow id={`${c.childKey}-${item.key}`} checked={answers(c.childKey)[item.key]} onChange={(v) => setAnswer(c.childKey, { [item.key]: v })}>
                    {item.boxText}
                  </CheckRow>
                </div>
              ))}
            </div>
          ))}
        </section>
      </article>

      <section className="flex flex-col gap-3" aria-labelledby="messages-from-us">
        <h2 id="messages-from-us" className="font-heading text-body text-heading">
          Messages from us
        </h2>
        <p>Separate from the release. Each box starts unchecked.</p>
        <CheckRow id="consent-texts" checked={release.texts} onChange={(v) => set({ texts: v })}>
          {TEXTS_CONSENT}
        </CheckRow>
        <CheckRow id="consent-newsletter" checked={release.newsletter} onChange={(v) => set({ newsletter: v })}>
          {NEWSLETTER_CONSENT}
        </CheckRow>
        <CheckRow id="consent-marketing-emails" checked={release.marketingEmails} onChange={(v) => set({ marketingEmails: v })}>
          {MARKETING_EMAILS_CONSENT}
        </CheckRow>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="sign-title">
        <h2 id="sign-title" className="font-heading text-big text-heading">
          Sign
        </h2>
        <Field>
          <FieldLabel htmlFor="typed-name">Your full name</FieldLabel>
          <Input
            id="typed-name"
            name="signature-full-name"
            value={typedName}
            aria-invalid={tried && !typedName.trim() ? true : undefined}
            onChange={(e) => setTypedName(e.target.value)}
            onBlur={() => onChange({ ...release, typedName })}
          />
        </Field>
        <CheckRow id="agree-electronic" checked={release.agreeElectronic} invalid={tried && !release.agreeElectronic} onChange={(v) => set({ agreeElectronic: v })}>
          {AGREE_ELECTRONIC}
        </CheckRow>
        {problem ? (
          <div role="alert" className="rounded-control bg-notice px-4 py-3">
            {problem}
          </div>
        ) : null}
        <Button size="block" onClick={() => void sign()} aria-disabled={saving ? true : undefined}>
          {saving ? "Saving..." : signLabel}
        </Button>
      </section>
    </div>
  );
}

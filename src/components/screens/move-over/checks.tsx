"use client";

import { Tag } from "@/components/parts/tag";
import { stageName } from "@/content/path";
import { EMAIL_US_FIRST, NO_PARTNER_YET, relationshipLabel, SIGNS_ON_PAPER } from "@/content/sign-up";
import { clockTime, weekdayName } from "@/rules/dates";
import { familyChildren, familyLessons, lessonKindWords } from "@/rules/family";
import { priceLines } from "@/rules/prices";

import { ChangeLine, LooksRight, MoveOverScreen, useMoveOver } from "./shared";

function Card({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-surface p-5 shadow-card" data-testid={testId}>
      {children}
    </div>
  );
}

export function MoveOverDetails() {
  const step = useMoveOver("details");
  if (step === null || step === "none") return <MoveOverScreen stepKey="details" step={step} title="Your details" />;
  const { family, loaded } = step;
  const pool = loaded.data.pools.find((p) => p.id === family.homePoolId)!;
  return (
    <MoveOverScreen stepKey="details" step={step} title="Your details">
      <p>Here&apos;s what the school has for you. Nothing to type.</p>
      <Card testId="move-details">
        <p className="font-heading text-big text-heading">{family.parentFullName}</p>
        <p>{family.email}</p>
        <p>{family.phone}</p>
        <p>Home pool: {pool.name}</p>
      </Card>
      <ChangeLine email={pool.schoolEmail} />
      <LooksRight step={step} />
    </MoveOverScreen>
  );
}

export function MoveOverPeople() {
  const step = useMoveOver("people");
  if (step === null || step === "none") return <MoveOverScreen stepKey="people" step={step} title="Your people" />;
  const { family, loaded } = step;
  const pool = loaded.data.pools.find((p) => p.id === family.homePoolId)!;
  const contacts = loaded.data.emergencyContacts.filter((c) => c.familyId === family.id).sort((a, b) => a.order - b.order);
  const adults = loaded.data.listedAdults.filter((a) => a.familyId === family.id);
  return (
    <MoveOverScreen stepKey="people" step={step} title="Your people">
      <section className="flex flex-col gap-3" aria-labelledby="move-contacts">
        <h2 id="move-contacts" className="font-heading text-body text-heading">
          Emergency contacts
        </h2>
        {contacts.map((c) => (
          <Card key={c.id}>
            <p className="font-strong">{c.name}</p>
            <p>{c.phone}</p>
          </Card>
        ))}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="move-adults">
        <h2 id="move-adults" className="font-heading text-body text-heading">
          Adults who may stay at the pool
        </h2>
        {adults.map((a) => (
          <Card key={a.id} testId="listed-adult">
            <div className="flex items-center justify-between gap-2">
              <p className="font-strong">
                {a.firstName}, {relationshipLabel(a.relationship).toLowerCase()}
              </p>
              <Tag tone={a.status === "signed" ? "mark" : "plain"}>{a.status === "signed" ? "Signed" : "Waiting"}</Tag>
            </div>
            {a.status === "waiting" ? <p>{SIGNS_ON_PAPER}</p> : null}
            {!a.isParentOrGuardian ? <p className="rounded-control bg-page px-3 py-2">{EMAIL_US_FIRST}</p> : null}
          </Card>
        ))}
      </section>
      <ChangeLine email={pool.schoolEmail} />
      <LooksRight step={step} />
    </MoveOverScreen>
  );
}

export function MoveOverClasses() {
  const step = useMoveOver("classes");
  if (step === null || step === "none") return <MoveOverScreen stepKey="classes" step={step} title="Your classes" />;
  const { family, loaded } = step;
  const pool = loaded.data.pools.find((p) => p.id === family.homePoolId)!;
  const lessons = familyLessons(loaded.data, family.id);
  return (
    <MoveOverScreen stepKey="classes" step={step} title="Your classes">
      {familyChildren(loaded.data, family.id).map((k) => (
        <Card key={k.id} testId="move-class">
          <div className="flex items-center justify-between gap-2">
            <p className="font-heading text-big text-heading">{k.firstName}</p>
            <span>{stageName(k.stageId)}</span>
          </div>
          {lessons
            .filter((l) => l.child.id === k.id)
            .map((l) => (
              <div key={l.enrollment.id} className="flex flex-col gap-1">
                <p className="font-strong">
                  {weekdayName(l.weekday)}s at {clockTime(l.startTime)}, {l.pool.name}
                </p>
                <p>
                  {lessonKindWords(l)} with Coach {l.instructorFirstName}
                </p>
                {l.bankCents !== null ? (
                  <p data-testid="prices">
                    {priceLines(l.bankCents)
                      .map((p) => `${p.label} ${p.amount}`)
                      .join(", ")}{" "}
                    a lesson
                  </p>
                ) : null}
                {l.enrollment.unpairedSince ? <p className="rounded-control bg-page px-3 py-2">{NO_PARTNER_YET}</p> : null}
              </div>
            ))}
        </Card>
      ))}
      <ChangeLine email={pool.schoolEmail} />
      <LooksRight step={step} />
    </MoveOverScreen>
  );
}

"use client";

import { longDate } from "@/rules/dates";

import { ChoiceButton, StepScreen, StepTitle, useSignUpStep } from "./shared";

function ageWords(months: number): string {
  return months % 12 === 0 ? `${months / 12}` : `${Math.floor(months / 12)} and a half`;
}

export function PoolStep() {
  const step = useSignUpStep("pool");
  return (
    <StepScreen step={step} stepKey="pool">
      {step ? (
        <>
          <StepTitle>Which pool?</StepTitle>
          <div className="flex flex-col gap-3">
            {step.loaded.data.pools.map((pool) => (
              <ChoiceButton
                key={pool.id}
                title={pool.name}
                selected={step.draft?.poolId === pool.id}
                line={`Ages ${ageWords(pool.youngestAgeMonths)} and up. One or two swimmers in each lesson.${
                  pool.opensOn && pool.opensOn > step.loaded.today ? ` Opens ${longDate(pool.opensOn, step.loaded.today)}.` : ""
                }`}
                onClick={() =>
                  step.advance((d) =>
                    d.poolId === pool.id
                      ? d
                      : { ...d, poolId: pool.id, children: d.children.map((c) => ({ ...c, booking: null, waitlistClassIds: [] })) },
                  )
                }
              />
            ))}
          </div>
        </>
      ) : null}
    </StepScreen>
  );
}

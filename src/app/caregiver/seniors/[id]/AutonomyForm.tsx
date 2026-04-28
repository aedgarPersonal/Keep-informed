"use client";

import { useTransition, useState } from "react";
import { setSeniorAutonomy } from "./actions";

export type AutonomyLevel = "view_only" | "assisted" | "self_directed";

const LEVELS: Array<{
  value: AutonomyLevel;
  label: string;
  description: string;
}> = [
  {
    value: "view_only",
    label: "View only",
    description:
      "Tap to complete tasks you set up. Can undo a recent tap. (Default.)",
  },
  {
    value: "assisted",
    label: "Assisted",
    description:
      "Plus they can add one-off tasks for themselves (e.g. an appointment). They can't change the recurring care plan you set.",
  },
  {
    value: "self_directed",
    label: "Self-directed",
    description:
      "Plus they can edit and archive their own recurring tasks. They still can't see your private notes.",
  },
];

export function AutonomyForm({
  seniorId,
  current,
}: {
  seniorId: string;
  current: AutonomyLevel;
}) {
  const [pending, startTransition] = useTransition();
  const [level, setLevel] = useState<AutonomyLevel>(current);

  function update(next: AutonomyLevel) {
    if (next === level || pending) return;
    const previous = level;
    setLevel(next); // optimistic
    startTransition(async () => {
      try {
        await setSeniorAutonomy(seniorId, next);
      } catch {
        setLevel(previous);
      }
    });
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={pending}>
      <legend className="sr-only">Care level</legend>
      {LEVELS.map((l) => {
        const isOn = l.value === level;
        return (
          <label
            key={l.value}
            className={
              "flex cursor-pointer flex-col gap-1 rounded-2xl border-2 p-4 " +
              (isOn ? "border-blue-700 bg-blue-50" : "border-zinc-300")
            }
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="autonomy"
                value={l.value}
                checked={isOn}
                onChange={() => update(l.value)}
                className="h-5 w-5"
              />
              <span className="text-base font-semibold">{l.label}</span>
            </span>
            <span className="pl-8 text-sm text-zinc-600">{l.description}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

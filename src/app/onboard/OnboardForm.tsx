"use client";

import { useActionState, useEffect, useState } from "react";
import { bootstrapProfile, type OnboardState } from "./actions";

const initialState: OnboardState = { status: "idle" };

export function OnboardForm() {
  const [state, formAction, isPending] = useActionState(
    bootstrapProfile,
    initialState,
  );
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      // Older Safari, very rare. Stick with UTC.
    }
  }, []);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="timezone" value={tz} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Your name</span>
        <input
          type="text"
          name="display_name"
          required
          autoComplete="name"
          className="h-14 rounded-2xl border-2 border-zinc-300 px-4 text-lg"
          placeholder="Alex"
        />
      </label>
      <p className="text-sm text-zinc-500">
        Detected timezone: <span className="font-medium">{tz}</span>
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="flex h-14 items-center justify-center rounded-2xl bg-blue-700 text-lg font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Continue"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-700">{state.message}</p>
      )}
    </form>
  );
}

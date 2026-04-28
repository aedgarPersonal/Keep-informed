"use client";

import { useActionState, useEffect, useState } from "react";
import { createSenior, type CreateSeniorState } from "./actions";

const initialState: CreateSeniorState = { status: "idle" };

export function CreateSeniorForm({ defaultTimezone }: { defaultTimezone: string }) {
  const [state, formAction, isPending] = useActionState(
    createSenior,
    initialState,
  );
  const [tz, setTz] = useState(defaultTimezone);

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || defaultTimezone);
    } catch {
      // keep server default
    }
  }, [defaultTimezone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="timezone" value={tz} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Their name</span>
        <input
          type="text"
          name="display_name"
          required
          className="h-14 rounded-2xl border-2 border-zinc-300 px-4 text-lg"
          placeholder="Mom"
        />
      </label>
      <p className="text-sm text-zinc-500">
        Initial timezone: <span className="font-medium">{tz}</span> (they can
        change this on their first sign-in)
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="flex h-14 items-center justify-center rounded-2xl bg-blue-700 text-lg font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Creating…" : "Create"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-700">{state.message}</p>
      )}
    </form>
  );
}

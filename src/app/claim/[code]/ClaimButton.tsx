"use client";

import { useActionState } from "react";
import { claimSeniorProfile, type ClaimState } from "./actions";

const initialState: ClaimState = { status: "idle" };

export function ClaimButton({
  code,
  greeting,
}: {
  code: string;
  greeting: string;
}) {
  const [state, formAction, isPending] = useActionState(
    claimSeniorProfile,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      <p className="text-lg text-zinc-700">{greeting}</p>
      <button
        type="submit"
        disabled={isPending}
        className="flex h-16 items-center justify-center rounded-2xl bg-blue-700 px-6 text-xl font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Setting up…" : "Yes, this is me"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-700">{state.message}</p>
      )}
    </form>
  );
}

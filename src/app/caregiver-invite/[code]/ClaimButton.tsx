"use client";

import { useActionState } from "react";
import {
  claimCaregiverInvite,
  type ClaimCaregiverState,
} from "./actions";

const initialState: ClaimCaregiverState = { status: "idle" };

export function ClaimButton({ code }: { code: string }) {
  const [state, formAction, isPending] = useActionState(
    claimCaregiverInvite,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      <button
        type="submit"
        disabled={isPending}
        className="flex h-14 items-center justify-center rounded-2xl bg-blue-700 text-lg font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Joining…" : "Accept invite"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-700">{state.message}</p>
      )}
    </form>
  );
}

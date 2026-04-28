"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(
    sendMagicLink,
    initialState,
  );

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-green-700 bg-green-50 p-5 text-green-900">
        <p className="text-lg font-semibold">Check your email</p>
        <p>We sent a sign-in link to {state.email}.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="h-14 rounded-2xl border-2 border-zinc-300 px-4 text-lg"
          placeholder="you@example.com"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="flex h-14 items-center justify-center rounded-2xl bg-blue-700 text-lg font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Send sign-in link"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-700">{state.message}</p>
      )}
    </form>
  );
}

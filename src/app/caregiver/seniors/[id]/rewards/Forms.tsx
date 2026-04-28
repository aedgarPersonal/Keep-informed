"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addNoteReward,
  addPhotoReward,
  type RewardFormState,
} from "./actions";

const initialState: RewardFormState = { status: "idle" };

export function NoteForm({ seniorId }: { seniorId: string }) {
  const [state, formAction, isPending] = useActionState(
    addNoteReward,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "idle" && !isPending) formRef.current?.reset();
  }, [state, isPending]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="senior_id" value={seniorId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Note</span>
        <textarea
          name="body"
          required
          maxLength={280}
          rows={3}
          className="rounded-2xl border-2 border-zinc-300 px-4 py-3 text-base"
          placeholder="We love you. — the kids"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 items-center justify-center rounded-2xl bg-blue-700 text-base font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Add note"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-700">{state.message}</p>
      )}
    </form>
  );
}

export function PhotoForm({ seniorId }: { seniorId: string }) {
  const [state, formAction, isPending] = useActionState(
    addPhotoReward,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "idle" && !isPending) formRef.current?.reset();
  }, [state, isPending]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3"
      encType="multipart/form-data"
    >
      <input type="hidden" name="senior_id" value={seniorId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Photo</span>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          required
          className="rounded-2xl border-2 border-zinc-300 p-3 text-base"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">
          Caption (optional)
        </span>
        <input
          type="text"
          name="caption"
          maxLength={140}
          className="h-12 rounded-2xl border-2 border-zinc-300 px-4 text-base"
          placeholder="At the lake last summer"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 items-center justify-center rounded-2xl bg-blue-700 text-base font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Uploading…" : "Add photo"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-700">{state.message}</p>
      )}
    </form>
  );
}

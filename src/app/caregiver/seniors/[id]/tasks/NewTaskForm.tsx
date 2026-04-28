"use client";

import { useActionState, useRef, useEffect } from "react";
import { createTask, type TaskFormState } from "./actions";

const initialState: TaskFormState = { status: "idle" };

const DAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 0, label: "S" },
];

export function NewTaskForm({ seniorId }: { seniorId: string }) {
  const [state, formAction, isPending] = useActionState(
    createTask,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "idle" && !isPending) {
      formRef.current?.reset();
    }
  }, [state, isPending]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="senior_id" value={seniorId} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Task</span>
        <input
          type="text"
          name="title"
          required
          className="h-12 rounded-2xl border-2 border-zinc-300 px-4 text-lg"
          placeholder="Take morning medication"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-700">
          Days (leave all unchecked for daily)
        </legend>
        <div className="flex gap-2">
          {DAYS.map((d) => (
            <label
              key={d.value}
              className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-zinc-300 text-base font-semibold has-[:checked]:border-blue-700 has-[:checked]:bg-blue-700 has-[:checked]:text-white"
            >
              <input
                type="checkbox"
                name="weekdays"
                value={d.value}
                className="sr-only"
              />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 items-center justify-center rounded-2xl bg-blue-700 text-base font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Adding…" : "Add task"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-700">{state.message}</p>
      )}
    </form>
  );
}

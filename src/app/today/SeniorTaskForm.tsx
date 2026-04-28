"use client";

import { useActionState, useState } from "react";
import { addSeniorTask, editSeniorTask, type AddTaskState } from "./actions";
import {
  COLOR_BG,
  COLOR_LABELS,
  COLOR_NAMES,
  type ColorName,
} from "@/lib/task-palette";

const initialState: AddTaskState = { status: "idle" };

const DAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 0, label: "S" },
];

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type SeniorTaskFormInitial = {
  title: string;
  schedule: "recurring" | "one_off";
  weekdays: number[];
  dueDate: string;
  color: ColorName | null;
};

export function SeniorTaskForm({
  allowRecurring,
  taskId,
  initial,
}: {
  allowRecurring: boolean;
  /** Pass to render in edit mode; the form will call editSeniorTask. */
  taskId?: string;
  initial?: SeniorTaskFormInitial;
}) {
  const isEdit = Boolean(taskId);
  const start: SeniorTaskFormInitial = initial ?? {
    title: "",
    schedule: allowRecurring ? "recurring" : "one_off",
    weekdays: [],
    dueDate: allowRecurring ? "" : todayLocalISO(),
    color: null,
  };

  const [state, formAction, isPending] = useActionState(
    isEdit ? editSeniorTask : addSeniorTask,
    initialState,
  );
  const [schedule, setSchedule] = useState<"recurring" | "one_off">(
    start.schedule,
  );
  const [weekdays, setWeekdays] = useState<Set<number>>(
    new Set(start.weekdays),
  );
  const [dueDate, setDueDate] = useState(start.dueDate || todayLocalISO());
  const [color, setColor] = useState<ColorName | null>(start.color);

  function toggleDay(day: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {taskId && <input type="hidden" name="task_id" value={taskId} />}
      <input type="hidden" name="schedule" value={schedule} />
      <input type="hidden" name="color" value={color ?? ""} />
      {schedule === "recurring" &&
        Array.from(weekdays).map((d) => (
          <input key={d} type="hidden" name="weekdays" value={d} />
        ))}

      <label className="flex flex-col gap-1">
        <span className="text-base font-medium text-zinc-700">Task</span>
        <input
          type="text"
          name="title"
          required
          maxLength={200}
          autoFocus
          defaultValue={start.title}
          className="h-14 rounded-2xl border-2 border-zinc-300 px-4 text-xl"
          placeholder="What do you want to add?"
        />
      </label>

      {allowRecurring && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-base font-medium text-zinc-700">
            When
          </legend>
          <div className="flex gap-2">
            {(["recurring", "one_off"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSchedule(s)}
                aria-pressed={schedule === s}
                className={
                  "flex h-14 flex-1 items-center justify-center rounded-xl border-2 text-base font-semibold " +
                  (schedule === s
                    ? "border-blue-700 bg-blue-700 text-white"
                    : "border-zinc-300 text-zinc-700")
                }
              >
                {s === "recurring" ? "Every week" : "One time"}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {schedule === "recurring" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-base font-medium text-zinc-700">
            Days (leave all unchecked for daily)
          </legend>
          <div className="flex gap-2">
            {DAYS.map((d) => {
              const isOn = weekdays.has(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  aria-pressed={isOn}
                  className={
                    "flex h-14 w-14 items-center justify-center rounded-xl border-2 text-lg font-semibold " +
                    (isOn
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-zinc-300 text-zinc-700")
                  }
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-base font-medium text-zinc-700">Date</span>
          <input
            type="date"
            name="due_date"
            required
            min={todayLocalISO()}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-14 rounded-2xl border-2 border-zinc-300 px-4 text-xl"
          />
        </label>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-medium text-zinc-700">
          Color (optional)
        </legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setColor(null)}
            aria-pressed={color === null}
            className={
              "h-12 rounded-xl border-2 px-4 text-base font-medium " +
              (color === null
                ? "border-blue-700 text-blue-700"
                : "border-zinc-300 text-zinc-700")
            }
          >
            None
          </button>
          {COLOR_NAMES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-pressed={color === c}
              aria-label={COLOR_LABELS[c]}
              className={
                "h-12 w-12 rounded-xl border-2 " +
                COLOR_BG[c] +
                " " +
                (color === c
                  ? "ring-2 ring-blue-700 ring-offset-2"
                  : "border-zinc-300")
              }
            />
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="flex h-16 items-center justify-center rounded-2xl bg-blue-700 text-xl font-semibold text-white disabled:opacity-60"
      >
        {isPending
          ? isEdit
            ? "Saving…"
            : "Adding…"
          : isEdit
            ? "Save changes"
            : "Add task"}
      </button>
      {state.status === "error" && (
        <p className="text-base text-red-700">{state.message}</p>
      )}
    </form>
  );
}

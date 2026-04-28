"use client";

import { useActionState, useEffect, useState } from "react";
import {
  CATEGORY_LABELS,
  TEMPLATES,
  type TaskCategory,
  type Template,
} from "@/lib/task-templates";
import {
  COLOR_BG,
  COLOR_LABELS,
  COLOR_NAMES,
  type ColorName,
} from "@/lib/task-palette";
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

const CATEGORY_ORDER: TaskCategory[] = [
  "hygiene",
  "medication",
  "appointment",
  "checkin",
  "other",
];

const TEMPLATES_BY_CATEGORY = TEMPLATES.reduce<Record<TaskCategory, Template[]>>(
  (acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  },
  {} as Record<TaskCategory, Template[]>,
);

const EMPTY_FORM = {
  title: "",
  category: "other" as TaskCategory,
  weekdays: new Set<number>(),
  color: null as ColorName | null,
  notes: "",
};

export function NewTaskForm({ seniorId }: { seniorId: string }) {
  const [state, formAction, isPending] = useActionState(
    createTask,
    initialState,
  );

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (state.status === "idle" && !isPending) {
      setForm(EMPTY_FORM);
    }
  }, [state, isPending]);

  function applyTemplate(t: Template) {
    setForm({
      title: t.title,
      category: t.category,
      weekdays: new Set(t.defaultWeekdays ?? []),
      color: null,
      notes: "",
    });
  }

  function toggleDay(day: number) {
    setForm((prev) => {
      const next = new Set(prev.weekdays);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return { ...prev, weekdays: next };
    });
  }

  const isMedication = form.category === "medication";

  return (
    <div className="flex flex-col gap-4">
      {/* Quick start templates */}
      <details className="rounded-2xl border-2 border-zinc-200">
        <summary className="cursor-pointer select-none list-none p-4 text-base font-semibold">
          Quick start from a template
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          {CATEGORY_ORDER.filter((c) => TEMPLATES_BY_CATEGORY[c]?.length).map(
            (cat) => (
              <div key={cat} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {CATEGORY_LABELS[cat]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES_BY_CATEGORY[cat].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="rounded-full border-2 border-zinc-300 px-3 py-1 text-sm font-medium hover:border-blue-700"
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </details>

      {/* Custom form */}
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="senior_id" value={seniorId} />
        <input type="hidden" name="color" value={form.color ?? ""} />
        {Array.from(form.weekdays).map((d) => (
          <input key={d} type="hidden" name="weekdays" value={d} />
        ))}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Task</span>
          <input
            type="text"
            name="title"
            required
            value={form.title}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, title: e.target.value }))
            }
            className="h-12 rounded-2xl border-2 border-zinc-300 px-4 text-lg"
            placeholder={
              isMedication ? "e.g. Pink pill" : "Take morning medication"
            }
          />
          {isMedication && (
            <span className="text-xs text-zinc-500">
              Use a memorable label — the clinical name and dose go in
              notes below.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Category</span>
          <select
            name="category"
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                category: e.target.value as TaskCategory,
              }))
            }
            className="h-12 rounded-2xl border-2 border-zinc-300 bg-white px-4 text-lg"
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-zinc-700">
            Days (leave all unchecked for daily)
          </legend>
          <div className="flex gap-2">
            {DAYS.map((d) => {
              const isOn = form.weekdays.has(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  aria-pressed={isOn}
                  className={
                    "flex h-12 w-12 items-center justify-center rounded-xl border-2 text-base font-semibold " +
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

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-zinc-700">
            Color (optional, helps with medications)
          </legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, color: null }))}
              aria-pressed={form.color === null}
              className={
                "h-10 rounded-xl border-2 px-3 text-sm font-medium " +
                (form.color === null
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
                onClick={() => setForm((prev) => ({ ...prev, color: c }))}
                aria-pressed={form.color === c}
                aria-label={COLOR_LABELS[c]}
                className={
                  "h-10 w-10 rounded-xl border-2 " +
                  COLOR_BG[c] +
                  " " +
                  (form.color === c
                    ? "ring-2 ring-blue-700 ring-offset-2"
                    : "border-zinc-300")
                }
              />
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">
            Notes (optional, not shown to them)
          </span>
          <textarea
            name="notes"
            maxLength={500}
            rows={2}
            value={form.notes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, notes: e.target.value }))
            }
            className="rounded-2xl border-2 border-zinc-300 px-4 py-3 text-base"
            placeholder={
              isMedication
                ? "Lisinopril 10mg — with breakfast"
                : "Anything you want to remember"
            }
          />
        </label>

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
    </div>
  );
}

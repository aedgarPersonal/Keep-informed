"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { type Reward } from "@/lib/rewards";
import { COLOR_BG, type ColorName } from "@/lib/task-palette";
import {
  archiveOwnTask,
  completeTaskInstance,
  undoCompletion,
} from "./actions";

export type Instance = {
  id: string; // task_instance.id
  taskId: string;
  title: string;
  color: ColorName | null;
  completed: boolean;
  /** ISO 8601, or null if not yet completed. Used to gate the Undo button. */
  completedAt: string | null;
  /** True when the senior themselves created this task — gates the Archive affordance. */
  ownTask: boolean;
};

const UNDO_WINDOW_MS = 5 * 60 * 1000;

function isWithinUndoWindow(completedAt: string | null | undefined): boolean {
  if (!completedAt) return false;
  return Date.now() - new Date(completedAt).getTime() < UNDO_WINDOW_MS;
}

export function TodayChecklist({ instances }: { instances: Instance[] }) {
  const [done, setDone] = useState<Set<string>>(
    new Set(instances.filter((i) => i.completed).map((i) => i.id)),
  );
  const [completedAtById, setCompletedAtById] = useState<Map<string, string>>(
    () => {
      const m = new Map<string, string>();
      for (const i of instances) {
        if (i.completedAt) m.set(i.id, i.completedAt);
      }
      return m;
    },
  );
  const [reward, setReward] = useState<Reward | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Tick once a minute so the Undo button disappears after the 5-min
  // window without forcing a page refresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (completedAtById.size === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [completedAtById]);

  function complete(id: string) {
    if (done.has(id)) return;
    setDone((prev) => new Set(prev).add(id));
    setError(null);

    startTransition(async () => {
      const result = await completeTaskInstance(id);
      if (result.ok) {
        setCompletedAtById((prev) => {
          const next = new Map(prev);
          next.set(id, new Date().toISOString());
          return next;
        });
        setReward(result.reward);
      } else {
        setDone((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setError(result.message);
      }
    });
  }

  function undo(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await undoCompletion(id);
      if (result.ok) {
        setDone((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setCompletedAtById((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <>
      {error && (
        <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {instances.map((task) => {
          const isDone = done.has(task.id);
          const completedAt = completedAtById.get(task.id) ?? null;
          const canUndo = isDone && isWithinUndoWindow(completedAt);
          return (
            <li key={task.id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => complete(task.id)}
                aria-pressed={isDone}
                disabled={isDone}
                className={
                  "flex w-full items-stretch overflow-hidden rounded-2xl border-2 text-left text-2xl font-medium transition-colors " +
                  (isDone
                    ? "border-green-700 bg-green-50 text-green-900"
                    : "border-zinc-300 bg-white text-zinc-900 active:bg-blue-50")
                }
              >
                {task.color && (
                  <span
                    aria-hidden
                    className={`w-3 shrink-0 ${COLOR_BG[task.color]}`}
                  />
                )}
                <span className="flex flex-1 items-center gap-4 px-5 py-5">
                  <span
                    aria-hidden
                    className={
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-2xl " +
                      (isDone
                        ? "border-green-700 bg-green-700 text-white"
                        : "border-zinc-400 bg-white text-transparent")
                    }
                  >
                    ✓
                  </span>
                  <span className="flex-1">{task.title}</span>
                </span>
              </button>
              <div className="flex justify-end gap-3">
                {canUndo && (
                  <button
                    type="button"
                    onClick={() => undo(task.id)}
                    className="px-3 py-1 text-sm font-medium text-blue-700"
                  >
                    Undo
                  </button>
                )}
                {task.ownTask && !isDone && (
                  <>
                    <Link
                      href={`/today/edit/${task.taskId}`}
                      className="px-3 py-1 text-sm font-medium text-blue-700"
                    >
                      Edit
                    </Link>
                    <form action={archiveOwnTask}>
                      <input type="hidden" name="task_id" value={task.taskId} />
                      <button
                        type="submit"
                        className="px-3 py-1 text-sm font-medium text-zinc-500"
                      >
                        Remove
                      </button>
                    </form>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {reward && (
        <RewardCard reward={reward} onDismiss={() => setReward(null)} />
      )}
    </>
  );
}

function rewardLabel(reward: Reward): string {
  switch (reward.kind) {
    case "joke":
      return "A little joke";
    case "fact":
      return "Did you know?";
    case "photo":
      return "From your family";
    case "note":
      return "A note for you";
  }
}

function RewardCard({
  reward,
  onDismiss,
}: {
  reward: Reward;
  onDismiss: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-title"
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-6"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="reward-title"
          className="text-sm font-semibold uppercase tracking-wide text-blue-700"
        >
          {rewardLabel(reward)}
        </p>
        {reward.mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reward.mediaUrl}
            alt={reward.body || "From your family"}
            className="mt-3 w-full rounded-2xl object-cover"
          />
        )}
        {reward.body && (
          <p className="mt-3 text-2xl leading-snug text-zinc-900">{reward.body}</p>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-blue-700 text-lg font-semibold text-white"
        >
          Thanks!
        </button>
      </div>
    </div>
  );
}

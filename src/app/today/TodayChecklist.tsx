"use client";

import { useState, useTransition } from "react";
import { type Reward } from "@/lib/rewards";
import { completeTaskInstance } from "./actions";

export type Instance = {
  id: string;       // task_instance.id
  title: string;
  completed: boolean;
};

export function TodayChecklist({ instances }: { instances: Instance[] }) {
  const [done, setDone] = useState<Set<string>>(
    new Set(instances.filter((i) => i.completed).map((i) => i.id)),
  );
  const [reward, setReward] = useState<Reward | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function complete(id: string) {
    if (done.has(id)) return;

    // Optimistic — flip to done immediately, roll back on failure.
    setDone((prev) => new Set(prev).add(id));
    setError(null);

    startTransition(async () => {
      const result = await completeTaskInstance(id);
      if (result.ok) {
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
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => complete(task.id)}
                aria-pressed={isDone}
                disabled={isDone}
                className={
                  "flex w-full items-center gap-4 rounded-2xl border-2 px-5 py-5 text-left text-2xl font-medium transition-colors " +
                  (isDone
                    ? "border-green-700 bg-green-50 text-green-900"
                    : "border-zinc-300 bg-white text-zinc-900 active:bg-blue-50")
                }
              >
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
              </button>
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

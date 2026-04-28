"use client";

import { useState } from "react";
import { pickRandomReward, type Reward } from "@/lib/rewards";

type Task = {
  id: string;
  title: string;
};

type Props = {
  tasks: Task[];
};

export function TodayChecklist({ tasks }: Props) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [reward, setReward] = useState<Reward | null>(null);

  function complete(id: string) {
    if (done.has(id)) return;
    setDone((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setReward(pickRandomReward());
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {tasks.map((task) => {
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
          {reward.kind === "joke" ? "A little joke" : "Did you know?"}
        </p>
        <p className="mt-3 text-2xl leading-snug text-zinc-900">{reward.body}</p>
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

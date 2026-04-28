"use client";

import { useState, useTransition } from "react";
import { runMedicationReview } from "./actions";

export function RunButton({ seniorId }: { seniorId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await runMedicationReview(formData);
          if (!result.ok) setError(result.message);
        });
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="senior_id" value={seniorId} />
      <button
        type="submit"
        disabled={pending}
        className="flex h-14 items-center justify-center rounded-2xl bg-blue-700 text-lg font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Reviewing… (this can take 30 seconds)" : "Run review"}
      </button>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

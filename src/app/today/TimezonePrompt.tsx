"use client";

import { useEffect, useState, useTransition } from "react";
import { updateTimezone } from "./actions";

export function TimezonePrompt({
  profileTimezone,
}: {
  profileTimezone: string;
}) {
  const [deviceTz, setDeviceTz] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && tz !== profileTimezone) {
        setDeviceTz(tz);
      }
    } catch {
      // ignore — older Safari etc.
    }
  }, [profileTimezone]);

  if (!deviceTz || dismissed) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-blue-300 bg-blue-50 p-4">
      <p className="text-base text-blue-900">
        It looks like you&apos;re in <strong>{deviceTz}</strong>. Use that
        time for today&apos;s tasks?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateTimezone(deviceTz);
            })
          }
          className="flex h-12 flex-1 items-center justify-center rounded-xl bg-blue-700 text-base font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Updating…" : `Use ${deviceTz}`}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-blue-300 text-base font-medium text-blue-900"
        >
          Keep {profileTimezone}
        </button>
      </div>
    </div>
  );
}

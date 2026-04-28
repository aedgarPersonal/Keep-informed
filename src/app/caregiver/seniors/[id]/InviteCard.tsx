"use client";

import { useState } from "react";

export function InviteCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-blue-200 bg-blue-50 p-5">
      <p className="font-semibold text-blue-900">Send them this link</p>
      <p className="break-all rounded-xl bg-white p-3 font-mono text-sm">
        {url}
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard API can be blocked; fall back to manual selection.
          }
        }}
        className="flex h-12 items-center justify-center rounded-xl bg-blue-700 text-base font-semibold text-white"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      <p className="text-sm text-blue-900">
        They sign in with their email; the link claims the account.
      </p>
    </div>
  );
}

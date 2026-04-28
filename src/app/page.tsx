import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Keep Informed</h1>
        <p className="max-w-sm text-zinc-600">
          A simple daily checklist, with caregiver oversight.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link
          href="/today"
          className="flex h-16 items-center justify-center rounded-2xl bg-blue-700 px-6 text-xl font-semibold text-white"
        >
          I&apos;m using the app today
        </Link>
        <Link
          href="/caregiver"
          className="flex h-14 items-center justify-center rounded-2xl border-2 border-zinc-300 px-6 text-lg font-medium text-zinc-800"
        >
          I&apos;m a caregiver
        </Link>
      </div>
    </main>
  );
}

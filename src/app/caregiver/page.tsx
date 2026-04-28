import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LinkRow = {
  senior: {
    id: string;
    display_name: string;
    timezone: string;
    invite_code: string | null;
    auth_user_id: string | null;
  } | null;
};

export default async function CaregiverPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("senior_caregiver_links")
    .select(
      "senior:profiles!senior_id(id, display_name, timezone, invite_code, auth_user_id)",
    )
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .returns<LinkRow[]>();

  if (error) {
    throw new Error(`failed to load seniors: ${error.message}`);
  }

  const seniors = (data ?? [])
    .map((row) => row.senior)
    .filter((s): s is NonNullable<LinkRow["senior"]> => s !== null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Caregiver
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hi, {profile.display_name}
          </h1>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">People you care for</h2>
        {seniors.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-zinc-300 p-5 text-zinc-600">
            You haven&apos;t added anyone yet. Add the first person to get
            started.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {seniors.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/caregiver/seniors/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border-2 border-zinc-300 px-5 py-4 transition-colors active:bg-blue-50"
                >
                  <span className="flex flex-col">
                    <span className="text-lg font-medium text-zinc-900">
                      {s.display_name}
                    </span>
                    <span className="text-sm text-zinc-500">
                      {s.auth_user_id
                        ? `Timezone: ${s.timezone}`
                        : "Invite pending"}
                    </span>
                  </span>
                  <span aria-hidden className="text-2xl text-zinc-400">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/caregiver/seniors/new"
          className="flex h-14 items-center justify-center rounded-2xl bg-blue-700 px-5 text-lg font-semibold text-white"
        >
          Add someone
        </Link>
      </section>
    </main>
  );
}

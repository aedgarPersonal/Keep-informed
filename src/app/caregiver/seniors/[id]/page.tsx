import Link from "next/link";
import { headers } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { loadLinkedSenior } from "@/lib/seniors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InviteCard } from "./InviteCard";

export default async function SeniorDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const { invite } = await searchParams;

  const senior = await loadLinkedSenior(id);
  const supabase = await createSupabaseServerClient();

  // Materialize today's instances (idempotent), then count completions
  // by joining via instance ids — that avoids timezone-naive comparisons
  // on completions.completed_at.
  const { data: localToday } = await supabase.rpc("materialize_today", {
    p_senior: senior.id,
  });

  const { data: instances } = await supabase
    .from("task_instances")
    .select("id")
    .eq("senior_id", senior.id)
    .eq("date", localToday ?? "");
  const instanceIds = (instances ?? []).map((r) => r.id);
  const total = instanceIds.length;

  let done = 0;
  if (instanceIds.length > 0) {
    const { count } = await supabase
      .from("completions")
      .select("id", { count: "exact", head: true })
      .in("task_instance_id", instanceIds);
    done = count ?? 0;
  }

  let inviteUrl: string | null = null;
  if (invite) {
    const headerList = await headers();
    const proto = headerList.get("x-forwarded-proto") ?? "https";
    const host = headerList.get("host") ?? "localhost:3000";
    inviteUrl = `${proto}://${host}/claim/${invite}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/caregiver"
          className="self-start text-sm font-medium text-blue-700"
        >
          ← All people
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {senior.display_name}
        </h1>
        <p className="text-zinc-600">
          {senior.auth_user_id
            ? `Signed in. Timezone: ${senior.timezone}.`
            : "Hasn't signed in yet."}
        </p>
      </header>

      {inviteUrl && <InviteCard url={inviteUrl} />}

      <section className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 p-5">
        <h2 className="text-lg font-semibold">Today</h2>
        <p className="text-3xl font-semibold tracking-tight">
          {done} <span className="text-zinc-400">/</span> {total}
        </p>
        <p className="text-zinc-600">
          {total === 0
            ? "No tasks scheduled for today."
            : `tasks completed in ${senior.display_name}'s day.`}
        </p>
      </section>

      <nav className="flex flex-col gap-3">
        <Link
          href={`/caregiver/seniors/${senior.id}/tasks`}
          className="flex h-14 items-center justify-between rounded-2xl border-2 border-zinc-300 px-5 text-lg font-medium"
        >
          <span>Tasks</span>
          <span aria-hidden className="text-2xl text-zinc-400">›</span>
        </Link>
        <Link
          href={`/caregiver/seniors/${senior.id}/rewards`}
          className="flex h-14 items-center justify-between rounded-2xl border-2 border-zinc-300 px-5 text-lg font-medium"
        >
          <span>Personal rewards</span>
          <span aria-hidden className="text-2xl text-zinc-400">›</span>
        </Link>
        <Link
          href={`/caregiver/seniors/${senior.id}/caregivers`}
          className="flex h-14 items-center justify-between rounded-2xl border-2 border-zinc-300 px-5 text-lg font-medium"
        >
          <span>Caregivers</span>
          <span aria-hidden className="text-2xl text-zinc-400">›</span>
        </Link>
        <Link
          href={`/caregiver/seniors/${senior.id}/medication-review`}
          className="flex h-14 items-center justify-between rounded-2xl border-2 border-zinc-300 px-5 text-lg font-medium"
        >
          <span>
            Medication review{" "}
            <span className="text-sm font-normal text-zinc-500">(AI)</span>
          </span>
          <span aria-hidden className="text-2xl text-zinc-400">›</span>
        </Link>
      </nav>
    </main>
  );
}

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TodayChecklist, type Instance } from "./TodayChecklist";
import { TimezonePrompt } from "./TimezonePrompt";

type InstanceRow = {
  id: string;
  task: { title: string } | null;
};

export default async function TodayPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  // Idempotently materialize today's instances in the senior's tz,
  // then load them with their task titles.
  const { data: localToday } = await supabase.rpc("materialize_today", {
    p_senior: profile.id,
  });

  const { data: rows, error } = await supabase
    .from("task_instances")
    .select("id, task:tasks!task_id(title)")
    .eq("senior_id", profile.id)
    .eq("date", localToday ?? "")
    .returns<InstanceRow[]>();
  if (error) throw new Error(error.message);

  const instanceIds = (rows ?? []).map((r) => r.id);

  let completedSet = new Set<string>();
  if (instanceIds.length > 0) {
    const { data: comps } = await supabase
      .from("completions")
      .select("task_instance_id")
      .in("task_instance_id", instanceIds);
    completedSet = new Set(
      (comps ?? []).map((c) => c.task_instance_id as string),
    );
  }

  const instances: Instance[] = (rows ?? [])
    .map((r) => ({
      id: r.id,
      title: r.task?.title ?? "",
      completed: completedSet.has(r.id),
    }))
    .filter((i) => i.title);

  const dateLabel = localToday
    ? new Date(`${localToday}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: profile.timezone,
      })
    : new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Today
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {dateLabel}
        </h1>
      </header>

      <TimezonePrompt profileTimezone={profile.timezone} />

      {instances.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 p-5 text-zinc-600">
          No tasks scheduled for today.
        </p>
      ) : (
        <TodayChecklist instances={instances} />
      )}
    </main>
  );
}

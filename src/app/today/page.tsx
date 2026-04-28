import Link from "next/link";
import { requireSenior } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ColorName } from "@/lib/task-palette";
import { TodayChecklist, type Instance } from "./TodayChecklist";
import { TimezonePrompt } from "./TimezonePrompt";

type InstanceRow = {
  id: string;
  task: {
    id: string;
    title: string;
    color: ColorName | null;
    created_by: string;
    archived_at: string | null;
  } | null;
};

export default async function TodayPage() {
  const profile = await requireSenior();
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from("profiles")
    .select("senior_autonomy")
    .eq("id", profile.id)
    .maybeSingle();
  const autonomy =
    (row?.senior_autonomy as
      | "view_only"
      | "assisted"
      | "self_directed"
      | undefined) ?? "view_only";

  // Idempotently materialize today's instances in the senior's tz,
  // then load them with their task titles.
  const { data: localToday } = await supabase.rpc("materialize_today", {
    p_senior: profile.id,
  });

  const { data: rows, error } = await supabase
    .from("task_instances")
    .select(
      "id, task:tasks!task_id(id, title, color, created_by, archived_at)",
    )
    .eq("senior_id", profile.id)
    .eq("date", localToday ?? "")
    .returns<InstanceRow[]>();
  if (error) throw new Error(error.message);

  const instanceIds = (rows ?? []).map((r) => r.id);

  const completedAtById = new Map<string, string>();
  if (instanceIds.length > 0) {
    const { data: comps } = await supabase
      .from("completions")
      .select("task_instance_id, completed_at")
      .in("task_instance_id", instanceIds);
    for (const c of comps ?? []) {
      completedAtById.set(
        c.task_instance_id as string,
        c.completed_at as string,
      );
    }
  }

  const instances: Instance[] = (rows ?? [])
    .filter((r) => r.task && r.task.archived_at === null)
    .map((r) => ({
      id: r.id,
      taskId: r.task!.id,
      title: r.task!.title,
      color: r.task!.color,
      completed: completedAtById.has(r.id),
      completedAt: completedAtById.get(r.id) ?? null,
      ownTask: r.task!.created_by === profile.id,
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

      {autonomy !== "view_only" && (
        <Link
          href="/today/new"
          className="flex h-14 items-center justify-center rounded-2xl border-2 border-blue-700 text-lg font-semibold text-blue-700"
        >
          + Add a task
        </Link>
      )}
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSenior } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SeniorTaskForm, type SeniorTaskFormInitial } from "../../SeniorTaskForm";
import { type ColorName } from "@/lib/task-palette";

export default async function EditSeniorTaskPage({
  params,
}: {
  params: Promise<{ task: string }>;
}) {
  const profile = await requireSenior();
  const { task: taskId } = await params;
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

  if (autonomy === "view_only") {
    redirect("/today");
  }

  // Verify ownership server-side. RLS would also block writes via the
  // RPC, but a clean 404 here beats a confused-looking pre-filled form.
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, color, weekdays, due_date, created_by, archived_at")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) notFound();
  if (task.created_by !== profile.id || task.archived_at !== null) {
    notFound();
  }

  const allowRecurring = autonomy === "self_directed";
  const initial: SeniorTaskFormInitial = {
    title: (task.title as string) ?? "",
    schedule: task.due_date ? "one_off" : "recurring",
    weekdays: ((task.weekdays as number[] | null) ?? []) as number[],
    dueDate: (task.due_date as string | null) ?? "",
    color: (task.color as ColorName | null) ?? null,
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/today"
          className="self-start text-base font-medium text-blue-700"
        >
          ← Back
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Edit task</h1>
      </header>

      <SeniorTaskForm
        allowRecurring={allowRecurring}
        taskId={taskId}
        initial={initial}
      />
    </main>
  );
}

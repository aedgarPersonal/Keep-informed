import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { loadLinkedSenior } from "@/lib/seniors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewTaskForm } from "./NewTaskForm";
import { archiveTask } from "./actions";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function describeWeekdays(weekdays: number[]): string {
  if (weekdays.length === 7) return "Daily";
  if (
    weekdays.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => weekdays.includes(d))
  ) {
    return "Weekdays";
  }
  if (
    weekdays.length === 2 &&
    [0, 6].every((d) => weekdays.includes(d))
  ) {
    return "Weekends";
  }
  return [...weekdays].sort().map((d) => DAY_LABELS[d]).join(" ");
}

export default async function TasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const senior = await loadLinkedSenior(id);
  const supabase = await createSupabaseServerClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, weekdays")
    .eq("senior_id", senior.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Link
          href={`/caregiver/seniors/${senior.id}`}
          className="self-start text-sm font-medium text-blue-700"
        >
          ← {senior.display_name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
      </header>

      <section className="flex flex-col gap-3">
        {(tasks ?? []).length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-zinc-300 p-5 text-zinc-600">
            No tasks yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(tasks ?? []).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-zinc-200 px-5 py-4"
              >
                <span className="flex flex-col">
                  <span className="text-lg font-medium">{t.title}</span>
                  <span className="text-sm text-zinc-500">
                    {describeWeekdays(t.weekdays as number[])}
                  </span>
                </span>
                <form action={archiveTask}>
                  <input type="hidden" name="senior_id" value={senior.id} />
                  <input type="hidden" name="task_id" value={t.id} />
                  <button
                    type="submit"
                    className="text-sm font-medium text-red-700"
                  >
                    Archive
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 p-5">
        <h2 className="text-lg font-semibold">Add a task</h2>
        <NewTaskForm seniorId={senior.id} />
      </section>
    </main>
  );
}

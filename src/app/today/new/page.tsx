import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSenior } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SeniorTaskForm } from "./SeniorTaskForm";

export default async function NewSeniorTaskPage() {
  const profile = await requireSenior();
  const supabase = await createSupabaseServerClient();

  // Read autonomy fresh; we don't trust caller-provided level on writes
  // (the RPC re-checks) but the form needs to know which fields to show.
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

  const allowRecurring = autonomy === "self_directed";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/today"
          className="self-start text-base font-medium text-blue-700"
        >
          ← Back
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Add a task</h1>
        {!allowRecurring && (
          <p className="text-zinc-600">
            One-time tasks only. Ask a caregiver to add anything that should
            repeat.
          </p>
        )}
      </header>

      <SeniorTaskForm allowRecurring={allowRecurring} />
    </main>
  );
}

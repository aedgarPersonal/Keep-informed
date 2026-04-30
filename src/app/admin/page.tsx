import { createSupabaseServerClient } from "@/lib/supabase/server";

// Caregiver shape returned inside list_billing_groups.caregivers.
type AdminCaregiver = {
  caregiver_id: string;
  display_name: string;
  email: string | null;
  joined_at: string | null;
};

type BillingGroup = {
  senior_id: string;
  senior_name: string;
  senior_email: string | null;
  senior_claimed: boolean;
  senior_created_at: string;
  senior_autonomy: "view_only" | "assisted" | "self_directed";
  active_task_count: number;
  last_completion_at: string | null;
  completions_30d: number;
  caregivers: AdminCaregiver[];
};

const AUTONOMY_LABELS: Record<BillingGroup["senior_autonomy"], string> = {
  view_only:     "View-only",
  assisted:      "Assisted",
  self_directed: "Self-directed",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year:  "numeric",
    month: "short",
    day:   "numeric",
  });
}

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  // The Supabase types don't know the shape of our table-returning
  // RPCs (no schema generation in this project), so we cast through
  // unknown after validating `error`.
  const { data, error } = await supabase.rpc("list_billing_groups");

  if (error) {
    throw new Error(`failed to load billing groups: ${error.message}`);
  }

  const groups = (data ?? []) as unknown as BillingGroup[];
  const totalCaregivers = groups.reduce(
    (n, g) => n + g.caregivers.length,
    0,
  );
  const claimedSeniors = groups.filter((g) => g.senior_claimed).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Admin
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Billing groups
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {groups.length}{" "}
          {groups.length === 1 ? "group" : "groups"} · {claimedSeniors} claimed
          seniors · {totalCaregivers} caregivers
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 p-5 text-zinc-600">
          No groups yet. A billing group is created the first time a caregiver
          links a senior.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((g) => (
            <li
              key={g.senior_id}
              className="rounded-2xl border-2 border-zinc-200 p-5"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex flex-col">
                    <h2 className="text-xl font-semibold">{g.senior_name}</h2>
                    <p className="text-sm text-zinc-500">
                      {g.senior_claimed
                        ? g.senior_email ?? "claimed (no email on record)"
                        : "Invite pending — placeholder profile"}
                      {" · "}
                      {AUTONOMY_LABELS[g.senior_autonomy]}
                      {" · created "}
                      {formatDate(g.senior_created_at)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">
                      {g.active_task_count} active{" "}
                      {g.active_task_count === 1 ? "task" : "tasks"}
                    </p>
                    <p className="text-zinc-500">
                      {g.completions_30d} completions / 30d
                      {g.last_completion_at
                        ? ` · last ${formatDate(g.last_completion_at)}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Caregivers ({g.caregivers.length})
                  </p>
                  {g.caregivers.length === 0 ? (
                    <p className="text-sm text-zinc-500">None active.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {g.caregivers.map((c) => (
                        <li key={c.caregiver_id} className="text-sm">
                          <span className="font-medium">{c.display_name}</span>
                          {c.email ? (
                            <span className="text-zinc-500"> · {c.email}</span>
                          ) : null}
                          {c.joined_at ? (
                            <span className="text-zinc-400">
                              {" · joined "}
                              {formatDate(c.joined_at)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

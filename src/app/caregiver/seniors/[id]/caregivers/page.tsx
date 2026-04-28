import Link from "next/link";
import { headers } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { loadLinkedSenior } from "@/lib/seniors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InviteCard } from "../InviteCard";
import { createCaregiverInvite, revokeLink } from "./actions";

type LinkRow = {
  id: string;
  status: "pending" | "active" | "revoked";
  invite_code: string | null;
  caregiver: { id: string; display_name: string } | null;
};

export default async function CaregiversPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const me = await requireProfile();
  const { id } = await params;
  const { invite } = await searchParams;
  const senior = await loadLinkedSenior(id);
  const supabase = await createSupabaseServerClient();

  const { data: links, error } = await supabase
    .from("senior_caregiver_links")
    .select(
      "id, status, invite_code, caregiver:profiles!caregiver_id(id, display_name)",
    )
    .eq("senior_id", senior.id)
    .neq("status", "revoked")
    .order("created_at", { ascending: true })
    .returns<LinkRow[]>();
  if (error) throw new Error(error.message);

  const active = (links ?? []).filter((l) => l.status === "active");
  const pending = (links ?? []).filter((l) => l.status === "pending");

  let freshInviteUrl: string | null = null;
  if (invite) {
    const headerList = await headers();
    const proto = headerList.get("x-forwarded-proto") ?? "https";
    const host = headerList.get("host") ?? "localhost:3000";
    freshInviteUrl = `${proto}://${host}/caregiver-invite/${invite}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Link
          href={`/caregiver/seniors/${senior.id}`}
          className="self-start text-sm font-medium text-blue-700"
        >
          ← {senior.display_name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Caregivers</h1>
        <p className="text-zinc-600">
          Anyone listed here can see and edit {senior.display_name}&apos;s
          tasks and rewards.
        </p>
      </header>

      {freshInviteUrl && <InviteCard url={freshInviteUrl} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Active</h2>
        <ul className="flex flex-col gap-2">
          {active.map((l) => {
            const isMe = l.caregiver?.id === me.id;
            return (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-zinc-200 px-5 py-4"
              >
                <span className="text-base font-medium">
                  {l.caregiver?.display_name}
                  {isMe && (
                    <span className="ml-2 text-sm font-normal text-zinc-500">
                      (you)
                    </span>
                  )}
                </span>
                {!isMe && (
                  <form action={revokeLink}>
                    <input
                      type="hidden"
                      name="senior_id"
                      value={senior.id}
                    />
                    <input type="hidden" name="link_id" value={l.id} />
                    <button
                      type="submit"
                      className="text-sm font-medium text-red-700"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Pending invites</h2>
          <ul className="flex flex-col gap-2">
            {pending.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-zinc-200 px-5 py-4"
              >
                <span className="font-mono text-sm">
                  /caregiver-invite/{l.invite_code}
                </span>
                <form action={revokeLink}>
                  <input type="hidden" name="senior_id" value={senior.id} />
                  <input type="hidden" name="link_id" value={l.id} />
                  <button
                    type="submit"
                    className="text-sm font-medium text-red-700"
                  >
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action={createCaregiverInvite}>
        <input type="hidden" name="senior_id" value={senior.id} />
        <button
          type="submit"
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-blue-700 text-lg font-semibold text-white"
        >
          Invite another caregiver
        </button>
      </form>
    </main>
  );
}

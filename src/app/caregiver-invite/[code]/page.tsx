import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClaimButton } from "./ClaimButton";

type Lookup = { senior_name: string; inviter_name: string };

export default async function CaregiverInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: lookupRows } = await supabase.rpc("lookup_caregiver_invite", {
    p_code: code,
  });
  const lookup: Lookup | null =
    Array.isArray(lookupRows) && lookupRows.length > 0
      ? (lookupRows[0] as Lookup)
      : null;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const greeting = lookup
    ? `${lookup.inviter_name} invited you to help care for ${lookup.senior_name}.`
    : "You've been invited to help care for someone.";

  if (user) {
    // Authed. If they don't have a profile yet, send them through onboard
    // first — claim_caregiver_invite needs a profile to attach to.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return (
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-semibold">Almost there</h1>
          <p className="text-zinc-600">{greeting}</p>
          <p className="text-zinc-600">
            Set up your account first, then come back to this link.
          </p>
          <Link
            href={`/onboard`}
            className="flex h-14 items-center justify-center rounded-2xl bg-blue-700 text-lg font-semibold text-white"
          >
            Set up account
          </Link>
        </main>
      );
    }

    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
        <header className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            You&apos;ve been invited
          </h1>
          <p className="text-zinc-600">{greeting}</p>
        </header>
        <ClaimButton code={code} />
      </main>
    );
  }

  // Unauthed — bounce through /login with next= back here.
  const next = `/caregiver-invite/${encodeURIComponent(code)}`;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          You&apos;ve been invited
        </h1>
        <p className="text-zinc-600">{greeting}</p>
        <p className="text-zinc-600">Sign in to accept.</p>
      </header>
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="flex h-14 items-center justify-center rounded-2xl bg-blue-700 text-lg font-semibold text-white"
      >
        Sign in
      </Link>
    </main>
  );
}

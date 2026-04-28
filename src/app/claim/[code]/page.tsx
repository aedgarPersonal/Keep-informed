import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClaimButton } from "./ClaimButton";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();

  // Look up the placeholder display name via a SECURITY DEFINER RPC
  // — the placeholder isn't linked yet so RLS would block a direct
  // select. The code itself is the access token.
  const { data: placeholderName } = await supabase.rpc(
    "lookup_senior_invite",
    { p_code: code },
  );
  const placeholder = placeholderName ? { display_name: placeholderName } : null;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  // Already authed — check whether they already have a profile.
  if (user) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (existing) {
      return (
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-semibold">This invite can&apos;t be used</h1>
          <p className="text-zinc-600">
            You&apos;re already signed in with another account. Sign out
            and reopen the link to claim it.
          </p>
        </main>
      );
    }

    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
        <header className="flex flex-col gap-1 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
        </header>
        <ClaimButton
          code={code}
          greeting={
            placeholder
              ? `Is this you, ${placeholder.display_name}?`
              : "Tap below to set up your account."
          }
        />
      </main>
    );
  }

  // Unauthed — bounce to /login with a `next` back to this page.
  const next = `/claim/${encodeURIComponent(code)}`;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {placeholder
            ? `Hi ${placeholder.display_name}`
            : "Welcome to Keep Informed"}
        </h1>
        <p className="text-zinc-600">
          Sign in with your email to finish setting up your account.
        </p>
      </header>
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="flex h-16 items-center justify-center rounded-2xl bg-blue-700 px-6 text-xl font-semibold text-white"
      >
        Sign in
      </Link>
    </main>
  );
}

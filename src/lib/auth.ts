import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string; // auth.users.id
  email: string | null;
};

export type Profile = {
  id: string;
  display_name: string;
  timezone: string;
};

/** Redirect to /login if the request is unauthenticated. */
export async function requireSession(redirectTo?: string): Promise<SessionUser> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    const next = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : "";
    redirect(`/login${next}`);
  }
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Require both a session and a profile. Redirects to /onboard for
 * authed users who haven't bootstrapped one yet. The profile is
 * looked up via auth_user_id because RLS lets the caller see linked
 * seniors' profiles as well as their own.
 */
export async function requireProfile(): Promise<Profile> {
  const user = await requireSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, timezone")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) {
    throw new Error(`profile lookup failed: ${error.message}`);
  }
  if (!data) {
    redirect("/onboard");
  }
  return data;
}

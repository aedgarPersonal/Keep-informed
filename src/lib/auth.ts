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

/**
 * Profile id of the calling user, intended for server-action use
 * (no redirect — throws on missing). Use requireProfile() in pages.
 */
export async function getCallerProfileId(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (!profile) throw new Error("no profile");
  return profile.id;
}

/**
 * "Is this profile the senior in some active link?" — derives senior-ness
 * from the link table. A new caregiver who hasn't added anyone yet is
 * not a senior anywhere; a person who claimed an invite is.
 */
async function isSeniorInAnyLink(profileId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("senior_caregiver_links")
    .select("id")
    .eq("senior_id", profileId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Allow only people who are not currently a senior-in-care. A new
 * caregiver with zero links passes; a senior who claimed an invite
 * is bounced to /today.
 */
export async function requireCaregiver(): Promise<Profile> {
  const profile = await requireProfile();
  if (await isSeniorInAnyLink(profile.id)) {
    redirect("/today");
  }
  return profile;
}

/**
 * Allow only people who are seniors in at least one active link.
 * Caregivers (including new ones with zero links) are bounced to
 * /caregiver — /today is meaningless for them.
 */
export async function requireSenior(): Promise<Profile> {
  const profile = await requireProfile();
  if (!(await isSeniorInAnyLink(profile.id))) {
    redirect("/caregiver");
  }
  return profile;
}

/**
 * Allow only app admins (rows in `app_admins`). Admins are
 * orthogonal to the senior/caregiver model — they don't need a
 * `profiles` row. Non-admins are bounced to the homepage rather
 * than /onboard so we don't push admin-only users into a profile
 * they don't need.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("is_app_admin");
  if (error) {
    throw new Error(`admin check failed: ${error.message}`);
  }
  if (!data) {
    redirect("/");
  }
  return user;
}

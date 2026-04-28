import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCallerProfileId } from "@/lib/auth";

export type Senior = {
  id: string;
  display_name: string;
  timezone: string;
  invite_code: string | null;
  auth_user_id: string | null;
};

/**
 * Load a senior the caller is linked to as a caregiver. Returns 404
 * if no active caregiver link exists — even if RLS would otherwise
 * let the row through (e.g. the caller is the senior themselves
 * looking at their own profile via /caregiver/seniors/<self>/...).
 */
export async function loadLinkedSenior(seniorId: string): Promise<Senior> {
  const supabase = await createSupabaseServerClient();
  const callerId = await getCallerProfileId();

  const { data: link } = await supabase
    .from("senior_caregiver_links")
    .select("id")
    .eq("senior_id", seniorId)
    .eq("caregiver_id", callerId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!link) {
    notFound();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, timezone, invite_code, auth_user_id")
    .eq("id", seniorId)
    .maybeSingle();
  if (error) {
    throw new Error(`failed to load senior: ${error.message}`);
  }
  if (!data) {
    notFound();
  }
  return data;
}

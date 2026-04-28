import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Senior = {
  id: string;
  display_name: string;
  timezone: string;
  invite_code: string | null;
  auth_user_id: string | null;
};

/**
 * Load a senior the caller is linked to. Returns 404 if no link exists
 * — RLS already restricts visibility, but we want a clean not-found
 * experience instead of a confusing empty result.
 */
export async function loadLinkedSenior(seniorId: string): Promise<Senior> {
  const supabase = await createSupabaseServerClient();
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

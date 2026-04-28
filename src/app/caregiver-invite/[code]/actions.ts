"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClaimCaregiverState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function claimCaregiverInvite(
  _prev: ClaimCaregiverState,
  formData: FormData,
): Promise<ClaimCaregiverState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    return { status: "error", message: "Missing invite code." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("claim_caregiver_invite", {
    p_code: code,
  });
  if (error) {
    return { status: "error", message: error.message };
  }
  redirect("/caregiver");
}

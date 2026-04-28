"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClaimState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function claimSeniorProfile(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    return { status: "error", message: "Missing invite code." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("claim_senior_profile", {
    p_code: code,
  });
  if (error) {
    return { status: "error", message: error.message };
  }
  redirect("/today");
}

"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OnboardState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function bootstrapProfile(
  _prev: OnboardState,
  formData: FormData,
): Promise<OnboardState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "UTC").trim() || "UTC";

  if (!displayName) {
    return { status: "error", message: "Please enter your name." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("bootstrap_self_profile", {
    p_display_name: displayName,
    p_timezone: timezone,
  });
  if (error) {
    return { status: "error", message: error.message };
  }
  redirect("/caregiver");
}

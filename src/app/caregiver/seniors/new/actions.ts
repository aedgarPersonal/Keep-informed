"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateSeniorState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function createSenior(
  _prev: CreateSeniorState,
  formData: FormData,
): Promise<CreateSeniorState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "UTC").trim() || "UTC";

  if (!displayName) {
    return { status: "error", message: "Please enter their name." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("create_senior_profile", {
      p_display_name: displayName,
      p_timezone: timezone,
    })
    .single<{ senior_id: string; invite_code: string }>();

  if (error || !data) {
    return {
      status: "error",
      message: error?.message ?? "Failed to create profile.",
    };
  }

  redirect(`/caregiver/seniors/${data.senior_id}?invite=${data.invite_code}`);
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createCaregiverInvite(formData: FormData): Promise<void> {
  const seniorId = String(formData.get("senior_id") ?? "");
  if (!seniorId) return;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("create_caregiver_invite", { p_senior: seniorId })
    .single<string>();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create invite");
  }

  redirect(`/caregiver/seniors/${seniorId}/caregivers?invite=${data}`);
}

export async function revokeLink(formData: FormData): Promise<void> {
  const seniorId = String(formData.get("senior_id") ?? "");
  const linkId = String(formData.get("link_id") ?? "");
  if (!seniorId || !linkId) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_caregiver_link", {
    p_link: linkId,
  });
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/caregiver/seniors/${seniorId}/caregivers`);
}

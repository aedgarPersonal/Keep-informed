"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AutonomyLevel } from "./AutonomyForm";

export async function setSeniorAutonomy(
  seniorId: string,
  level: AutonomyLevel,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_senior_autonomy", {
    p_senior: seniorId,
    p_level: level,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/caregiver/seniors/${seniorId}`);
}

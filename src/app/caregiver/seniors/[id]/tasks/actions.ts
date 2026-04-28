"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCallerProfileId } from "@/lib/auth";

export type TaskFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const ALL_DAYS: number[] = [0, 1, 2, 3, 4, 5, 6];

function parseWeekdays(formData: FormData): number[] {
  const raw = formData.getAll("weekdays").map((v) => Number(v));
  const valid = raw.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return valid.length > 0 ? Array.from(new Set(valid)).sort() : ALL_DAYS;
}

export async function createTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const seniorId = String(formData.get("senior_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const weekdays = parseWeekdays(formData);

  if (!seniorId) return { status: "error", message: "Missing senior id." };
  if (!title) return { status: "error", message: "Please enter a title." };

  const supabase = await createSupabaseServerClient();
  const profileId = await getCallerProfileId();

  const { error } = await supabase.from("tasks").insert({
    senior_id: seniorId,
    title,
    weekdays,
    created_by: profileId,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath(`/caregiver/seniors/${seniorId}/tasks`);
  return { status: "idle" };
}

export async function archiveTask(formData: FormData): Promise<void> {
  const seniorId = String(formData.get("senior_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!seniorId || !taskId) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", taskId);

  revalidatePath(`/caregiver/seniors/${seniorId}/tasks`);
}

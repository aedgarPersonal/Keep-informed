"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCallerProfileId } from "@/lib/auth";
import { isColorName } from "@/lib/task-palette";
import { isTaskCategory } from "@/lib/task-templates";

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

  const categoryRaw = formData.get("category");
  const category = isTaskCategory(categoryRaw) ? categoryRaw : "other";

  const colorRaw = String(formData.get("color") ?? "").trim();
  const color = isColorName(colorRaw) ? colorRaw : null;

  const notesRaw = String(formData.get("notes") ?? "").trim();
  const notes = notesRaw.length > 0 ? notesRaw.slice(0, 500) : null;

  if (!seniorId) return { status: "error", message: "Missing senior id." };
  if (!title) return { status: "error", message: "Please enter a title." };

  const supabase = await createSupabaseServerClient();
  const profileId = await getCallerProfileId();

  const { error } = await supabase.from("tasks").insert({
    senior_id: seniorId,
    title,
    weekdays,
    category,
    color,
    notes,
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

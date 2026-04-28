"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCallerProfileId } from "@/lib/auth";
import { pickReward, type Reward } from "@/lib/rewards";

const BUCKET = "personal-rewards";
const RECENT_LIMIT = 4;

type PersonalRewardRow = {
  id: string;
  kind: "photo" | "note";
  body: string | null;
  media_path: string | null;
};

export type CompleteResult =
  | { ok: true; taskInstanceId: string; reward: Reward }
  | { ok: false; message: string };

export async function completeTaskInstance(
  taskInstanceId: string,
): Promise<CompleteResult> {
  if (!taskInstanceId) {
    return { ok: false, message: "Missing task instance." };
  }
  const supabase = await createSupabaseServerClient();
  const seniorId = await getCallerProfileId();

  // 1. Verify the instance belongs to the senior. RLS would block
  // anything else but the explicit error is friendlier.
  const { data: inst } = await supabase
    .from("task_instances")
    .select("id, senior_id")
    .eq("id", taskInstanceId)
    .maybeSingle();
  if (!inst || inst.senior_id !== seniorId) {
    return { ok: false, message: "Task not found." };
  }

  // 2. Recent reward keys (dedup window) and personal pool, in parallel.
  const [{ data: recent }, { data: personalRows }] = await Promise.all([
    supabase
      .from("completions")
      .select("reward_key")
      .eq("senior_id", seniorId)
      .not("reward_key", "is", null)
      .order("completed_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("personal_rewards")
      .select("id, kind, body, media_path")
      .eq("senior_id", seniorId)
      .eq("active", true)
      .returns<PersonalRewardRow[]>(),
  ]);

  const recentKeys = (recent ?? [])
    .map((r) => r.reward_key as string | null)
    .filter((k): k is string => !!k);

  const personal: Reward[] = (personalRows ?? []).map((r) => ({
    source: "personal" as const,
    key: `personal:${r.id}`,
    kind: r.kind,
    body: r.body ?? "",
    // mediaUrl filled in below for the chosen reward only.
  }));

  // 3. Pick. Picker is pure; do it server-side so client never sees
  // the curated pool's full text or the personal media paths.
  const picked = pickReward({ personal, recentKeys });

  // 4. If the pick is a personal photo, sign its URL.
  if (picked.source === "personal") {
    const row = (personalRows ?? []).find(
      (r) => `personal:${r.id}` === picked.key,
    );
    if (row?.media_path) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.media_path, 60 * 10); // 10 min
      if (signed?.signedUrl) {
        picked.mediaUrl = signed.signedUrl;
      }
    }
  }

  // 5. Record the completion. If this fails (e.g. duplicate) we still
  // tell the client the reward — better UX than a generic error.
  const { error: rpcErr } = await supabase.rpc("record_completion", {
    p_task_instance: taskInstanceId,
    p_reward_key: picked.key,
  });
  if (rpcErr) {
    return { ok: false, message: rpcErr.message };
  }

  revalidatePath("/today");
  return { ok: true, taskInstanceId, reward: picked };
}

export type UndoResult =
  | { ok: true; taskInstanceId: string }
  | { ok: false; message: string };

export async function undoCompletion(
  taskInstanceId: string,
): Promise<UndoResult> {
  if (!taskInstanceId) {
    return { ok: false, message: "Missing task instance." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("undo_completion", {
    p_task_instance: taskInstanceId,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  revalidatePath("/today");
  return { ok: true, taskInstanceId };
}

export type AddTaskState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function addSeniorTask(
  _prev: AddTaskState,
  formData: FormData,
): Promise<AddTaskState> {
  const title = String(formData.get("title") ?? "").trim();
  const colorRaw = String(formData.get("color") ?? "").trim();
  const color = colorRaw.length > 0 ? colorRaw : null;
  const schedule = String(formData.get("schedule") ?? "one_off");

  if (!title) return { status: "error", message: "Please enter a title." };

  let weekdays: number[] | null = null;
  let dueDate: string | null = null;

  if (schedule === "one_off") {
    const dueRaw = String(formData.get("due_date") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) {
      return { status: "error", message: "Please pick a date." };
    }
    dueDate = dueRaw;
  } else {
    const raw = formData.getAll("weekdays").map((v) => Number(v));
    const valid = raw.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    weekdays = valid.length > 0 ? Array.from(new Set(valid)).sort() : [0, 1, 2, 3, 4, 5, 6];
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("senior_create_task", {
    p_title: title,
    p_color: color,
    p_weekdays: weekdays,
    p_due_date: dueDate,
  });
  if (error) return { status: "error", message: error.message };

  redirect("/today");
}

export async function editSeniorTask(
  _prev: AddTaskState,
  formData: FormData,
): Promise<AddTaskState> {
  const taskId = String(formData.get("task_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const colorRaw = String(formData.get("color") ?? "").trim();
  const color = colorRaw.length > 0 ? colorRaw : null;
  const schedule = String(formData.get("schedule") ?? "one_off");

  if (!taskId) return { status: "error", message: "Missing task." };
  if (!title) return { status: "error", message: "Please enter a title." };

  let weekdays: number[] | null = null;
  let dueDate: string | null = null;

  if (schedule === "one_off") {
    const dueRaw = String(formData.get("due_date") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) {
      return { status: "error", message: "Please pick a date." };
    }
    dueDate = dueRaw;
  } else {
    const raw = formData.getAll("weekdays").map((v) => Number(v));
    const valid = raw.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    weekdays =
      valid.length > 0
        ? Array.from(new Set(valid)).sort()
        : [0, 1, 2, 3, 4, 5, 6];
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("senior_update_task", {
    p_task: taskId,
    p_title: title,
    p_color: color,
    p_weekdays: weekdays,
    p_due_date: dueDate,
  });
  if (error) return { status: "error", message: error.message };

  redirect("/today");
}

export async function archiveOwnTask(formData: FormData): Promise<void> {
  const taskId = String(formData.get("task_id") ?? "");
  if (!taskId) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("senior_archive_task", { p_task: taskId });
  revalidatePath("/today");
}

export async function updateTimezone(timezone: string): Promise<void> {
  if (!timezone) return;
  const supabase = await createSupabaseServerClient();
  const seniorId = await getCallerProfileId();
  await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", seniorId);
  revalidatePath("/today");
}

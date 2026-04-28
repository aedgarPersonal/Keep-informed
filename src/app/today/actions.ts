"use server";

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

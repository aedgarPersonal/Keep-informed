"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCallerProfileId } from "@/lib/auth";

export type RewardFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const BUCKET = "personal-rewards";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB cap

export async function addNoteReward(
  _prev: RewardFormState,
  formData: FormData,
): Promise<RewardFormState> {
  const seniorId = String(formData.get("senior_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!seniorId) return { status: "error", message: "Missing senior id." };
  if (!body) return { status: "error", message: "Note can't be empty." };
  if (body.length > 280) {
    return { status: "error", message: "Notes are limited to 280 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const profileId = await getCallerProfileId();

  const { error } = await supabase.from("personal_rewards").insert({
    senior_id: seniorId,
    kind: "note",
    body,
    created_by: profileId,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath(`/caregiver/seniors/${seniorId}/rewards`);
  return { status: "idle" };
}

export async function addPhotoReward(
  _prev: RewardFormState,
  formData: FormData,
): Promise<RewardFormState> {
  const seniorId = String(formData.get("senior_id") ?? "");
  const file = formData.get("file");
  const caption = String(formData.get("caption") ?? "").trim() || null;

  if (!seniorId) return { status: "error", message: "Missing senior id." };
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Please choose a photo." };
  }
  if (file.size > MAX_BYTES) {
    return { status: "error", message: "Photo is over 10 MB." };
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { status: "error", message: "JPEG, PNG, WebP, or HEIC only." };
  }

  const supabase = await createSupabaseServerClient();
  const profileId = await getCallerProfileId();

  const rewardId = crypto.randomUUID();
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${seniorId}/${rewardId}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { status: "error", message: upErr.message };

  const { error: insErr } = await supabase.from("personal_rewards").insert({
    id: rewardId,
    senior_id: seniorId,
    kind: "photo",
    body: caption,
    media_path: path,
    created_by: profileId,
  });
  if (insErr) {
    // Best-effort cleanup of the orphan upload.
    await supabase.storage.from(BUCKET).remove([path]);
    return { status: "error", message: insErr.message };
  }

  revalidatePath(`/caregiver/seniors/${seniorId}/rewards`);
  return { status: "idle" };
}

export async function deactivateReward(formData: FormData): Promise<void> {
  const seniorId = String(formData.get("senior_id") ?? "");
  const rewardId = String(formData.get("reward_id") ?? "");
  if (!seniorId || !rewardId) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("personal_rewards")
    .update({ active: false })
    .eq("id", rewardId);

  revalidatePath(`/caregiver/seniors/${seniorId}/rewards`);
}

import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { loadLinkedSenior } from "@/lib/seniors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NoteForm, PhotoForm } from "./Forms";
import { deactivateReward } from "./actions";

const BUCKET = "personal-rewards";

type RewardRow = {
  id: string;
  kind: "photo" | "note";
  body: string | null;
  media_path: string | null;
  created_at: string;
};

export default async function RewardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const senior = await loadLinkedSenior(id);
  const supabase = await createSupabaseServerClient();

  const { data: rewards, error } = await supabase
    .from("personal_rewards")
    .select("id, kind, body, media_path, created_at")
    .eq("senior_id", senior.id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .returns<RewardRow[]>();
  if (error) throw new Error(error.message);

  // Mint signed URLs for the photo paths in one batch.
  const photoPaths = (rewards ?? [])
    .filter((r): r is RewardRow & { media_path: string } => !!r.media_path)
    .map((r) => r.media_path);
  const signedByPath = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(photoPaths, 60 * 60); // 1 hour
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <Link
          href={`/caregiver/seniors/${senior.id}`}
          className="self-start text-sm font-medium text-blue-700"
        >
          ← {senior.display_name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Personal rewards
        </h1>
        <p className="text-zinc-600">
          Photos and notes shown to {senior.display_name} after they
          finish a task.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        {(rewards ?? []).length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-zinc-300 p-5 text-zinc-600">
            No personal rewards yet. {senior.display_name} will see jokes
            and fun facts until you add some.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(rewards ?? []).map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 p-4"
              >
                {r.kind === "photo" && r.media_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signedByPath.get(r.media_path) ?? ""}
                    alt={r.body ?? "Personal photo"}
                    className="w-full rounded-xl object-cover"
                  />
                )}
                {r.body && (
                  <p className="text-base leading-snug text-zinc-900">
                    {r.body}
                  </p>
                )}
                <form action={deactivateReward} className="self-end">
                  <input type="hidden" name="senior_id" value={senior.id} />
                  <input type="hidden" name="reward_id" value={r.id} />
                  <button
                    type="submit"
                    className="text-sm font-medium text-red-700"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 p-5">
        <h2 className="text-lg font-semibold">Add a note</h2>
        <NoteForm seniorId={senior.id} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 p-5">
        <h2 className="text-lg font-semibold">Add a photo</h2>
        <PhotoForm seniorId={senior.id} />
      </section>
    </main>
  );
}

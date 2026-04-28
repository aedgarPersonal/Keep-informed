import { requireProfile } from "@/lib/auth";

export default async function CaregiverPage() {
  const profile = await requireProfile();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Caregiver
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Hi, {profile.display_name}
        </h1>
      </header>
      <p className="text-zinc-600">
        Senior management lands in the next slice. For now this just
        confirms auth + onboarding worked end-to-end.
      </p>
    </main>
  );
}

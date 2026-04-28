import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { OnboardForm } from "./OnboardForm";

export default async function OnboardPage() {
  const user = await requireSession("/onboard");

  // If a profile already exists, skip straight to the caregiver view.
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existing) {
    redirect("/caregiver");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Set up your account
        </h1>
        <p className="text-zinc-600">
          Just a name so people you care for can recognize you.
        </p>
      </header>
      <OnboardForm />
    </main>
  );
}

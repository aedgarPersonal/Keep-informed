import { requireProfile } from "@/lib/auth";
import { CreateSeniorForm } from "./CreateSeniorForm";

export default async function NewSeniorPage() {
  const profile = await requireProfile();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Add someone
        </h1>
        <p className="text-zinc-600">
          We&apos;ll create their profile so you can set up tasks right
          away. They claim it later by signing in.
        </p>
      </header>
      <CreateSeniorForm defaultTimezone={profile.timezone} />
    </main>
  );
}

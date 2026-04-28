import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-zinc-600">
          Enter your email and we&apos;ll send you a one-tap sign-in link.
        </p>
      </header>
      <LoginForm next={next} />
    </main>
  );
}

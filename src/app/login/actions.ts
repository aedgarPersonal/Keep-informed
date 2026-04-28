"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = String(formData.get("next") ?? "");

  if (!email || !email.includes("@")) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `https://${headerList.get("host") ?? "localhost:3000"}`;
  const redirectTo = next
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/auth/callback`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    return { status: "error", message: error.message };
  }
  return { status: "sent", email };
}

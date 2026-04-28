import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { loadLinkedSenior } from "@/lib/seniors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAnthropic } from "@/lib/medication-review/client";
import {
  ReviewResultSchema,
  type ReviewResult,
  type Severity,
} from "@/lib/medication-review/types";
import { acceptDisclaimer, updateMedicalNotes } from "./actions";
import { RunButton } from "./RunButton";

const SEVERITY_STYLES: Record<Severity, string> = {
  info: "border-zinc-300 bg-zinc-50 text-zinc-900",
  possible_issue: "border-amber-300 bg-amber-50 text-amber-900",
  discuss_now: "border-red-400 bg-red-50 text-red-900",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  info: "FYI",
  possible_issue: "Worth checking",
  discuss_now: "Discuss now",
};

const OVERALL_LABEL: Record<ReviewResult["overall_assessment"], string> = {
  no_obvious_issues: "No obvious issues",
  review_with_clinician: "Worth reviewing with a clinician",
  discuss_now: "Discuss with a clinician now",
};

const Disclaimer = () => (
  <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
    <p className="font-semibold">This is not medical advice.</p>
    <p className="mt-1">
      The AI review is a triage prompt to help you decide what to bring up with
      a doctor or pharmacist. It only sees what you&apos;ve typed into this
      app — not allergies, full med lists, lab results, or anything else.
      Always talk to a clinician before changing or stopping a medication.
    </p>
  </div>
);

export default async function MedicationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireProfile();
  const { id } = await params;
  const senior = await loadLinkedSenior(id);
  const supabase = await createSupabaseServerClient();

  const apiConfigured = Boolean(getAnthropic());

  // Latest review for the headline view, plus a small history strip.
  const { data: reviews } = await supabase
    .from("medication_reviews")
    .select("id, result, created_at, model")
    .eq("senior_id", senior.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const latest = reviews?.[0];
  const latestResult = latest
    ? ReviewResultSchema.safeParse(latest.result)
    : null;

  // Senior's medical notes — read fresh; the senior dashboard doesn't
  // surface them so this page is the canonical editor.
  const { data: seniorWithNotes } = await supabase
    .from("profiles")
    .select("medical_notes")
    .eq("id", senior.id)
    .maybeSingle();

  const { data: meWithDisclaimer } = await supabase
    .from("profiles")
    .select("accepted_ai_disclaimer_at")
    .eq("id", me.id)
    .maybeSingle();
  const hasAccepted = Boolean(meWithDisclaimer?.accepted_ai_disclaimer_at);

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
          Medication review
        </h1>
        <p className="text-zinc-600">
          AI triage for medications you&apos;ve added to {senior.display_name}.
        </p>
      </header>

      <Disclaimer />

      {!apiConfigured ? (
        <div className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-700">
          AI review is not configured on this server. Set{" "}
          <code className="font-mono">ANTHROPIC_API_KEY</code> to enable it.
        </div>
      ) : !hasAccepted ? (
        <form action={acceptDisclaimer} className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-300 p-5">
          <p className="text-base text-zinc-900">
            Before running a review, please confirm you understand:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
            <li>This is not medical advice.</li>
            <li>
              The model only sees what you&apos;ve typed here — not allergies,
              labs, or other medications.
            </li>
            <li>
              You won&apos;t change or stop a medication based on what it says
              without talking to a doctor or pharmacist.
            </li>
          </ul>
          <button
            type="submit"
            className="flex h-12 items-center justify-center rounded-2xl bg-blue-700 text-base font-semibold text-white"
          >
            I understand, continue
          </button>
        </form>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 p-5">
            <h2 className="text-lg font-semibold">Medical context</h2>
            <p className="text-sm text-zinc-600">
              Caregiver-only. The senior never sees this. Add age, conditions,
              allergies — anything that helps the review.
            </p>
            <form action={updateMedicalNotes} className="flex flex-col gap-3">
              <input type="hidden" name="senior_id" value={senior.id} />
              <textarea
                name="medical_notes"
                rows={4}
                maxLength={2000}
                defaultValue={seniorWithNotes?.medical_notes ?? ""}
                className="rounded-2xl border-2 border-zinc-300 px-4 py-3 text-base"
                placeholder="82 years old. Allergic to penicillin. CKD stage 3, mild liver impairment."
              />
              <button
                type="submit"
                className="flex h-12 items-center justify-center rounded-2xl border-2 border-zinc-300 text-base font-medium"
              >
                Save notes
              </button>
            </form>
          </section>

          <RunButton seniorId={senior.id} />

          {latestResult?.success ? (
            <ReviewView result={latestResult.data} createdAt={latest!.created_at} />
          ) : latest ? (
            <p className="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-600">
              The latest review couldn&apos;t be parsed. Run a new one.
            </p>
          ) : (
            <p className="rounded-2xl border-2 border-dashed border-zinc-300 p-5 text-zinc-600">
              No reviews yet.
            </p>
          )}

          {(reviews?.length ?? 0) > 1 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Previous reviews
              </h2>
              <ul className="flex flex-col gap-1 text-sm text-zinc-600">
                {reviews!.slice(1).map((r) => (
                  <li key={r.id}>
                    {new Date(r.created_at).toLocaleString()} · {r.model}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function ReviewView({
  result,
  createdAt,
}: {
  result: ReviewResult;
  createdAt: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-zinc-500">
          Reviewed {new Date(createdAt).toLocaleString()}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          {OVERALL_LABEL[result.overall_assessment]}
        </h2>
      </div>

      {result.findings.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {result.findings.map((f, i) => (
            <li
              key={i}
              className={`flex flex-col gap-2 rounded-2xl border-2 p-4 ${SEVERITY_STYLES[f.severity]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold">{f.title}</h3>
                <span className="rounded-full border border-current px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
                  {SEVERITY_LABEL[f.severity]}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{f.description}</p>
              {f.related_medications.length > 0 && (
                <p className="text-xs">
                  Related: {f.related_medications.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border-2 border-zinc-200 p-4 text-sm text-zinc-600">
          The review didn&apos;t surface any findings.
        </p>
      )}

      {result.not_in_scope.length > 0 && (
        <div className="rounded-2xl border-2 border-zinc-200 p-4 text-sm text-zinc-700">
          <p className="font-semibold">What the AI couldn&apos;t see</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {result.not_in_scope.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm italic text-zinc-600">{result.caveat}</p>
    </section>
  );
}

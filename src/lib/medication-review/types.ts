import { z } from "zod";

// The AI's response is constrained to this shape via output_config.format
// (Zod). Keep this schema and the wording calibrated to "talk to your
// doctor or pharmacist" — the UI renders these fields directly.

export const SeveritySchema = z.enum([
  "info",
  "possible_issue",
  "discuss_now",
]);
export type Severity = z.infer<typeof SeveritySchema>;

export const FindingSchema = z.object({
  severity: SeveritySchema,
  title: z.string().describe("Short headline, ≤80 chars"),
  description: z
    .string()
    .describe(
      "1–3 sentences. State the concern, name the medication(s), and recommend a clinician conversation. Never assert dose changes.",
    ),
  related_medications: z
    .array(z.string())
    .describe("Titles of the tasks this finding concerns, as listed in input"),
});
export type Finding = z.infer<typeof FindingSchema>;

export const ReviewResultSchema = z.object({
  overall_assessment: z.enum([
    "no_obvious_issues",
    "review_with_clinician",
    "discuss_now",
  ]),
  not_in_scope: z
    .array(z.string())
    .describe(
      "Things the model couldn't see and that affect the review (e.g. allergies, kidney function, full med list outside this app, weight, age unless provided).",
    ),
  findings: z.array(FindingSchema),
  caveat: z
    .string()
    .describe(
      "Standard reminder, ≤200 chars, that this is not medical advice and the user should talk to a doctor or pharmacist.",
    ),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

// Structure of input_snapshot we send to the model and persist on the row.
export type ReviewInput = {
  senior_display_name: string;
  senior_timezone: string;
  senior_medical_notes: string | null;
  medications: Array<{
    title: string;
    color: string | null;
    notes: string | null;
    schedule: string; // human-readable: "Daily", "Mon Wed Fri", "May 5", etc.
  }>;
};

// Starter library for the "Quick start" template picker on the
// caregiver task screen. Templates pre-fill the form; the caregiver
// can edit before saving. Adding a template is a PR, not a config —
// they ship with the app.

export type TaskCategory =
  | "hygiene"
  | "medication"
  | "appointment"
  | "checkin"
  | "other";

export type Template = {
  id: string; // stable, used as React key
  category: TaskCategory;
  title: string;
  defaultWeekdays?: number[]; // omit = daily
};

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  hygiene:     "Hygiene",
  medication:  "Medication",
  appointment: "Appointment",
  checkin:     "Check-in",
  other:       "Other",
};

export const TEMPLATES: Template[] = [
  // Hygiene
  { id: "hyg-brush",   category: "hygiene", title: "Brush teeth" },
  { id: "hyg-shower",  category: "hygiene", title: "Shower" },
  { id: "hyg-shave",   category: "hygiene", title: "Shave" },
  { id: "hyg-hair",    category: "hygiene", title: "Wash hair" },
  { id: "hyg-nails",   category: "hygiene", title: "Trim nails", defaultWeekdays: [0] },

  // Medication — caregiver should add color + notes per pill
  { id: "med-morning",   category: "medication", title: "Morning medication" },
  { id: "med-afternoon", category: "medication", title: "Afternoon medication" },
  { id: "med-evening",   category: "medication", title: "Evening medication" },

  // Appointments — recurring only in v1; one-offs deferred
  { id: "appt-doctor", category: "appointment", title: "Doctor visit" },
  { id: "appt-pt",     category: "appointment", title: "Physical therapy" },

  // Check-in
  { id: "ck-walk", category: "checkin", title: "Daily walk" },
  { id: "ck-call", category: "checkin", title: "Phone call with family" },
];

export function isTaskCategory(value: unknown): value is TaskCategory {
  return (
    typeof value === "string" &&
    (value === "hygiene" ||
      value === "medication" ||
      value === "appointment" ||
      value === "checkin" ||
      value === "other")
  );
}

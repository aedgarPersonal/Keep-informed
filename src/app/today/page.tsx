import { TodayChecklist } from "./TodayChecklist";

// Placeholder tasks for the UI-only scaffold. Will be replaced by a
// query against `task_instances` once auth + DB are wired up.
const MOCK_TASKS = [
  { id: "1", title: "Take morning medication" },
  { id: "2", title: "Brush teeth" },
  { id: "3", title: "Drink a glass of water" },
  { id: "4", title: "Short walk outside" },
];

export default function TodayPage() {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Today
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {dateLabel}
        </h1>
      </header>

      <TodayChecklist tasks={MOCK_TASKS} />
    </main>
  );
}

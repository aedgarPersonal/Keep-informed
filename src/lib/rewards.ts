// Curated rewards shown after a task is completed.
// Will move to the `rewards` table once the DB is wired up; the shape
// here matches that table.

export type Reward = {
  kind: "joke" | "fact";
  body: string;
};

export const REWARDS: Reward[] = [
  { kind: "joke", body: "Why don't skeletons fight each other? They don't have the guts." },
  { kind: "joke", body: "I told my computer I needed a break — it said \"no problem, I'll go to sleep.\"" },
  { kind: "joke", body: "What do you call a fish wearing a crown? Your royal haddock." },
  { kind: "fact", body: "Honey never spoils. Archaeologists have found 3,000-year-old honey still good to eat." },
  { kind: "fact", body: "Octopuses have three hearts and blue blood." },
  { kind: "fact", body: "The Eiffel Tower can grow more than 6 inches taller in summer." },
];

export function pickRandomReward(): Reward {
  return REWARDS[Math.floor(Math.random() * REWARDS.length)];
}

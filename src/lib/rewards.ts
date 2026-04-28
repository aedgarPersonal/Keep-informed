// Reward shapes and the picker. See docs/data-model.md#rewards.
//
// Curated rewards live in this module. Personal rewards come from the
// `personal_rewards` table at runtime — for now the picker accepts an
// empty array and the senior gets curated only.

export type RewardKind = "joke" | "fact" | "photo" | "note";

export type Reward = {
  /** "curated:<key>" or "personal:<uuid>" — written to completions.reward_key. */
  key: string;
  source: "curated" | "personal";
  kind: RewardKind;
  body: string;
  /** Signed URL for personal photos; undefined for everything else. */
  mediaUrl?: string;
};

const CURATED: Reward[] = [
  { source: "curated", key: "curated:skeleton", kind: "joke", body: "Why don't skeletons fight each other? They don't have the guts." },
  { source: "curated", key: "curated:computer-break", kind: "joke", body: "I told my computer I needed a break — it said \"no problem, I'll go to sleep.\"" },
  { source: "curated", key: "curated:royal-haddock", kind: "joke", body: "What do you call a fish wearing a crown? Your royal haddock." },
  { source: "curated", key: "curated:cantaloupe", kind: "joke", body: "I tried to organize a hide-and-seek tournament. It was a disaster — good players are hard to find." },
  { source: "curated", key: "curated:kangaroo", kind: "joke", body: "What do you call a kangaroo who's had a long day? Pouched out." },
  { source: "curated", key: "curated:pencil", kind: "joke", body: "I'd tell you a pencil joke, but it would be pointless." },
  { source: "curated", key: "curated:honey", kind: "fact", body: "Honey never spoils. Archaeologists have found 3,000-year-old honey still good to eat." },
  { source: "curated", key: "curated:octopus", kind: "fact", body: "Octopuses have three hearts and blue blood." },
  { source: "curated", key: "curated:eiffel", kind: "fact", body: "The Eiffel Tower can grow more than 6 inches taller in summer." },
  { source: "curated", key: "curated:wombat", kind: "fact", body: "Wombats produce cube-shaped droppings — the only animal in the world that does." },
  { source: "curated", key: "curated:bananas", kind: "fact", body: "Bananas are berries, but strawberries are not." },
  { source: "curated", key: "curated:sea-otters", kind: "fact", body: "Sea otters hold hands while they sleep so they don't drift apart." },
];

export type PickRewardOptions = {
  /** Personal pool for this senior. Empty for unauthenticated/scaffold use. */
  personal?: Reward[];
  /** Last N reward keys shown to this senior. */
  recentKeys?: string[];
  /** 0..1 — probability of preferring personal when both pools have fresh items. */
  personalRatio?: number;
};

const DEFAULT_PERSONAL_RATIO = 0.7;

/**
 * Pick one reward. Always returns something — never throws on empty
 * pools, never returns undefined. See docs/data-model.md#picker.
 */
export function pickReward({
  personal = [],
  recentKeys = [],
  personalRatio = DEFAULT_PERSONAL_RATIO,
}: PickRewardOptions = {}): Reward {
  const recent = new Set(recentKeys);
  const fresh = (pool: Reward[]) => pool.filter((r) => !recent.has(r.key));

  const freshPersonal = fresh(personal);
  const freshCurated = fresh(CURATED);

  const preferPersonal =
    freshPersonal.length > 0 && Math.random() < personalRatio;

  if (preferPersonal) return pick(freshPersonal);
  if (freshCurated.length > 0) return pick(freshCurated);
  if (freshPersonal.length > 0) return pick(freshPersonal);

  // Both fresh views empty — drop the dedup constraint rather than
  // return nothing. Prefer the union so we still bias towards
  // personal if available.
  return pick(personal.length > 0 ? [...personal, ...CURATED] : CURATED);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

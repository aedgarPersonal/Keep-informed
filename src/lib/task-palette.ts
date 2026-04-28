// Curated color palette for tasks. Names match the
// tasks_color_in_palette CHECK constraint in the DB.
//
// Use the `strip` Tailwind class for a 6px left-edge accent on a
// white tile. The `dot` class is for swatch buttons in the picker.
// Both pass WCAG against white.

export type ColorName =
  | "pink"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "brown";

export const COLOR_NAMES: ColorName[] = [
  "pink",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "brown",
];

export const COLOR_LABELS: Record<ColorName, string> = {
  pink:   "Pink",
  red:    "Red",
  orange: "Orange",
  yellow: "Yellow",
  green:  "Green",
  blue:   "Blue",
  purple: "Purple",
  brown:  "Brown",
};

// Tailwind class strings rather than raw hex so we get hover/active
// states for free and stay in the existing design system.
export const COLOR_BG: Record<ColorName, string> = {
  pink:   "bg-pink-500",
  red:    "bg-red-600",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green:  "bg-green-600",
  blue:   "bg-blue-600",
  purple: "bg-purple-600",
  brown:  "bg-amber-800",
};

export function isColorName(value: unknown): value is ColorName {
  return typeof value === "string" && COLOR_NAMES.includes(value as ColorName);
}

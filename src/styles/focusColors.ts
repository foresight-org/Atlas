/**
 * Focus colors for the public community globe.
 * A pin mixes these in proportion to how many people named each area.
 * Someone who picks two areas adds one to each color.
 */

export const FOCUS_COLOR_ORDER = [
  "Secure AI",
  "Neurotechnology",
  "Longevity Biotechnology",
  "Nanotechnology",
  "Space",
  "Existential Hope",
  "No focus area",
] as const;

export type FocusColorName = (typeof FOCUS_COLOR_ORDER)[number];

export const FOCUS_CLUSTER_KEYS: Array<{ key: string; label: FocusColorName }> = [
  { key: "focusSecureAi", label: "Secure AI" },
  { key: "focusNeuro", label: "Neurotechnology" },
  { key: "focusLongevity", label: "Longevity Biotechnology" },
  { key: "focusNano", label: "Nanotechnology" },
  { key: "focusSpace", label: "Space" },
  { key: "focusHope", label: "Existential Hope" },
  { key: "focusUnset", label: "No focus area" },
];

/**
 * Same pastel recipe as the role pins: a light start, a slightly deeper end,
 * and a muted text color. Mixed pins use the end color, the way program badges do.
 */
const FOCUS_COLORS: Record<FocusColorName, { start: string; end: string; text: string }> = {
  "Secure AI": { start: "#e8e6ff", end: "#cfc9f7", text: "#4a4578" },
  Neurotechnology: { start: "#ffe4ee", end: "#f5c6d8", text: "#7a3d55" },
  "Longevity Biotechnology": { start: "#e5f7ea", end: "#bfe8cc", text: "#2d5a3d" },
  Nanotechnology: { start: "#fff1e0", end: "#ffd7b0", text: "#8a4e28" },
  Space: { start: "#e6fbff", end: "#c2eef5", text: "#1a5c68" },
  "Existential Hope": { start: "#fde8f3", end: "#f6cfe4", text: "#7a3d62" },
  "No focus area": { start: "#f4f6f8", end: "#dce3ea", text: "#4b5563" },
};

export function focusColor(name: string): { start: string; end: string; text: string } {
  return FOCUS_COLORS[name as FocusColorName] ?? FOCUS_COLORS["No focus area"];
}

export function getFocusGradient(name: string): string {
  const color = focusColor(name);
  return `linear-gradient(135deg, ${color.start} 0%, ${color.end} 100%)`;
}

/**
 * One area is its gradient. Several areas split the badge into equal pastel
 * slices, matching the program pins.
 */
export function focusMixBackground(counts: Record<string, number>): string {
  const parts = FOCUS_COLOR_ORDER.filter((name) => (Number(counts[name]) || 0) > 0);
  if (parts.length <= 1) return getFocusGradient(parts[0] || "No focus area");
  const sweep = 360 / parts.length;
  const stops = parts.map((name, index) => {
    const start = index * sweep;
    const end = (index + 1) * sweep;
    return `${focusColor(name).end} ${start}deg ${end}deg`;
  });
  return `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

export function focusCountsFromProperties(properties: Record<string, unknown>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { key, label } of FOCUS_CLUSTER_KEYS) {
    const n = Number(properties[key]) || 0;
    if (n > 0) counts[label] = n;
  }
  return counts;
}

export function hasFocusCounts(counts: Record<string, number> | undefined): boolean {
  if (!counts) return false;
  return Object.values(counts).some((n) => n > 0);
}

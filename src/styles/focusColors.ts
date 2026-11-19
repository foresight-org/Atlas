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
  "Not yet chosen",
] as const;

export type FocusColorName = (typeof FOCUS_COLOR_ORDER)[number];

export const FOCUS_CLUSTER_KEYS: Array<{ key: string; label: FocusColorName }> = [
  { key: "focusSecureAi", label: "Secure AI" },
  { key: "focusNeuro", label: "Neurotechnology" },
  { key: "focusLongevity", label: "Longevity Biotechnology" },
  { key: "focusNano", label: "Nanotechnology" },
  { key: "focusSpace", label: "Space" },
  { key: "focusHope", label: "Existential Hope" },
  { key: "focusUnset", label: "Not yet chosen" },
];

const FOCUS_COLORS: Record<FocusColorName, { start: string; end: string; text: string }> = {
  "Secure AI": { start: "#ddd6fe", end: "#4f46e5", text: "#312e81" },
  Neurotechnology: { start: "#fecdd3", end: "#e11d48", text: "#9f1239" },
  "Longevity Biotechnology": { start: "#a7f3d0", end: "#059669", text: "#065f46" },
  Nanotechnology: { start: "#fde68a", end: "#d97706", text: "#92400e" },
  Space: { start: "#bae6fd", end: "#0284c7", text: "#075985" },
  "Existential Hope": { start: "#fbcfe8", end: "#c026d3", text: "#86198f" },
  "Not yet chosen": { start: "#e2e8f0", end: "#94a3b8", text: "#334155" },
};

export function focusColor(name: string): { start: string; end: string; text: string } {
  return FOCUS_COLORS[name as FocusColorName] ?? FOCUS_COLORS["Not yet chosen"];
}

/** Proportional mix. One area is a gradient; several split the circle by count. */
export function focusMixBackground(counts: Record<string, number>): string {
  const parts = FOCUS_COLOR_ORDER
    .map((name) => ({ name, n: Number(counts[name]) || 0 }))
    .filter((part) => part.n > 0);
  const sum = parts.reduce((total, part) => total + part.n, 0);
  if (sum === 0 || parts.length === 0) {
    const unset = FOCUS_COLORS["Not yet chosen"];
    return `linear-gradient(135deg, ${unset.start} 0%, ${unset.end} 100%)`;
  }
  if (parts.length === 1) {
    const color = focusColor(parts[0].name);
    return `linear-gradient(135deg, ${color.start} 0%, ${color.end} 100%)`;
  }
  let cursor = 0;
  const stops = parts.map((part) => {
    const sweep = (part.n / sum) * 360;
    const start = cursor;
    cursor += sweep;
    return `${focusColor(part.name).end} ${start}deg ${cursor}deg`;
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

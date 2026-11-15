/**
 * Where memory sits on the globe.
 *
 * Berlin and San Francisco are Foresight nodes. Cape Town is an affiliate
 * and runs the pipeline on its own compute. India, Barcelona, and Brazil
 * are in conversation: visible, not openable, no graph yet.
 *
 * Coordinates for Berlin and San Francisco match the programming pages.
 */

import type { MemoryArc, MemoryPlace } from "../types/nodeMemory";

export const MEMORY_PLACES: MemoryPlace[] = [
  {
    id: "berlin",
    name: "Berlin",
    kind: "node",
    lon: 13.405,
    lat: 52.52,
    summary: "Clubhouse, daily coworking, local compute.",
    stewardship:
      "Kept by Foresight. Shaped so the pipeline can run on this Node’s own compute.",
  },
  {
    id: "sf",
    name: "San Francisco",
    kind: "node",
    lon: -122.4194,
    lat: 37.7749,
    summary: "Bay Area node. Salons, labs, and the other half of several Berlin conversations.",
    stewardship:
      "Kept by Foresight. Shaped so the pipeline can run on this Node’s own compute.",
  },
  {
    id: "cape-town",
    name: "Cape Town",
    kind: "affiliate",
    lon: 18.4241,
    lat: -33.9249,
    summary: "Affiliate node. Its own room, its own machines, a memory the whole community can read.",
    stewardship:
      "Affiliate. Capture through graph runs on Cape Town’s own compute. Atlas holds the memory members can read.",
  },
  {
    id: "india",
    name: "India",
    kind: "conversation",
    lon: 77.5946,
    lat: 12.9716,
    summary: "In conversation. No memory published yet.",
    stewardship: "",
  },
  {
    id: "barcelona",
    name: "Barcelona",
    kind: "conversation",
    lon: 2.1686,
    lat: 41.3874,
    summary: "In conversation. No memory published yet.",
    stewardship: "",
  },
  {
    id: "brazil",
    name: "Brazil",
    kind: "conversation",
    lon: -46.6396,
    lat: -23.5558,
    summary: "In conversation. No memory published yet.",
    stewardship: "",
  },
];

/** Solid arcs are shared memory. Open arcs are a conversation that has not become a graph. */
export const MEMORY_ARCS: MemoryArc[] = [
  { from: "berlin", to: "sf", open: false },
  { from: "berlin", to: "cape-town", open: false },
  { from: "sf", to: "cape-town", open: false },
  { from: "berlin", to: "barcelona", open: true },
  { from: "sf", to: "india", open: true },
  { from: "sf", to: "brazil", open: true },
];

const PLACE_NAMES = new Map(MEMORY_PLACES.map((place) => [place.id, place.name]));

export function memoryPlaceName(id: string): string {
  return PLACE_NAMES.get(id) ?? id;
}

export function memoryPlace(id: string): MemoryPlace | undefined {
  return MEMORY_PLACES.find((place) => place.id === id);
}

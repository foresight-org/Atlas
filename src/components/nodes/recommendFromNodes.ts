/**
 * People already in the directory, ranked by what a Node's conversations
 * are about. A name that is not in the directory is never shown.
 *
 * Primary nodes stay the real ones: Global, Berlin, Bay Area.
 * An affiliate room can still recommend those people. It does not become
 * a node someone can set on their profile.
 */

import { MEMORY_PLACES } from "../../data/nodeMemoryPlaces";
import type { Person, PrimaryNode } from "../../types";
import type { MemoryTopic, NodeGraph } from "../../types/nodeMemory";

const PLACE_NODE: Record<string, PrimaryNode> = {
  berlin: "Berlin Node",
  sf: "Bay Area Node",
};

/** Words a problem often sits next to in this community, so a profile that says "AI" can meet "inference". */
const KIN: Record<string, string[]> = {
  inference: ["ai", "model", "models", "ml"],
  model: ["ai", "ml", "inference"],
  models: ["ai", "ml", "inference"],
  neurotech: ["neuro", "brain", "bci"],
  biostasis: ["longevity", "cryonics"],
  governance: ["policy"],
  privacy: ["security"],
  attestation: ["security", "hardware"],
  enclave: ["security", "hardware", "privacy"],
  compute: ["cluster", "energy"],
  cooling: ["energy", "climate", "water"],
  water: ["climate", "energy"],
  molecular: ["bio", "biotech"],
  lab: ["biosecurity", "bio"],
};

const STOP = new Set(["and", "the", "for", "with", "from", "that", "this", "into", "over"]);

export interface NodeTalk {
  person: Person;
  problem: string;
  placeId: string;
  placeName: string;
  /** Their own sentence, when they wrote one. */
  line: string;
}

function words(text: string): { direct: Set<string>; extra: Set<string> } {
  const direct = new Set<string>();
  const extra = new Set<string>();
  for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (word.length < 3 || STOP.has(word)) continue;
    direct.add(word);
    const stem = word.replace(/(ing|tion|ment|ness)$/, "");
    if (stem.length >= 5) direct.add(stem);
    for (const alt of KIN[word] ?? []) extra.add(alt);
  }
  return { direct, extra };
}

function hits(needle: Set<string>, hay: Set<string>): number {
  let count = 0;
  for (const word of needle) {
    if (hay.has(word)) {
      count += 1;
      continue;
    }
    for (const other of hay) {
      const [shorter, longer] = word.length < other.length ? [word, other] : [other, word];
      if (shorter.length >= 5 && longer.startsWith(shorter)) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

function profileWords(person: Person): Set<string> {
  return words(
    [
      (Array.isArray(person.focusTags) ? person.focusTags : []).join(" "),
      person.currentlyLookingFor,
      person.shortProjectTagline,
      person.expandedProjectDescription,
      person.roleType,
      person.affiliationOrInstitution ?? "",
    ].join(" "),
  ).direct;
}

function placeName(placeId: string): string {
  return MEMORY_PLACES.find((place) => place.id === placeId)?.name ?? placeId;
}

function neighbors(graph: NodeGraph, topic: MemoryTopic): MemoryTopic[] {
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === topic.id) ids.add(edge.target);
    if (edge.target === topic.id) ids.add(edge.source);
  }
  return graph.topics.filter((entry) => ids.has(entry.id));
}

interface Scored {
  person: Person;
  problem: string;
  placeId: string;
  score: number;
}

function scoreGraph(graph: NodeGraph, placeId: string, people: Person[], viewerId: string): Scored[] {
  const problems = graph.topics.filter((topic) => topic.kind === "problem");
  const seeds = problems.length > 0 ? problems : graph.topics;
  const scored: Scored[] = [];

  for (const person of people) {
    if (person.id === viewerId || !person.fullName.trim()) continue;
    const hay = profileWords(person);
    if (hay.size === 0) continue;
    let best = 0;
    let problem = seeds[0]?.label ?? "";
    for (const seed of seeds) {
      const seedWords = words([seed.label, ...neighbors(graph, seed).map((topic) => topic.label)].join(" "));
      let score = hits(seedWords.direct, hay) * 3 + hits(seedWords.extra, hay);
      const home = PLACE_NODE[placeId];
      if (home && person.primaryNode === home && person.primaryNode !== "Alumni") score += 1;
      for (const shared of seed.sharedWith) {
        const node = PLACE_NODE[shared];
        if (node && person.primaryNode === node) score += 2;
      }
      if (score > best) {
        best = score;
        problem = seed.label;
      }
    }
    if (best >= 3) scored.push({ person, problem, placeId, score: best });
  }

  for (const insight of graph.insights) {
    const named = insight.recommendation?.name?.trim().toLowerCase();
    if (insight.type !== "intro" || !named) continue;
    const person = people.find((entry) => entry.fullName.trim().toLowerCase() === named);
    if (!person || person.id === viewerId) continue;
    scored.push({
      person,
      problem: insight.topic || insight.title,
      placeId,
      score: 100,
    });
  }

  return scored;
}

/** One card per person. The strongest conversation wins. */
export function talksFromGraphs(
  graphs: Array<{ placeId: string; graph: NodeGraph }>,
  people: Person[],
  viewerId: string,
  limit = 6,
): NodeTalk[] {
  const roster = Array.isArray(people) ? people : [];
  const best = new Map<string, Scored>();
  for (const { placeId, graph } of graphs) {
    if (!graph?.topics) continue;
    for (const row of scoreGraph(graph, placeId, roster, viewerId)) {
      const current = best.get(row.person.id);
      if (!current || row.score > current.score) best.set(row.person.id, row);
    }
  }
  const ranked = [...best.values()].sort(
    (a, b) => b.score - a.score || a.person.fullName.localeCompare(b.person.fullName),
  );
  const picked: Scored[] = [];
  const seenProblems = new Set<string>();
  for (const row of ranked) {
    if (seenProblems.has(row.problem)) continue;
    picked.push(row);
    seenProblems.add(row.problem);
    if (picked.length >= limit) break;
  }
  for (const row of ranked) {
    if (picked.length >= limit) break;
    if (picked.some((entry) => entry.person.id === row.person.id)) continue;
    picked.push(row);
  }
  return picked.map((row) => ({
      person: row.person,
      problem: row.problem,
      placeId: row.placeId,
      placeName: placeName(row.placeId),
      line: (row.person.currentlyLookingFor || row.person.shortProjectTagline || "").replace(/\s+/g, " ").trim(),
    }));
}

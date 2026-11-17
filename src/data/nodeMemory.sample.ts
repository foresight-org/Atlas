/**
 * Prototype memory for Team Days.
 *
 * Every topic carries the conversations it was mentioned in. Edges are
 * derived from those mentions, so a window — one conversation, one salon,
 * a week, a month, all time — is the same graph with a smaller set of
 * conversations. Nothing here is a transcript or a name.
 *
 * The clock is fixed at 15 Nov 2026 so "this week" and "this month" stay
 * populated for the demo, whatever the wall clock says.
 */

import type {
  MemoryConversation,
  MemoryEdge,
  MemoryEvent,
  MemoryInsight,
  MemoryMention,
  MemoryTopic,
  MemoryTopicKind,
  NodeGraph,
} from "../types/nodeMemory";

export const SAMPLE_CLOCK = "2026-11-15";

type MentionSeed = readonly [conversationId: string, at: string];

function topic(
  id: string,
  label: string,
  kind: MemoryTopicKind,
  sharedWith: string[],
  mentions: readonly MentionSeed[],
): MemoryTopic {
  let firstSeen = mentions[0]?.[1] ?? SAMPLE_CLOCK;
  const recorded: MemoryMention[] = [];
  const conversations = new Set<string>();
  for (const [conversationId, at] of mentions) {
    recorded.push({ conversationId, at });
    conversations.add(conversationId);
    if (at < firstSeen) firstSeen = at;
  }
  return {
    id,
    label,
    kind,
    sharedWith,
    firstSeen,
    weight: conversations.size,
    mentions: recorded,
  };
}

/** Two topics that share a conversation become an edge. Weight is how often. */
export function linkTopics(topics: readonly MemoryTopic[]): MemoryEdge[] {
  const byConversation = new Map<string, string[]>();
  for (const entry of topics) {
    for (const mention of entry.mentions) {
      const list = byConversation.get(mention.conversationId);
      if (list) list.push(entry.id);
      else byConversation.set(mention.conversationId, [entry.id]);
    }
  }

  const weights = new Map<string, number>();
  for (const ids of byConversation.values()) {
    const unique = [...new Set(ids)];
    for (let left = 0; left < unique.length; left += 1) {
      for (let right = left + 1; right < unique.length; right += 1) {
        const a = unique[left];
        const b = unique[right];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        weights.set(key, (weights.get(key) ?? 0) + 1);
      }
    }
  }

  const edges: MemoryEdge[] = [];
  for (const [key, weight] of weights) {
    const [source, target] = key.split("|");
    edges.push({ source, target, weight });
  }
  return edges;
}

function graph(
  topics: MemoryTopic[],
  events: MemoryEvent[],
  conversations: MemoryConversation[],
  insights: MemoryInsight[],
): NodeGraph {
  return { topics, edges: linkTopics(topics), events, conversations, insights };
}

const BERLIN_EVENTS: MemoryEvent[] = [
  { id: "ber-oct", label: "October salon", start: "2026-10-16", end: "2026-10-17" },
  { id: "ber-cowork", label: "Coworking, early November", start: "2026-11-02", end: "2026-11-02" },
  { id: "ber-nov", label: "November salon", start: "2026-11-12", end: "2026-11-13" },
];

const BERLIN_CONVERSATIONS: MemoryConversation[] = [
  { id: "ber-oct-inference", eventId: "ber-oct", label: "Inference table", at: "2026-10-16" },
  { id: "ber-oct-bio", eventId: "ber-oct", label: "Bio corner", at: "2026-10-16" },
  { id: "ber-oct-hall", eventId: "ber-oct", label: "Evening hallway", at: "2026-10-17" },
  { id: "ber-nov-early", eventId: "ber-cowork", label: "Monday coworking", at: "2026-11-02" },
  { id: "ber-nov-attest", eventId: "ber-nov", label: "Attestation table", at: "2026-11-12" },
  { id: "ber-nov-memory", eventId: "ber-nov", label: "Memory of the room", at: "2026-11-12" },
  { id: "ber-nov-compute", eventId: "ber-nov", label: "Compute closet", at: "2026-11-13" },
];

const SF_EVENTS: MemoryEvent[] = [
  { id: "sf-oct", label: "October lab night", start: "2026-10-22", end: "2026-10-22" },
  { id: "sf-nov", label: "November bridge salon", start: "2026-11-13", end: "2026-11-13" },
];

const SF_CONVERSATIONS: MemoryConversation[] = [
  { id: "sf-oct-lab", eventId: "sf-oct", label: "Lab bench", at: "2026-10-22" },
  { id: "sf-oct-policy", eventId: "sf-oct", label: "Policy corner", at: "2026-10-22" },
  { id: "sf-nov-bridge", eventId: "sf-nov", label: "Bridge table", at: "2026-11-13" },
  { id: "sf-nov-proof", eventId: "sf-nov", label: "Proof-carrying corner", at: "2026-11-13" },
];

const CAPE_EVENTS: MemoryEvent[] = [
  { id: "cpt-oct", label: "October circle", start: "2026-10-29", end: "2026-10-29" },
  { id: "cpt-nov", label: "November affiliate circle", start: "2026-11-08", end: "2026-11-14" },
];

const CAPE_CONVERSATIONS: MemoryConversation[] = [
  { id: "cpt-oct-water", eventId: "cpt-oct", label: "Water and machines", at: "2026-10-29" },
  { id: "cpt-nov-circle", eventId: "cpt-nov", label: "Sunday circle", at: "2026-11-08" },
  { id: "cpt-nov-dry", eventId: "cpt-nov", label: "Dry compute table", at: "2026-11-14" },
];

const BERLIN: NodeGraph = graph(
  [
    topic("confidential-inference", "Confidential inference", "topic", ["sf"], [
      ["ber-oct-inference", "2026-10-16"],
      ["ber-nov-attest", "2026-11-12"],
    ]),
    topic("attested-inference", "Attested inference", "term", [], [
      ["ber-nov-attest", "2026-11-12"],
      ["ber-nov-compute", "2026-11-13"],
    ]),
    topic("hardware-attestation", "Hardware attestation", "problem", [], [
      ["ber-oct-inference", "2026-10-16"],
      ["ber-nov-attest", "2026-11-12"],
    ]),
    topic("local-models", "Local models", "topic", [], [
      ["ber-oct-inference", "2026-10-16"],
      ["ber-nov-early", "2026-11-02"],
      ["ber-nov-compute", "2026-11-13"],
    ]),
    topic("key-management", "Key management", "problem", [], [
      ["ber-oct-inference", "2026-10-16"],
      ["ber-nov-attest", "2026-11-12"],
    ]),
    topic("de-identification", "De-identification", "topic", [], [
      ["ber-oct-hall", "2026-10-17"],
      ["ber-nov-memory", "2026-11-12"],
    ]),
    topic("speaker-consent", "Speaker consent", "topic", [], [
      ["ber-oct-hall", "2026-10-17"],
      ["ber-nov-memory", "2026-11-12"],
    ]),
    topic("salon-format", "Salon format", "topic", [], [
      ["ber-oct-hall", "2026-10-17"],
      ["ber-nov-memory", "2026-11-12"],
    ]),
    topic("breakout-memory", "Breakout memory", "term", [], [
      ["ber-nov-memory", "2026-11-12"],
    ]),
    topic("neurotech-readouts", "Neurotech readouts", "topic", ["sf"], [
      ["ber-oct-bio", "2026-10-16"],
      ["ber-nov-memory", "2026-11-12"],
    ]),
    topic("biostasis-logistics", "Biostasis logistics", "problem", [], [
      ["ber-oct-bio", "2026-10-16"],
    ]),
    topic("molecular-machines", "Molecular machines", "topic", ["cape-town"], [
      ["ber-oct-bio", "2026-10-16"],
      ["ber-nov-compute", "2026-11-13"],
    ]),
    topic("lab-governance", "Lab governance", "problem", [], [
      ["ber-oct-hall", "2026-10-17"],
    ]),
    topic("node-compute", "Node compute", "topic", [], [
      ["ber-nov-early", "2026-11-02"],
      ["ber-nov-compute", "2026-11-13"],
    ]),
    topic("joint-salon", "Joint salon", "topic", ["sf"], [
      ["ber-nov-memory", "2026-11-12"],
    ]),
    topic("water-and-compute", "Water and compute", "topic", ["cape-town"], [
      ["ber-nov-early", "2026-11-02"],
      ["ber-nov-compute", "2026-11-13"],
    ]),
    topic("thursday-rhythm", "Thursday rhythm", "topic", [], [
      ["ber-nov-early", "2026-11-02"],
    ]),
    topic("guest-protocol", "Guest protocol", "term", [], [
      ["ber-nov-early", "2026-11-02"],
    ]),
  ],
  BERLIN_EVENTS,
  BERLIN_CONVERSATIONS,
  [
    {
      type: "emerging_term",
      title: "Attested inference",
      body: "New at the November salon. The machine can show what actually ran.",
    },
    {
      type: "bridge",
      title: "Confidential inference",
      toNode: "sf",
      topic: "confidential-inference",
      body: "Same problem, different words.",
    },
    {
      type: "intro",
      title: "Leah Okonkwo",
      recommendationId: "leah-okonkwo",
      roles: ["cryptographer"],
      body: "Zero-knowledge match. The proof names her. The conversation stays in San Francisco.",
    },
  ],
);

const SAN_FRANCISCO: NodeGraph = graph(
  [
    topic("confidential-inference", "Confidential inference", "topic", ["berlin"], [
      ["sf-oct-lab", "2026-10-22"],
      ["sf-nov-bridge", "2026-11-13"],
    ]),
    topic("proof-carrying-result", "Proof-carrying result", "term", [], [
      ["sf-nov-proof", "2026-11-13"],
    ]),
    topic("secure-enclave", "Secure enclave", "problem", [], [
      ["sf-oct-lab", "2026-10-22"],
      ["sf-nov-proof", "2026-11-13"],
    ]),
    topic("lab-notebook", "Lab notebook", "topic", [], [
      ["sf-oct-lab", "2026-10-22"],
    ]),
    topic("neurotech-readouts", "Neurotech readouts", "topic", ["berlin"], [
      ["sf-oct-lab", "2026-10-22"],
      ["sf-nov-bridge", "2026-11-13"],
    ]),
    topic("sample-privacy", "Sample privacy", "problem", [], [
      ["sf-oct-policy", "2026-10-22"],
      ["sf-nov-bridge", "2026-11-13"],
    ]),
    topic("result-sharing", "Result sharing", "topic", [], [
      ["sf-oct-policy", "2026-10-22"],
      ["sf-nov-proof", "2026-11-13"],
    ]),
    topic("joint-salon", "Joint salon", "topic", ["berlin"], [
      ["sf-nov-bridge", "2026-11-13"],
    ]),
    topic("vocabulary-drift", "Vocabulary drift", "term", [], [
      ["sf-nov-bridge", "2026-11-13"],
    ]),
    topic("open-models", "Open models", "topic", [], [
      ["sf-oct-lab", "2026-10-22"],
      ["sf-nov-proof", "2026-11-13"],
    ]),
    topic("review-load", "Review load", "problem", [], [
      ["sf-oct-policy", "2026-10-22"],
    ]),
    topic("bay-compute", "Bay compute", "topic", [], [
      ["sf-nov-proof", "2026-11-13"],
    ]),
  ],
  SF_EVENTS,
  SF_CONVERSATIONS,
  [
    {
      type: "emerging_term",
      title: "Proof-carrying result",
      body: "New this month. A result that travels with its proof.",
    },
    {
      type: "bridge",
      title: "Neurotech readouts",
      toNode: "berlin",
      topic: "neurotech-readouts",
      body: "Berlin is on the same readout.",
    },
    {
      type: "intro",
      title: "Jonas Keller",
      recommendationId: "jonas-keller",
      roles: ["biologist"],
      body: "Zero-knowledge match. The proof names him. The conversation stays in Berlin.",
    },
  ],
);

const CAPE_TOWN: NodeGraph = graph(
  [
    topic("water-and-compute", "Water and compute", "topic", ["berlin"], [
      ["cpt-oct-water", "2026-10-29"],
      ["cpt-nov-circle", "2026-11-08"],
      ["cpt-nov-dry", "2026-11-14"],
    ]),
    topic("dry-compute", "Dry compute", "term", [], [
      ["cpt-nov-dry", "2026-11-14"],
    ]),
    topic("cooling-budget", "Cooling budget", "problem", [], [
      ["cpt-oct-water", "2026-10-29"],
      ["cpt-nov-dry", "2026-11-14"],
    ]),
    topic("molecular-machines", "Molecular machines", "topic", ["berlin"], [
      ["cpt-oct-water", "2026-10-29"],
      ["cpt-nov-circle", "2026-11-08"],
    ]),
    topic("grid-windows", "Grid windows", "topic", [], [
      ["cpt-nov-circle", "2026-11-08"],
      ["cpt-nov-dry", "2026-11-14"],
    ]),
    topic("training-schedule", "Training schedule", "problem", [], [
      ["cpt-nov-circle", "2026-11-08"],
    ]),
    topic("local-fabrication", "Local fabrication", "topic", [], [
      ["cpt-oct-water", "2026-10-29"],
    ]),
    topic("affiliate-pipeline", "Affiliate pipeline", "topic", [], [
      ["cpt-nov-circle", "2026-11-08"],
      ["cpt-nov-dry", "2026-11-14"],
    ]),
    topic("consent-on-site", "Consent on site", "topic", [], [
      ["cpt-nov-circle", "2026-11-08"],
    ]),
    topic("shared-vocabulary", "Shared vocabulary", "term", [], [
      ["cpt-nov-dry", "2026-11-14"],
    ]),
  ],
  CAPE_EVENTS,
  CAPE_CONVERSATIONS,
  [
    {
      type: "emerging_term",
      title: "Dry compute",
      body: "New on 14 November. Compute planned around water.",
    },
    {
      type: "bridge",
      title: "Water and compute",
      toNode: "berlin",
      topic: "water-and-compute",
      body: "Berlin has started using the same pairing.",
    },
    {
      type: "intro",
      title: "Amira Hassan",
      recommendationId: "amira-hassan",
      roles: ["systems engineer"],
      body: "Zero-knowledge match. The proof names her. The conversation stays in Berlin.",
    },
  ],
);

export const MEMORY_GRAPHS: Record<string, NodeGraph> = {
  berlin: BERLIN,
  sf: SAN_FRANCISCO,
  "cape-town": CAPE_TOWN,
};

export function memoryGraph(placeId: string): NodeGraph | undefined {
  return MEMORY_GRAPHS[placeId];
}

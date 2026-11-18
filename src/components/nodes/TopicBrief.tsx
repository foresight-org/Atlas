/**
 * The sentence under a selected topic.
 * The same text is on the topic in the graph an agent reads.
 */

import type { MemoryTopic } from "../../types/nodeMemory";

function joined(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

const KIND = {
  problem: "Hard problem",
  term: "Ember",
  topic: "Theme",
} as const;

export function TopicBrief({
  topic,
  neighborLabels,
}: {
  topic: MemoryTopic | null;
  neighborLabels: string[];
}) {
  if (!topic) return null;
  const summary =
    topic.summary ||
    (neighborLabels.length > 0 ? `In the room with ${joined(neighborLabels.slice(0, 3))}.` : "");
  if (!summary) return null;

  return (
    <section className="atlas-topic-brief" aria-live="polite">
      <p>{KIND[topic.kind]}</p>
      <h3 className="font-heading">{topic.label}</h3>
      <p>{summary}</p>
    </section>
  );
}

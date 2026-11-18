/**
 * Short notices from the Node. Introductions are real directory people,
 * rendered beside this list.
 */

import { memoryPlaceName } from "../../data/nodeMemoryPlaces";
import type { MemoryInsight } from "../../types/nodeMemory";

const KICKER = {
  emerging_term: "Emerging term",
  bridge: "Bridge",
  intro: "Who you should talk to",
} as const;

export function InsightCards({ insights }: { insights: MemoryInsight[] }) {
  const shown = insights.filter((insight) => insight.type !== "intro");
  if (shown.length === 0) return null;
  return (
    <ul className="atlas-insights">
      {shown.map((insight) => {
        const where = insight.toNode ? memoryPlaceName(insight.toNode) : null;
        return (
          <li key={insight.type}>
            <p>
              {KICKER[insight.type]}
              {where ? ` · ${where}` : ""}
            </p>
            <h4>{insight.title}</h4>
          </li>
        );
      })}
    </ul>
  );
}

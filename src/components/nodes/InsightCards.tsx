/**
 * Three short notices. Roles, never names.
 */

import { memoryPlaceName } from "../../data/nodeMemoryPlaces";
import type { MemoryInsight } from "../../types/nodeMemory";

const KICKER = {
  emerging_term: "Emerging term",
  bridge: "Bridge",
  intro: "Who should talk",
} as const;

export function InsightCards({ insights }: { insights: MemoryInsight[] }) {
  return (
    <ul className="atlas-insights">
      {insights.map((insight) => {
        const where = insight.toNode ? memoryPlaceName(insight.toNode) : null;
        return (
          <li key={insight.type}>
            <p>
              {KICKER[insight.type]}
              {where ? ` · ${where}` : ""}
            </p>
            <h4>{insight.title}</h4>
            <p>{insight.body}</p>
          </li>
        );
      })}
    </ul>
  );
}

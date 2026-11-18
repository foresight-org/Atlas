/**
 * Three short notices.
 * An introduction is for the signed-in person, from a conversation they were in.
 */

import { memoryPlaceName } from "../../data/nodeMemoryPlaces";
import { NODE_RECOMMENDATIONS, openNodeRecommendations } from "../../data/nodeRecommendations";
import type { MemoryInsight } from "../../types/nodeMemory";

const KICKER = {
  emerging_term: "Emerging term",
  bridge: "Bridge",
  intro: "Who you should talk to",
} as const;

export function InsightCards({ insights }: { insights: MemoryInsight[] }) {
  return (
    <ul className="atlas-insights">
      {insights.map((insight) => {
        const recommendation = insight.recommendationId
          ? NODE_RECOMMENDATIONS.find((entry) => entry.id === insight.recommendationId)
          : undefined;
        if (recommendation) {
          return (
            <li key={insight.type} className="is-intro">
              <p>{KICKER.intro}</p>
              <h4>{recommendation.name}</h4>
              <p className="atlas-insights__where">
                {recommendation.role} · {memoryPlaceName(recommendation.nodeId)}
              </p>
              <button type="button" className="atlas-insights__link" onClick={openNodeRecommendations}>
                See in Connections
              </button>
            </li>
          );
        }
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

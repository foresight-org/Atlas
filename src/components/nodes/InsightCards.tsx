/**
 * Three notices a Node can already offer, before any of them become a push.
 * Roles, never names. A bridge names the other Node and the shared topic.
 */

import { ArrowLeftRight, Sparkles, Users } from "lucide-react";
import { memoryPlaceName } from "../../data/nodeMemoryPlaces";
import type { MemoryInsight } from "../../types/nodeMemory";

const COPY = {
  emerging_term: { kicker: "Emerging term", Icon: Sparkles },
  bridge: { kicker: "Bridge", Icon: ArrowLeftRight },
  intro: { kicker: "Who should talk", Icon: Users },
} as const;

export function InsightCards({ insights }: { insights: MemoryInsight[] }) {
  return (
    <section className="atlas-insights" aria-labelledby="node-insights-title">
      <h3 id="node-insights-title">What to notice</h3>
      <ul>
        {insights.map((insight) => {
          const { kicker, Icon } = COPY[insight.type];
          const bridge = insight.toNode ? memoryPlaceName(insight.toNode) : null;
          return (
            <li key={insight.type} data-type={insight.type}>
              <p className="atlas-insights__kicker">
                <Icon aria-hidden />
                {kicker}
                {bridge ? <span> · {bridge}</span> : null}
              </p>
              <h4>{insight.title}</h4>
              <p>{insight.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

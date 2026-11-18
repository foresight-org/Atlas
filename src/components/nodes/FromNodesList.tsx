/**
 * Introductions other Nodes can already prove.
 * Sample people, not directory profiles. Opening one does not load a member.
 */

import { memoryPlaceName } from "../../data/nodeMemoryPlaces";
import { NODE_RECOMMENDATIONS } from "../../data/nodeRecommendations";

export function FromNodesList() {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-4 text-sm leading-relaxed text-gray-600">
        <span className="font-medium text-gray-800">Prototype. Sample data only.</span>
      </p>
      <ul className="space-y-3">
        {NODE_RECOMMENDATIONS.map((recommendation) => (
          <li
            key={recommendation.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
              From {memoryPlaceName(recommendation.nodeId)} · {recommendation.problem}
            </p>
            <h2 className="mt-1 font-heading text-lg font-normal text-gray-900">
              {recommendation.name}
            </h2>
            <p className="text-sm text-gray-600">
              {recommendation.role} · {memoryPlaceName(recommendation.surfacedAt)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

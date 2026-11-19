/**
 * A community click on a place that has no public programming page.
 * The knowledge graph stays on the internal atlas, so this card is a name.
 */

import type { MemoryPlace } from "../../types/nodeMemory";

const KIND_LINE: Record<MemoryPlace["kind"], string> = {
  node: "Opens this node’s programming.",
  affiliate: "Affiliate.",
  conversation: "In conversation.",
};

export function CommunityPlaceCard({
  place,
  onClose,
}: {
  place: MemoryPlace;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-start justify-between gap-3 px-5 pb-5 pt-7">
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold tracking-tight text-gray-900">{place.name}</p>
          <p className="mt-1 text-sm text-gray-600">{KIND_LINE[place.kind]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          aria-label={`Close ${place.name}`}
        >
          Close
        </button>
      </div>
    </div>
  );
}

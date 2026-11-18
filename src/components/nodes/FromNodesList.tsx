/**
 * People in the directory whose work lines up with a Node's conversations.
 * Opening a card opens their profile.
 */

import { useEffect, useState } from "react";
import { memoryGraph } from "../../data/nodeMemory.sample";
import { fetchNodeMemory } from "../../services/nodeMemoryFeed";
import type { Person } from "../../types";
import type { NodeGraph } from "../../types/nodeMemory";
import { getNodeLabel } from "../../utils/nodeLabels";
import { talksFromGraphs } from "./recommendFromNodes";

const PLACES = ["berlin", "sf", "cape-town"];

export function FromNodesList({
  people,
  viewerId,
  onViewPerson,
}: {
  people: Person[];
  viewerId: string;
  onViewPerson: (personId: string) => void;
}) {
  const [graphs, setGraphs] = useState<Array<{ placeId: string; graph: NodeGraph }>>(() =>
    PLACES.flatMap((placeId) => {
      const graph = memoryGraph(placeId);
      return graph ? [{ placeId, graph }] : [];
    }),
  );

  useEffect(() => {
    let gone = false;
    void Promise.all(
      PLACES.map(async (placeId) => {
        const live = await fetchNodeMemory(placeId);
        const graph = live ?? memoryGraph(placeId);
        return graph ? { placeId, graph } : null;
      }),
    ).then((rows) => {
      if (!gone) setGraphs(rows.filter((row): row is { placeId: string; graph: NodeGraph } => row !== null));
    });
    return () => {
      gone = true;
    };
  }, []);

  const talks = talksFromGraphs(graphs, people, viewerId);

  if (talks.length === 0) {
    return (
      <p className="mx-auto max-w-2xl text-sm leading-relaxed text-gray-600">
        No one in the directory lines up with these conversations yet.
      </p>
    );
  }

  return (
    <ul className="mx-auto max-w-2xl space-y-3">
      {talks.map((talk) => (
        <li key={talk.person.id}>
          <button
            type="button"
            className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-gray-300"
            onClick={() => onViewPerson(talk.person.id)}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
              From {talk.placeName} · {talk.problem}
            </p>
            <h2 className="mt-1 font-heading text-lg font-normal text-gray-900">{talk.person.fullName}</h2>
            <p className="text-sm text-gray-600">
              {talk.person.roleType} · {getNodeLabel(talk.person.primaryNode)}
            </p>
            {talk.line ? <p className="mt-2 text-sm leading-relaxed text-gray-700">{talk.line}</p> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The problems a Node is in the middle of.
 *
 * These lead the panel. The graph below shows what else was in the room
 * with them. Selecting one highlights it there.
 */

import { memoryPlaceName } from "../../data/nodeMemoryPlaces";
import type { ProjectedTopic } from "./projectMemory";

interface HardProblemsProps {
  problems: ProjectedTopic[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function HardProblems({ problems, selectedId, onSelect }: HardProblemsProps) {
  if (problems.length === 0) {
    return <p className="atlas-problems__empty">None in this window.</p>;
  }

  return (
    <ul className="atlas-problems">
      {problems.map((problem) => {
        const shared = problem.sharedWith.map((id) => memoryPlaceName(id));
        const active = problem.id === selectedId;
        return (
          <li key={problem.id}>
            <button
              type="button"
              className={active ? "is-active" : undefined}
              aria-pressed={active}
              onClick={() => onSelect(problem.id)}
            >
              <span className="atlas-problems__mark" aria-hidden />
              <span className="atlas-problems__label">{problem.label}</span>
              {shared.length > 0 ? (
                <span className="atlas-problems__meta">{shared.join(", ")}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

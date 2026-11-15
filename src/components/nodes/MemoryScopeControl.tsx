/**
 * All time, a month, a week, one event, or one conversation.
 * The graph and the hard problems follow the window.
 */

import type { NodeGraph } from "../../types/nodeMemory";
import type { MemoryScopeKind } from "./projectMemory";
import { formatMemoryDate } from "./projectMemory";

const KINDS: { id: MemoryScopeKind; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "event", label: "Event" },
  { id: "conversation", label: "Conversation" },
];

interface MemoryScopeControlProps {
  graph: NodeGraph;
  kind: MemoryScopeKind;
  eventId: string;
  conversationId: string;
  windowLabel: string;
  onKind: (kind: MemoryScopeKind) => void;
  onEvent: (id: string) => void;
  onConversation: (id: string) => void;
}

export function MemoryScopeControl({
  graph,
  kind,
  eventId,
  conversationId,
  windowLabel,
  onKind,
  onEvent,
  onConversation,
}: MemoryScopeControlProps) {
  return (
    <div className="atlas-memory-scope">
      <div className="atlas-memory-scope__row" role="radiogroup" aria-label="Memory window">
        {KINDS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={kind === option.id}
            className={kind === option.id ? "is-active" : undefined}
            onClick={() => onKind(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {kind !== "all" ? <p className="atlas-memory-scope__window">{windowLabel}</p> : null}
      {kind === "event" ? (
        <label className="atlas-memory-scope__pick">
          <select aria-label="Event" value={eventId} onChange={(event) => onEvent(event.target.value)}>
            {graph.events.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {kind === "conversation" ? (
        <label className="atlas-memory-scope__pick">
          <select
            aria-label="Conversation"
            value={conversationId}
            onChange={(event) => onConversation(event.target.value)}
          >
            {graph.conversations.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label} · {formatMemoryDate(entry.at)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

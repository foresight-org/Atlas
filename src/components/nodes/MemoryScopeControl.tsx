/**
 * Nested windows over one Node.
 *
 * A conversation sits inside an event (a salon, sometimes several days).
 * Events sit inside a week and a month. All time is the Node’s memory
 * as it stands. The graph follows the window. The insights do not.
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
      <p className="atlas-memory-scope__window">
        Showing <strong>{windowLabel}</strong>
        <span> · sample clock, through 13 Nov 2026</span>
      </p>
      {kind === "event" ? (
        <label className="atlas-memory-scope__pick">
          <span>Event</span>
          <select value={eventId} onChange={(event) => onEvent(event.target.value)}>
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
          <span>Conversation</span>
          <select value={conversationId} onChange={(event) => onConversation(event.target.value)}>
            {graph.conversations.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label} · {formatMemoryDate(entry.at)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="atlas-memory-scope__note">
        A salon holds several conversations. They fold into the event, then the week, the month, and the Node’s memory.
      </p>
    </div>
  );
}

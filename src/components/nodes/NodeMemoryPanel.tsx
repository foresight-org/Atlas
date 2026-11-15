/**
 * The side of the globe that opens when a Node is chosen.
 *
 * Phone: this sits in a bottom sheet. Larger screens: it replaces the
 * people list for as long as the Node stays selected. Closing it — the
 * button, or Escape when no topic is selected — returns the globe to a
 * free spin. Escape with a topic selected clears the topic first.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { memoryGraph } from "../../data/nodeMemory.sample";
import type { MemoryPlace } from "../../types/nodeMemory";
import { InsightCards } from "./InsightCards";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { MemoryScopeControl } from "./MemoryScopeControl";
import { PipelineStrip } from "./PipelineStrip";
import { projectMemory, type MemoryScopeKind } from "./projectMemory";

const KIND_LABEL: Record<MemoryPlace["kind"], string> = {
  node: "Foresight node",
  affiliate: "Affiliate node",
  conversation: "In conversation",
};

interface NodeMemoryPanelProps {
  place: MemoryPlace;
  onClose: () => void;
}

export function NodeMemoryPanel({ place, onClose }: NodeMemoryPanelProps) {
  const graph = memoryGraph(place.id);
  const rootRef = useRef<HTMLElement>(null);
  const [kind, setKind] = useState<MemoryScopeKind>("all");
  const [eventId, setEventId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  useEffect(() => {
    if (!graph) return;
    setKind("all");
    setEventId(graph.events[graph.events.length - 1]?.id ?? "");
    setConversationId(graph.conversations[graph.conversations.length - 1]?.id ?? "");
    setSelectedTopicId(null);
    rootRef.current?.focus({ preventScroll: true });
  }, [place.id, graph]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedTopicId) {
        setSelectedTopicId(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, selectedTopicId]);

  const scope = useMemo(() => {
    if (kind === "event") return { kind, eventId };
    if (kind === "conversation") return { kind, conversationId };
    return { kind };
  }, [kind, eventId, conversationId]);

  const projected = useMemo(
    () => (graph ? projectMemory(graph, scope) : null),
    [graph, scope],
  );

  if (!graph || !projected) return null;

  return (
    <article
      ref={rootRef}
      className="atlas-node-memory"
      role="dialog"
      aria-modal="false"
      aria-labelledby="node-memory-title"
      tabIndex={-1}
    >
      <header className="atlas-node-memory__header">
        <div className="atlas-node-memory__bar">
          <p className="atlas-node-memory__sample">Prototype. Sample data only.</p>
          <button type="button" className="atlas-node-memory__close" onClick={onClose} aria-label="Close node">
            <X aria-hidden />
          </button>
        </div>
        <p className="atlas-node-memory__kind">{KIND_LABEL[place.kind]}</p>
        <h2 id="node-memory-title" className="font-heading">
          {place.name}
        </h2>
        <p className="atlas-node-memory__summary">{place.summary}</p>
        <p className="atlas-node-memory__steward">{place.stewardship}</p>
      </header>

      <MemoryScopeControl
        graph={graph}
        kind={kind}
        eventId={eventId}
        conversationId={conversationId}
        windowLabel={projected.windowLabel}
        onKind={setKind}
        onEvent={setEventId}
        onConversation={setConversationId}
      />

      <section className="atlas-node-memory__graph" aria-labelledby="node-memory-graph-title">
        <h3 id="node-memory-graph-title">Memory</h3>
        <p className="atlas-node-memory__lede">
          Topics, hard problems, and terms from consented conversations. Shared marks are the bridges to other nodes.
        </p>
        <KnowledgeGraph
          topics={projected.topics}
          edges={projected.edges}
          selectedId={selectedTopicId}
          onSelect={setSelectedTopicId}
        />
      </section>

      <PipelineStrip />
      <InsightCards insights={graph.insights} />
    </article>
  );
}

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
import { openNodeRecommendations } from "../../data/nodeRecommendations";
import { fetchNodeMemory } from "../../services/nodeMemoryFeed";
import { getIdentity } from "../../services/identity";
import type { Person } from "../../types";
import type { MemoryPlace, NodeGraph } from "../../types/nodeMemory";
import { getNodeLabel } from "../../utils/nodeLabels";
import { HardProblems } from "./HardProblems";
import { InsightCards } from "./InsightCards";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { MemoryScopeControl } from "./MemoryScopeControl";
import { projectMemory, type MemoryScopeKind } from "./projectMemory";
import { talksFromGraphs } from "./recommendFromNodes";
import { TopicBrief } from "./TopicBrief";

const KIND_LABEL: Record<MemoryPlace["kind"], string> = {
  node: "Foresight node",
  affiliate: "Affiliate node",
  conversation: "In conversation",
};

interface NodeMemoryPanelProps {
  place: MemoryPlace;
  people: Person[];
  onClose: () => void;
  onViewPerson?: (personId: string) => void;
}

export function NodeMemoryPanel({ place, people, onClose, onViewPerson }: NodeMemoryPanelProps) {
  const sample = memoryGraph(place.id);
  const [published, setPublished] = useState<NodeGraph | null>(null);

  useEffect(() => {
    let gone = false;
    setPublished(null);
    void fetchNodeMemory(place.id).then((graph) => {
      if (!gone && graph) setPublished(graph);
    });
    return () => {
      gone = true;
    };
  }, [place.id]);

  const graph = published ?? sample;
  const fromMeld = published !== null;
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

  const problems = useMemo(
    () =>
      (projected?.topics ?? [])
        .filter((topic) => topic.kind === "problem")
        .sort((a, b) => b.weight - a.weight),
    [projected],
  );

  const selected = projected?.topics.find((topic) => topic.id === selectedTopicId) ?? null;
  const neighborLabels = useMemo(() => {
    if (!selected || !projected) return [];
    const ids = new Set<string>();
    for (const edge of projected.edges) {
      if (edge.source === selected.id) ids.add(edge.target);
      if (edge.target === selected.id) ids.add(edge.source);
    }
    return projected.topics.filter((topic) => ids.has(topic.id)).map((topic) => topic.label);
  }, [projected, selected]);

  const talk = useMemo(() => {
    if (!graph) return null;
    return (
      talksFromGraphs([{ placeId: place.id, graph }], people, getIdentity()?.personId ?? "", 1)[0] ?? null
    );
  }, [graph, people, place.id]);

  useEffect(() => {
    setSelectedTopicId(problems[0]?.id ?? null);
  }, [place.id, kind, eventId, conversationId, problems]);

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
          <p className="atlas-node-memory__sample">
            {fromMeld ? "From Meld" : "Prototype. Sample data only."}
          </p>
          <button type="button" className="atlas-node-memory__close" onClick={onClose} aria-label="Close node">
            <X aria-hidden />
          </button>
        </div>
        <p className="atlas-node-memory__kind">{KIND_LABEL[place.kind]}</p>
        <h2 id="node-memory-title" className="font-heading">
          {place.name}
        </h2>
        <p className="atlas-node-memory__summary">{place.summary}</p>
      </header>

      <section aria-labelledby="node-problems-title">
        <h3 id="node-problems-title" className="font-heading">
          Current hard problems
        </h3>
        <HardProblems
          problems={problems}
          selectedId={selectedTopicId}
          onSelect={(id) => setSelectedTopicId((current) => (current === id ? null : id))}
        />
      </section>

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

      <KnowledgeGraph
        topics={projected.topics}
        edges={projected.edges}
        selectedId={selectedTopicId}
        onSelect={setSelectedTopicId}
      />

      <TopicBrief topic={selected} neighborLabels={neighborLabels} />

      {talk ? (
        <section className="atlas-topic-brief atlas-topic-brief--talk">
          <p>Who you should talk to</p>
          <button type="button" className="atlas-topic-brief__person" onClick={() => onViewPerson?.(talk.person.id)}>
            <h3 className="font-heading">{talk.person.fullName}</h3>
            <span>
              {talk.person.roleType} · {getNodeLabel(talk.person.primaryNode)}
            </span>
          </button>
          <p>
            From {talk.placeName}, on {talk.problem}.
            {talk.line ? ` ${talk.line}` : ""}
          </p>
          <button type="button" className="atlas-insights__link" onClick={openNodeRecommendations}>
            See in Connections
          </button>
        </section>
      ) : null}

      <InsightCards insights={graph.insights} />
    </article>
  );
}

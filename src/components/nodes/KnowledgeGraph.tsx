/**
 * One window of a Node's memory, drawn as a force-directed graph.
 *
 * Topics, hard problems, and emerging terms are the marks. A link means
 * they came up in the same consented conversation. A shared topic — alive
 * at another Node — is drawn as a bridge, because that is how two rooms
 * find out they are on the same problem.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { memoryPlaceName } from "../../data/nodeMemoryPlaces";
import type { MemoryEdge, MemoryTopicKind } from "../../types/nodeMemory";
import {
  seedBodies,
  tickBodies,
  topicRadius,
  type ForceBody,
} from "./forceLayout";
import type { ProjectedTopic } from "./projectMemory";
import { formatMemoryDate } from "./projectMemory";
import { useReducedMotion } from "./useReducedMotion";

interface KnowledgeGraphProps {
  topics: ProjectedTopic[];
  edges: MemoryEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const KIND_NAME: Record<MemoryTopicKind, string> = {
  topic: "Topic",
  problem: "Hard problem",
  term: "Emerging term",
};

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const bend = Math.min(18, length * 0.12);
  const cx = midX + (-dy / length) * bend;
  const cy = midY + (dx / length) * bend;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function diamond(x: number, y: number, radius: number): string {
  return `${x.toFixed(1)},${(y - radius).toFixed(1)} ${(x + radius).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y + radius).toFixed(1)} ${(x - radius).toFixed(1)},${y.toFixed(1)}`;
}

export function KnowledgeGraph({ topics, edges, selectedId, onSelect }: KnowledgeGraphProps) {
  const reducedMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bodiesRef = useRef<ForceBody[]>([]);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const [size, setSize] = useState({ width: 360, height: 200 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const topicKey = topics.map((entry) => `${entry.id}:${entry.weight}`).join("|");
  const widthQuantum = Math.round(size.width / 48);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const width = frame.clientWidth;
      if (width < 40) return;
      setSize({ width, height: 200 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size.width < 40 || topics.length === 0) {
      bodiesRef.current = [];
      setPositions({});
      return;
    }
    const bodies = seedBodies(
      topics.map((entry) => ({ id: entry.id, r: topicRadius(entry.weight) })),
      size.width,
      size.height,
    );
    bodiesRef.current = bodies;
    const links = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
    }));
    const publish = () => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const body of bodies) next[body.id] = { x: body.x, y: body.y };
      setPositions(next);
    };

    if (reducedMotion) {
      for (let step = 0; step < 180; step += 1) {
        tickBodies(bodies, links, size.width, size.height);
      }
      publish();
      return;
    }

    let frame = 0;
    let steps = 0;
    let running = true;
    const loop = () => {
      if (!running) return;
      const energy = tickBodies(bodies, links, size.width, size.height);
      steps += 1;
      publish();
      const dragging = dragRef.current != null;
      if (dragging || (steps < 220 && energy > 0.08)) {
        frame = requestAnimationFrame(loop);
      }
    };
    frame = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
    /* topicKey is the identity of the visible graph. The array itself is new each project. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicKey, widthQuantum, size.height, reducedMotion]);

  const focusId = hoveredId ?? selectedId;
  const neighborhood = useMemo(() => {
    if (!focusId) return null;
    const ids = new Set<string>([focusId]);
    for (const edge of edges) {
      if (edge.source === focusId) ids.add(edge.target);
      if (edge.target === focusId) ids.add(edge.source);
    }
    return ids;
  }, [edges, focusId]);

  const byId = useMemo(() => new Map(topics.map((entry) => [entry.id, entry])), [topics]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const pointFor = (id: string) => positions[id];

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    const body = bodiesRef.current.find((entry) => entry.id === drag.id);
    if (body) body.pinned = false;
    dragRef.current = null;
    onSelect(drag.id);
  };

  const moveDrag = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    const body = bodiesRef.current.find((entry) => entry.id === drag.id);
    if (!body) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * size.width;
    const y = ((clientY - rect.top) / Math.max(rect.height, 1)) * size.height;
    const pad = body.r + 8;
    body.x = Math.max(pad, Math.min(size.width - pad, x));
    body.y = Math.max(pad, Math.min(size.height - pad, y));
    setPositions((current) => ({ ...current, [body.id]: { x: body.x, y: body.y } }));
  };

  if (topics.length === 0) {
    return (
      <p className="atlas-memory-empty">Nothing in this window.</p>
    );
  }

  return (
    <div className="atlas-memory-graph">
      <div ref={frameRef} className="atlas-memory-graph__frame">
        <svg
          ref={svgRef}
          className="atlas-memory-graph__svg"
          viewBox={`0 0 ${size.width} ${size.height}`}
          role="group"
          aria-label="Topics, hard problems, and terms from this window"
          onPointerMove={(event) => {
            if (!dragRef.current) return;
            if (Math.hypot(event.movementX, event.movementY) > 0) dragRef.current.moved = true;
            moveDrag(event.clientX, event.clientY);
          }}
          onPointerUp={endDrag}
          onPointerLeave={() => setHoveredId(null)}
        >
          {edges.map((edge) => {
            const from = pointFor(edge.source);
            const to = pointFor(edge.target);
            if (!from || !to) return null;
            const dim = neighborhood != null && (!neighborhood.has(edge.source) || !neighborhood.has(edge.target));
            return (
              <path
                key={`${edge.source}-${edge.target}`}
                d={curve(from.x, from.y, to.x, to.y)}
                className="atlas-memory-graph__edge"
                strokeWidth={1 + Math.min(edge.weight, 3) * 0.55}
                opacity={dim ? 0.08 : 0.85}
              />
            );
          })}
          {topics.map((entry) => {
            const point = pointFor(entry.id);
            if (!point) return null;
            const dim = neighborhood != null && !neighborhood.has(entry.id);
            /*
             * At rest, name the bridges and anything small enough to read.
             * Hover and selection bring the neighbours’ names out with them.
             */
            const labelId = hoveredId ?? selectedId;
            const showLabel = entry.id === labelId;
            const radius = topicRadius(entry.weight);
            return (
              <g
                key={entry.id}
                className={`atlas-memory-mark is-${entry.kind}${entry.sharedWith.length > 0 ? " is-shared" : ""}`}
                transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}
                tabIndex={0}
                role="button"
                aria-pressed={entry.id === selectedId}
                aria-label={`${entry.label}, ${KIND_NAME[entry.kind]}, ${entry.weight} ${entry.weight === 1 ? "conversation" : "conversations"}`}
                opacity={dim ? 0.2 : 1}
                onPointerEnter={() => setHoveredId(entry.id)}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  const body = bodiesRef.current.find((item) => item.id === entry.id);
                  if (body) body.pinned = true;
                  dragRef.current = { id: entry.id, moved: false };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerUp={endDrag}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onSelect(entry.id === selectedId ? null : entry.id);
                }}
              >
                {entry.sharedWith.length > 0 ? (
                  <circle r={radius + 5} className="atlas-memory-mark__bridge" />
                ) : null}
                {entry.kind === "problem" ? (
                  <polygon points={diamond(0, 0, radius)} />
                ) : (
                  <circle r={radius} />
                )}
                {entry.kind === "term" ? <circle r={radius * 0.45} className="atlas-memory-mark__core" /> : null}
                {showLabel ? (
                  <text y={radius + 13} className="atlas-memory-mark__label">
                    {entry.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="atlas-memory-key" aria-label="Graph key">
        <li><i className="is-topic" /> Topic</li>
        <li><i className="is-problem" /> Hard problem</li>
        <li><i className="is-term" /> Emerging term</li>
        <li><i className="is-shared" /> Shared</li>
      </ul>
      <div className="atlas-memory-detail" aria-live="polite">
        {selected ? (
          <>
            <p className="atlas-memory-detail__kind">{KIND_NAME[selected.kind]}</p>
            <h4 className="atlas-memory-detail__title">{selected.label}</h4>
            <p>
              {selected.weight} {selected.weight === 1 ? "conversation" : "conversations"}
              {" · "}
              {formatMemoryDate(selected.firstSeen)}
              {selected.sharedWith.length > 0
                ? ` · ${selected.sharedWith.map((id) => memoryPlaceName(id)).join(", ")}`
                : ""}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

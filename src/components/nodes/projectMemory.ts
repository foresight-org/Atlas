/**
 * A window over one Node's memory.
 *
 * All time, a month, a week, one event, or one conversation are the same
 * operation: keep the conversations in range, then keep the topics and
 * links those conversations actually contain. Insights stay at Node scope.
 * They describe the place, not the slice.
 */

import { linkTopics, SAMPLE_CLOCK } from "../../data/nodeMemory.sample";
import type { MemoryEdge, MemoryTopic, NodeGraph } from "../../types/nodeMemory";

export type MemoryScopeKind = "all" | "month" | "week" | "event" | "conversation";

export interface MemoryScope {
  kind: MemoryScopeKind;
  eventId?: string;
  conversationId?: string;
}

export interface ProjectedTopic extends MemoryTopic {
  weight: number;
}

export interface ProjectedMemory {
  topics: ProjectedTopic[];
  edges: MemoryEdge[];
  windowLabel: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseDay(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function formatDay(iso: string): string {
  const date = parseDay(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCFullYear()}`;
}

/** Monday–Sunday week that contains the sample clock. */
function weekBounds(clock: string): { start: string; end: string } {
  const date = parseDay(clock);
  const weekday = date.getUTCDay();
  const fromMonday = weekday === 0 ? 6 : weekday - 1;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - fromMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function conversationsInScope(graph: NodeGraph, scope: MemoryScope): Set<string> {
  if (scope.kind === "conversation" && scope.conversationId) {
    return new Set([scope.conversationId]);
  }
  if (scope.kind === "event" && scope.eventId) {
    return new Set(
      graph.conversations.filter((entry) => entry.eventId === scope.eventId).map((entry) => entry.id),
    );
  }
  if (scope.kind === "month") {
    const month = SAMPLE_CLOCK.slice(0, 7);
    return new Set(
      graph.conversations.filter((entry) => entry.at.slice(0, 7) === month).map((entry) => entry.id),
    );
  }
  if (scope.kind === "week") {
    const { start, end } = weekBounds(SAMPLE_CLOCK);
    return new Set(
      graph.conversations
        .filter((entry) => entry.at >= start && entry.at <= end)
        .map((entry) => entry.id),
    );
  }
  return new Set(graph.conversations.map((entry) => entry.id));
}

export function scopeWindowLabel(graph: NodeGraph, scope: MemoryScope): string {
  if (scope.kind === "all") return "All time";
  if (scope.kind === "month") {
    const date = parseDay(SAMPLE_CLOCK);
    return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }
  if (scope.kind === "week") {
    const { start, end } = weekBounds(SAMPLE_CLOCK);
    return `${formatDay(start)} – ${formatDay(end)}`;
  }
  if (scope.kind === "event") {
    return graph.events.find((entry) => entry.id === scope.eventId)?.label ?? "Event";
  }
  return graph.conversations.find((entry) => entry.id === scope.conversationId)?.label ?? "Conversation";
}

export function projectMemory(graph: NodeGraph, scope: MemoryScope): ProjectedMemory {
  const allowed = conversationsInScope(graph, scope);
  const topics: ProjectedTopic[] = [];

  for (const entry of graph.topics) {
    const mentions = entry.mentions.filter((mention) => allowed.has(mention.conversationId));
    if (mentions.length === 0) continue;
    let firstSeen = mentions[0].at;
    const conversations = new Set<string>();
    for (const mention of mentions) {
      conversations.add(mention.conversationId);
      if (mention.at < firstSeen) firstSeen = mention.at;
    }
    topics.push({
      ...entry,
      mentions,
      firstSeen,
      weight: conversations.size,
    });
  }

  return {
    topics,
    edges: linkTopics(topics),
    windowLabel: scopeWindowLabel(graph, scope),
  };
}

export function formatMemoryDate(iso: string): string {
  return formatDay(iso);
}

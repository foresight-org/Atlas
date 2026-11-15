/**
 * Node memory — the shape a real feed will have to match.
 *
 * A place is a point on the globe. A graph is what consented conversations
 * at that place have left behind: topics, the conversations they co-occurred
 * in, and three insights. Mentions are the join. Windows (a conversation,
 * an event, a week, a month, all time) are just filters over mentions, so
 * the panel does not change when the source of the mentions does.
 */

export type MemoryPlaceKind = "node" | "affiliate" | "conversation";

export type MemoryTopicKind = "topic" | "problem" | "term";

export type MemoryInsightType = "emerging_term" | "bridge" | "intro";

export interface MemoryPlace {
  id: string;
  name: string;
  kind: MemoryPlaceKind;
  lon: number;
  lat: number;
  /** One line under the name. In-conversation places are not opened. */
  summary: string;
  /**
   * Who runs the pipeline. Foresight nodes are kept here and built so they
   * can move onto the Node's own machines. Affiliates already run there.
   */
  stewardship: string;
}

export interface MemoryArc {
  from: string;
  to: string;
  /** A dashed arc: a place we are in conversation with, not yet a graph. */
  open: boolean;
}

export interface MemoryMention {
  conversationId: string;
  /** ISO date, YYYY-MM-DD. The sample clock, not a timestamp. */
  at: string;
}

export interface MemoryTopic {
  id: string;
  label: string;
  kind: MemoryTopicKind;
  /** Distinct consented conversations, all time. Windows recompute this. */
  weight: number;
  /** Other places where the same topic id is alive. */
  sharedWith: string[];
  firstSeen: string;
  mentions: MemoryMention[];
}

export interface MemoryEdge {
  source: string;
  target: string;
  /** Conversations in which the two topics were both mentioned. */
  weight: number;
}

export interface MemoryInsight {
  type: MemoryInsightType;
  title: string;
  body: string;
  toNode?: string;
  topic?: string;
  roles?: string[];
}

export interface MemoryConversation {
  id: string;
  eventId: string;
  label: string;
  at: string;
}

export interface MemoryEvent {
  id: string;
  label: string;
  start: string;
  end: string;
}

export interface NodeGraph {
  topics: MemoryTopic[];
  edges: MemoryEdge[];
  insights: MemoryInsight[];
  events: MemoryEvent[];
  conversations: MemoryConversation[];
}
